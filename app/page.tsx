"use client";
import { useState, useEffect } from "react";
import {
  useAuthModal,
  useLogout,
  useSignerStatus,
  useUser,
  useSmartAccountClient,
} from "@account-kit/react";

// Define a type for the claim response
interface ClaimResponse {
  message: string;
  transactionHash?: string;
  amountClaimed?: string;
  blockNumber?: number;
  gasUsed?: string;
  newBalance?: string;
  userEmail?: string;
  destinationWallet?: string;
  mockResponse?: boolean;
  // Network information for explorer links
  network?: string;
}

// Function to get block explorer URL based on network
const getExplorerUrl = (network: string = 'mainnet', txHash: string) => {
  const explorers = {
    mainnet: `https://etherscan.io/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    'base-sepolia': `https://sepolia.basescan.org/tx/${txHash}`,
    // Add other testnets
    sepolia: `https://sepolia.etherscan.io/tx/${txHash}`,
    goerli: `https://goerli.etherscan.io/tx/${txHash}`,
    mumbai: `https://mumbai.polygonscan.com/tx/${txHash}`,
    'arbitrum-sepolia': `https://sepolia.arbiscan.io/tx/${txHash}`,
    'optimism-sepolia': `https://sepolia-optimism.etherscan.io/tx/${txHash}`,
  };
  
  return explorers[network as keyof typeof explorers] || explorers.mainnet;
};

export default function Home() {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const signerStatus = useSignerStatus();
  const { logout } = useLogout();
  const { address } = useSmartAccountClient({});
  
  // Add state variables with proper typing
  const [claimStatus, setClaimStatus] = useState("");
  const [claimComplete, setClaimComplete] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimResponse, setClaimResponse] = useState<ClaimResponse | null>(null);
  
  // Function to claim USDC
  const claimFunds = async (userEmail: string, destinationWallet: string) => {
    if (!userEmail || !destinationWallet) {
      setClaimError("User email or wallet address not available");
      return;
    }
    
    try {
      setClaimStatus("Initiating funds claim...");
      
      const response = await fetch('/api/claim-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          destinationWallet,
        }),
      });
      
      const data: ClaimResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Claim request failed');
      }
      
      setClaimStatus(`Funds claimed! ${data.transactionHash ? `Transaction hash: ${data.transactionHash}` : ''}`);
      setClaimResponse(data);
      setClaimComplete(true);
      
    } catch (error: unknown) {
      console.error("Claim error:", error);
      setClaimError(
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' 
          ? error.message 
          : "Failed to claim funds"
      );
      setClaimStatus("Claim failed");
    }
  };
  
  // Auto-trigger the claim when user has authenticated and address is available
  useEffect(() => {
    if (user?.email && address && !claimComplete && !claimStatus) {
      claimFunds(user.email, address);
    }
  }, [user, address, claimComplete, claimStatus]);

  // Transaction verification component
  const TransactionDetails = ({ txData }: { txData: ClaimResponse }) => {
    if (!txData || !txData.transactionHash) return null;
    
    const explorerUrl = getExplorerUrl(txData.network, txData.transactionHash);
    
    return (
      <div className="mt-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Transaction Details</h3>
        <div className="space-y-2 text-sm">
          {txData.blockNumber && (
            <p className="flex justify-between">
              <span className="font-medium text-gray-600">Block:</span>
              <span className="font-mono">{txData.blockNumber}</span>
            </p>
          )}
          {txData.amountClaimed && (
            <p className="flex justify-between">
              <span className="font-medium text-gray-600">Amount:</span>
              <span className="font-mono">{txData.amountClaimed} USDC</span>
            </p>
          )}
          {txData.gasUsed && (
            <p className="flex justify-between">
              <span className="font-medium text-gray-600">Gas Used:</span>
              <span className="font-mono">{txData.gasUsed}</span>
            </p>
          )}
          {txData.transactionHash && (
            <div className="pt-2">
              <p className="font-medium text-gray-600 mb-1">Transaction Hash:</p>
              <p className="font-mono text-xs break-all">{txData.transactionHash}</p>
              <a 
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block py-1.5 px-3 bg-blue-600 text-white text-sm rounded-lg
                          hover:bg-blue-700 transition-colors"
              >
                Verify on Block Explorer
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 transition-all duration-300 hover:shadow-xl">
        {signerStatus.isInitializing ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="animate-bounce text-4xl">🔄</div>
            <p className="text-lg font-medium text-blue-800">Loading your profile...</p>
          </div>
        ) : user ? (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-4xl">😎</span>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-blue-900 mb-2">
                Awesome! You&apos;re in! 🎉
              </h1>
              <p className="text-gray-600 mb-1">Welcome back,</p>
              <p className="text-xl font-semibold text-blue-800">
                {user.email ?? "Cool Person"}
              </p>
              
              <p className="text-gray-600 mt-4 mb-1">Your wallet address:</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
                {address || "Loading address..."}
              </p>
              
              {/* Claim Status */}
              {claimStatus && (
                <div className={`mt-4 p-3 rounded-lg ${claimComplete ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <p className="text-sm font-medium">
                    {claimStatus}
                  </p>
                  {claimComplete && claimResponse && (
                    <div className="text-sm text-green-600 mt-1">
                      {claimResponse.amountClaimed && <p>Amount claimed: {claimResponse.amountClaimed} USDC</p>}
                      {claimResponse.transactionHash && (
                        <p className="text-xs mt-1">TX: {claimResponse.transactionHash.substring(0, 10)}...</p>
                      )}
                    </div>
                  )}
                  {claimError && (
                    <p className="text-sm text-red-600 mt-1">
                      {claimError}
                    </p>
                  )}
                </div>
              )}
              
              {/* Transaction Details */}
              {claimComplete && claimResponse && claimResponse.transactionHash && (
                <TransactionDetails txData={claimResponse} />
              )}
              
              {/* Try again button */}
              {address && claimComplete && (
                <button
                  className="mt-4 py-2 px-4 bg-green-600 text-white rounded-xl font-medium
                            transition-all hover:bg-green-700 active:scale-95"
                  onClick={() => {
                    setClaimStatus("");
                    setClaimComplete(false);
                    setClaimError("");
                    setClaimResponse(null);
                    claimFunds(user.email || "", address);
                  }}
                >
                  Try Claim Again
                </button>
              )}
            </div>
            <button 
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium
                        transition-all hover:bg-blue-700 hover:scale-105 active:scale-95"
              onClick={() => logout()}
            >
              Log out 👋
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="w-28 h-28 mb-2">
              {/* Replace with your actual logo/emoji character */}
              <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">🙂</span>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-blue-900 mb-3">G&apos;day Welcome to Mullet!</h1>
              <p className="text-gray-600 mb-6">Click the button below to get started!</p>
            </div>
            <button 
              className="w-full py-4 px-6 bg-blue-600 text-white rounded-xl font-medium text-lg
                        transition-all hover:bg-blue-700 hover:scale-105 active:scale-95 shadow-md"
              onClick={openAuthModal}
            >
              Let&apos;s Go! 🚀
            </button>
            <p className="text-sm text-gray-500 mt-4">
              No account? No worries! You can sign up too.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}