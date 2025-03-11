import { NextResponse } from "next/server";

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

    // Get environment variables and log their existence (not values for security)
    const envVars = {
      hasPrivateKey: !!process.env.WALLET_PRIVATE_KEY,
      hasRpcUrl: !!process.env.RPC_URL,
      hasDepositoryAddress: !!process.env.DEPOSITORY_CONTRACT_ADDRESS,
      hasUsdcAddress: !!process.env.USDC_CONTRACT_ADDRESS,
      // Include first few characters of RPC URL for debugging (without exposing API key)
      rpcUrlStart: process.env.RPC_URL
        ? `${process.env.RPC_URL.substring(0, 15)}...`
        : "not set",
    };

    // Log the request information
    console.log("Claim request received:", {
      userEmail,
      destinationWalletStart: destinationWallet.substring(0, 10) + "...",
      environmentVariables: envVars,
    });

    // For this debugging version, return a success response without blockchain interaction
    return NextResponse.json({
      message: "Debug info - API route reached successfully",
      environmentVariablesStatus: envVars,
      receivedData: {
        userEmailReceived: userEmail,
        destinationWalletReceived: `${destinationWallet.substring(
          0,
          10
        )}...${destinationWallet.substring(destinationWallet.length - 6)}`,
      },
    });
  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      {
        message: "API route error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
