"use client";
import { useState } from "react";
import {
  useAuthModal,
  useLogout,
  useSignerStatus,
  useUser,
  useSmartAccountClient,
} from "@account-kit/react";

export default function Home() {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const signerStatus = useSignerStatus();
  const { logout } = useLogout();
  const { address } = useSmartAccountClient({});
  
  // Add these new state variables
  const [claimStatus, setClaimStatus] = useState("");
  const [claimComplete, setClaimComplete] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimResponse, setClaimResponse] = useState(null);
  
  // Simple function to test the API endpoint
  const testClaimApi = async () => {
    if (!user?.email || !address) {
      setClaimError("User email or wallet address not available");
      return;
    }
    
    try {
      setClaimStatus("Testing claim API...");
      
      const response = await fetch('/api/claim-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email,
          destinationWallet: address,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'API test failed');
      }
      
      setClaimStatus("API test successful!");
      setClaimResponse(data);
      setClaimComplete(true);
      
    } catch (error) {
      console.error("API test error:", error);
      setClaimError(error.message || "Failed to test API");
      setClaimStatus("API test failed");
    }
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
              
              {/* Add Test button for API */}
              {address && (
                <button
                  className="mt-4 py-2 px-4 bg-green-600 text-white rounded-xl font-medium
                            transition-all hover:bg-green-700 active:scale-95"
                  onClick={testClaimApi}
                >
                  Test Claim API
                </button>
              )}
              
              {/* API Test Status */}
              {claimStatus && (
                <div className={`mt-4 p-3 rounded-lg ${claimComplete ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <p className="text-sm font-medium">
                    {claimStatus}
                  </p>
                  {claimComplete && claimResponse && (
                    <div className="text-sm text-green-600 mt-1">
                      <pre className="whitespace-pre-wrap break-all bg-gray-100 p-2 rounded text-xs">
                        {JSON.stringify(claimResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                  {claimError && (
                    <p className="text-sm text-red-600 mt-1">
                      {claimError}
                    </p>
                  )}
                </div>
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