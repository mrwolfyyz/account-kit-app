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

    // For initial testing, just log the inputs and return success
    console.log(
      `Request to claim funds for ${userEmail} to wallet ${destinationWallet}`
    );

    // Mock success response
    return NextResponse.json({
      message: "Claim request received (mock)",
      userEmail,
      destinationWallet,
      mockResponse: true,
      transactionHash: "0xmockTransactionHash",
      amountClaimed: "10.0",
    });
  } catch (error) {
    console.error("Error processing claim request:", error);
    return NextResponse.json(
      {
        message: "Failed to process claim request",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
