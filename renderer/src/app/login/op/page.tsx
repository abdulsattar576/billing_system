"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OpLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Please enter username and password");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/couchdb-login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      router.push("/dashboard");
    } else {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/30">
        <div className="flex flex-col lg:flex-row">
          {/* Left side - Login Form */}
          <div className="lg:w-3/5 p-12 lg:p-16">
            <div className="max-w-lg mx-auto">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-gray-800 mb-3">Operator Login</h2>
                <p className="text-gray-500 text-lg">Enter your operator credentials to access the system</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Operator Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                    <input
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 bg-white"
                      placeholder="Enter operator username"
                      onChange={(e) => setUsername(e.target.value)}
                      value={username}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                      </svg>
                    </div>
                    <input
                      type="password"
                      className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 bg-white"
                      placeholder="Enter password"
                      onChange={(e) => setPassword(e.target.value)}
                      value={password}
                      onKeyPress={(e) => e.key === 'Enter' && login()}
                    />
                  </div>
                </div>

                <button
                  onClick={login}
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xl font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Authenticating...
                    </span>
                  ) : (
                    "Login as Operator"
                  )}
                </button>

                <div className="text-center pt-4 border-t border-gray-100">
                  <p className="text-gray-500">
                    Forgot password?{" "}
                    <a href="#" className="text-emerald-600 hover:text-emerald-800 font-medium transition">
                      Reset Here
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Illustration/Info */}
          <div className="lg:w-2/5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-12 flex flex-col justify-center">
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <h1 className="text-4xl font-bold mb-4">Operator Console</h1>
              <p className="text-emerald-100 text-lg leading-relaxed">
                Access customer management tools, process transactions, and handle daily operations.
                Designed for efficient workflow and smooth customer interactions.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-3"></div>
                <span className="text-emerald-100">Customer management</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-3"></div>
                <span className="text-emerald-100">Transaction processing</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-300 rounded-full mr-3"></div>
                <span className="text-emerald-100">Service requests</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}