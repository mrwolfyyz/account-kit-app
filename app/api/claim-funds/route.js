import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// SimpleWalletDepository ABI (only the functions we need)
const DEPOSITORY_ABI = [
  {
    name: "claimFunds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipientId", type: "string" },
      { name: "destinationWallet", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getDeposits",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "recipientId", type: "string" }],
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "claimed", type: "bool[]" },
    ],
  },
];

// USDC ABI (only for checking balances)
const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export async function POST(request) {
  console.log("==== CLAIM FUNDS API CALLED ====");

  try {
    console.log("Parsing request body...");
    const { userEmail, destinationWallet } = await request.json();
    console.log(
      `Request data: email=${userEmail}, wallet=${destinationWallet?.substring(
        0,
        10
      )}...`
    );

    // Validate inputs
    if (!userEmail || typeof userEmail !== "string") {
      console.log("Error: Invalid user email");
      return NextResponse.json(
        { message: "Valid user email is required" },
        { status: 400 }
      );
    }

    if (
      !destinationWallet ||
      typeof destinationWallet !== "string" ||
      !destinationWallet.startsWith("0x")
    ) {
      console.log("Error: Invalid destination wallet");
      return NextResponse.json(
        { message: "Valid destination wallet address is required" },
        { status: 400 }
      );
    }

    // Get environment variables
    console.log("Retrieving environment variables...");
    const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
    const RPC_URL = process.env.RPC_URL;
    const DEPOSITORY_ADDRESS = process.env.DEPOSITORY_CONTRACT_ADDRESS;
    const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS;

    // Log environment variables (masked for security)
    console.log("Environment check:", {
      hasPrivateKey: !!PRIVATE_KEY && PRIVATE_KEY.length > 30,
      privateKeyStart: PRIVATE_KEY
        ? `${PRIVATE_KEY.substring(0, 6)}...`
        : "missing",
      hasRpcUrl: !!RPC_URL,
      rpcUrlDomain: RPC_URL ? new URL(RPC_URL).hostname : "missing",
      depositoryAddress: DEPOSITORY_ADDRESS || "missing",
      usdcAddress: USDC_ADDRESS || "missing",
    });

    if (!PRIVATE_KEY || !RPC_URL || !DEPOSITORY_ADDRESS || !USDC_ADDRESS) {
      console.error("Missing environment variables", {
        hasPrivateKey: !!PRIVATE_KEY,
        hasRpcUrl: !!RPC_URL,
        hasDepositoryAddress: !!DEPOSITORY_ADDRESS,
        hasUsdcAddress: !!USDC_ADDRESS,
      });
      return NextResponse.json(
        { message: "Server configuration error" },
        { status: 500 }
      );
    }

    // Set up provider and wallet with explicit network configuration
    console.log(
      `Initializing provider with RPC URL: ${RPC_URL.substring(0, 20)}...`
    );

    // Fix for the referrer issue in Vercel
    console.log("Applying Request patch for Vercel environment...");
    const originalRequest = global.Request;
    global.Request = function (input, init) {
      init = init || {};
      init.referrerPolicy = "no-referrer";
      return new originalRequest(input, init);
    };

    try {
      // Ensure private key has 0x prefix
      const formattedPrivateKey = PRIVATE_KEY.startsWith("0x")
        ? PRIVATE_KEY
        : `0x${PRIVATE_KEY}`;

      // Create account from private key
      const account = privateKeyToAccount(formattedPrivateKey);
      console.log(`Using account: ${account.address}`);

      // Initialize transport
      const transport = http(RPC_URL);

      // Create public client (for read operations)
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: transport,
      });

      // Create wallet client (for write operations)
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: transport,
      });

      // Test network connection
      console.log("Testing network connection...");
      console.log("Attempting getBlockNumber() call first...");
      const blockNumber = await publicClient.getBlockNumber();
      console.log(`Current block number: ${blockNumber.toString()}`); // Convert BigInt to string

      console.log("Attempting getChainId() call...");
      const chainId = await publicClient.getChainId();
      console.log(`Connected to chain ID: ${chainId}`);

      try {
        // Check deposits before claiming
        console.log(`Checking deposits for ${userEmail}`);
        const [tokens, amounts, claimed] = await publicClient.readContract({
          address: DEPOSITORY_ADDRESS,
          abi: DEPOSITORY_ABI,
          functionName: "getDeposits",
          args: [userEmail],
        });

        // Calculate total unclaimed amount
        let totalUnclaimedAmount = 0n;
        let hasUnclaimedDeposits = false;

        console.log(`Found ${tokens.length} deposits for ${userEmail}`);

        // Convert BigInt amounts to strings for logging
        const amountsStrings = amounts.map((amount) => amount.toString());

        for (let i = 0; i < tokens.length; i++) {
          console.log(`Deposit #${i + 1}:`);
          console.log(`Token: ${tokens[i]}`);
          console.log(`Amount: ${amountsStrings[i]}`); // Use string representation
          console.log(`Claimed: ${claimed[i]}`);

          if (!claimed[i]) {
            totalUnclaimedAmount += amounts[i];
            hasUnclaimedDeposits = true;
          }
        }

        if (!hasUnclaimedDeposits) {
          console.log("No unclaimed deposits found");
          return NextResponse.json(
            {
              message: "No unclaimed deposits found for this user",
              email: userEmail,
            },
            { status: 404 }
          );
        }

        console.log(
          `Total unclaimed amount: ${formatUnits(totalUnclaimedAmount, 6)} USDC`
        );

        // Check destination wallet balance before claiming
        const beforeBalance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [destinationWallet],
        });

        console.log(
          `Destination wallet balance before claim: ${formatUnits(
            beforeBalance,
            6
          )} USDC`
        );

        // Execute the claim
        console.log(`Claiming funds for ${userEmail} to ${destinationWallet}`);
        const hash = await walletClient.writeContract({
          address: DEPOSITORY_ADDRESS,
          abi: DEPOSITORY_ABI,
          functionName: "claimFunds",
          args: [userEmail, destinationWallet],
        });

        // Wait for the transaction to be mined
        console.log(`Transaction sent: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(
          `Transaction confirmed in block ${receipt.blockNumber.toString()}`
        );
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);

        // Check destination wallet balance after claiming
        const afterBalance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [destinationWallet],
        });

        const balanceIncrease = afterBalance - beforeBalance;

        // Log complete transaction details
        console.log("Transaction details:", {
          hash,
          blockNumber: receipt.blockNumber.toString(), // Convert BigInt to string
          gasUsed: receipt.gasUsed.toString(),
          from: account.address,
          to: destinationWallet,
          amountClaimed: formatUnits(balanceIncrease, 6),
        });

        // Use formatUnits for all BigInt values in the response
        return NextResponse.json({
          message: "Funds claimed successfully",
          transactionHash: hash,
          blockNumber: receipt.blockNumber.toString(), // Convert BigInt to string
          gasUsed: receipt.gasUsed.toString(),
          amountClaimed: formatUnits(balanceIncrease, 6),
          newBalance: formatUnits(afterBalance, 6),
        });
      } catch (contractError) {
        console.error("Contract error:", contractError);
        console.error("Error details:", {
          name: contractError.name,
          message: contractError.message,
          code: contractError.code,
          reason: contractError.error?.reason,
          data: contractError.error?.data,
          stack: contractError.stack,
        });

        // Check if it's a revert error with a message
        if (contractError.error?.reason) {
          return NextResponse.json(
            {
              message: `Contract error: ${contractError.error.reason}`,
              error: contractError.error.reason,
            },
            { status: 400 }
          );
        }

        // Check if it's a custom error
        if (contractError.error?.data) {
          return NextResponse.json(
            {
              message: `Contract error with data: ${contractError.error.data}`,
              error: contractError.error.data,
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            message: "Failed to interact with contract",
            error: contractError.message,
          },
          { status: 500 }
        );
      }
    } catch (networkError) {
      console.error("Failed to connect to network:", networkError);
      console.error("Error details:", {
        name: networkError.name,
        message: networkError.message,
        code: networkError.code,
        stack: networkError.stack,
      });

      try {
        // Simple ping test
        console.log(
          "Attempting simple JSON-RPC call to diagnose connection..."
        );
        const response = await fetch(RPC_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "net_version",
            params: [],
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Direct RPC call response:", data);
        } else {
          console.log("Direct RPC call failed with status:", response.status);
        }
      } catch (pingError) {
        console.error("Direct RPC ping failed:", pingError);
      }

      return NextResponse.json(
        {
          message: "Could not connect to blockchain network",
          error: networkError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in claim funds API:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        message: "Failed to claim funds",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
