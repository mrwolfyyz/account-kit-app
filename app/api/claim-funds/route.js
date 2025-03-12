import { NextResponse } from "next/server";
import { ethers } from "ethers";

// SimpleWalletDepository ABI (only the functions we need)
const DEPOSITORY_ABI = [
  "function claimFunds(string recipientId, address destinationWallet) external",
  "function getDeposits(string recipientId) external view returns (address[] tokens, uint256[] amounts, bool[] claimed)",
];

// USDC ABI (only for checking balances)
const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
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

    // Define Base Sepolia network explicitly
    const baseSepoliaNetwork = {
      name: "base-sepolia",
      chainId: 84532,
      ensAddress: null,
    };

    // Fix for the referrer issue in Vercel
    console.log("Applying Request patch for Vercel environment...");
    const originalRequest = global.Request;
    global.Request = function (input, init) {
      init = init || {};
      init.referrerPolicy = "no-referrer";
      return new originalRequest(input, init);
    };

    // Initialize provider with the standard JsonRpcProvider
    const provider = new ethers.providers.JsonRpcProvider(
      RPC_URL,
      baseSepoliaNetwork
    );

    // Test provider connection
    try {
      console.log("Testing network connection...");
      console.log("Attempting getBlockNumber() call first...");
      const blockNumber = await provider.getBlockNumber();
      console.log(`Current block number: ${blockNumber}`);

      console.log("Attempting getNetwork() call...");
      const network = await provider.getNetwork();
      console.log(
        `Connected to network: ${network.name} (chainId: ${network.chainId})`
      );
    } catch (networkError) {
      console.error("Failed to connect to network:", networkError);
      console.error("Error details:", {
        name: networkError.name,
        message: networkError.message,
        code: networkError.code,
        reason: networkError.reason,
        data: networkError.data,
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

    // Continue with the rest of the function...
    console.log("Setting up wallet...");
    // Ensure private key has 0x prefix
    const formattedPrivateKey = PRIVATE_KEY.startsWith("0x")
      ? PRIVATE_KEY
      : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(formattedPrivateKey, provider);
    console.log(`Using account: ${wallet.address}`);

    // Connect to the contracts
    console.log(`Connecting to depository contract at ${DEPOSITORY_ADDRESS}`);
    const depositoryContract = new ethers.Contract(
      DEPOSITORY_ADDRESS,
      DEPOSITORY_ABI,
      wallet
    );
    console.log(`Connecting to USDC contract at ${USDC_ADDRESS}`);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

    try {
      // Check deposits before claiming
      console.log(`Checking deposits for ${userEmail}`);
      const [tokens, amounts, claimed] = await depositoryContract.getDeposits(
        userEmail
      );

      // Calculate total unclaimed amount
      let totalUnclaimedAmount = ethers.BigNumber.from(0);
      let hasUnclaimedDeposits = false;

      console.log(`Found ${tokens.length} deposits for ${userEmail}`);

      for (let i = 0; i < tokens.length; i++) {
        console.log(`Deposit #${i + 1}:`);
        console.log(`Token: ${tokens[i]}`);
        console.log(`Amount: ${amounts[i].toString()}`);
        console.log(`Claimed: ${claimed[i]}`);

        if (!claimed[i]) {
          totalUnclaimedAmount = totalUnclaimedAmount.add(amounts[i]);
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
        `Total unclaimed amount: ${ethers.utils.formatUnits(
          totalUnclaimedAmount,
          6
        )} USDC`
      );

      // Check destination wallet balance before claiming
      const beforeBalance = await usdcContract.balanceOf(destinationWallet);
      console.log(
        `Destination wallet balance before claim: ${ethers.utils.formatUnits(
          beforeBalance,
          6
        )} USDC`
      );

      // Execute the claim
      console.log(`Claiming funds for ${userEmail} to ${destinationWallet}`);
      const tx = await depositoryContract.claimFunds(
        userEmail,
        destinationWallet
      );

      // Wait for the transaction to be mined
      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);

      // Check destination wallet balance after claiming
      const afterBalance = await usdcContract.balanceOf(destinationWallet);
      const balanceIncrease = afterBalance.sub(beforeBalance);

      // Log complete transaction details
      console.log("Transaction details:", {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        from: wallet.address,
        to: destinationWallet,
        amountClaimed: ethers.utils.formatUnits(balanceIncrease, 6),
      });

      return NextResponse.json({
        message: "Funds claimed successfully",
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        amountClaimed: ethers.utils.formatUnits(balanceIncrease, 6),
        newBalance: ethers.utils.formatUnits(afterBalance, 6),
      });
    } catch (contractError) {
      console.error("Contract error:", contractError);
      console.error("Error details:", {
        name: contractError.name,
        message: contractError.message,
        code: contractError.code,
        reason: contractError.reason,
        data: contractError.data,
        stack: contractError.stack,
      });

      // Check if it's a revert error with a message
      if (contractError.reason) {
        return NextResponse.json(
          {
            message: `Contract error: ${contractError.reason}`,
            error: contractError.reason,
          },
          { status: 400 }
        );
      }

      // Check if it's a custom error
      if (contractError.data) {
        return NextResponse.json(
          {
            message: `Contract error with data: ${contractError.data}`,
            error: contractError.data,
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
