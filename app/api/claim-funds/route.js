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
  try {
    const { userEmail, destinationWallet } = await request.json();

    // Validate inputs
    if (!userEmail || typeof userEmail !== "string") {
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
      return NextResponse.json(
        { message: "Valid destination wallet address is required" },
        { status: 400 }
      );
    }

    // Get environment variables
    const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
    const RPC_URL = process.env.RPC_URL;
    const DEPOSITORY_ADDRESS = process.env.DEPOSITORY_CONTRACT_ADDRESS;
    const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS;

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

    // Set up provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    // Ensure private key has 0x prefix
    const formattedPrivateKey = PRIVATE_KEY.startsWith("0x")
      ? PRIVATE_KEY
      : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(formattedPrivateKey, provider);
    console.log(`Using account: ${wallet.address}`);

    // Connect to the contracts
    const depositoryContract = new ethers.Contract(
      DEPOSITORY_ADDRESS,
      DEPOSITORY_ABI,
      wallet
    );
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
    console.error("Error claiming funds:", error);
    return NextResponse.json(
      {
        message: "Failed to claim funds",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
