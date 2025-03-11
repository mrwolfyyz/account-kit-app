"use client";
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
  const { client, address, isLoadingClient } = useSmartAccountClient({
    // Optional: specify a policy ID for gas sponsorship
    // policyId: "YOUR_POLICY_ID",
    // Using ModularAccountV2 as recommended (this is the default)
    type: "ModularAccountV2"
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 transition-all duration-300 hover:shadow-xl">
        {signerStatus.isInitializing || isLoadingClient ? (
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
              
              {address ? (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Your wallet address:</p>
                  <p className="text-sm font-mono bg-white p-2 rounded border border-gray-200 break-all">
                    {address}
                  </p>
                </div>
              ) : null}
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