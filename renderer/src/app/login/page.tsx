"use client";

import { useRouter } from "next/navigation";
// import React, { useState } from "react";
import React, { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "op">("admin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // test code start
  // const [showServerConfig, setShowServerConfig] = useState(false);

  // const [serverUrl, setServerUrl] = useState(
  //   localStorage.getItem("server_url") || "http://192.168.1.116:5984"
  // );

  // const [serverDB, setServerDB] = useState(
  //   localStorage.getItem("server_db") || "db_fcn"
  // );

  // const [serverUser, setServerUser] = useState(
  //   localStorage.getItem("server_user") || "admin"
  // );

  // const [serverPass, setServerPass] = useState(
  //   localStorage.getItem("server_pass") || "512141"
  // );
  const [showServerConfig, setShowServerConfig] = useState(false);

  const [serverUrl, setServerUrl] = useState("http://192.168.1.207:5984");
  const [serverDB, setServerDB] = useState("db_fcn");
  const [serverUser, setServerUser] = useState("admin");
  const [serverPass, setServerPass] = useState("512141");

  useEffect(() => {
    const savedUrl = localStorage.getItem("server_url");
    const savedDB = localStorage.getItem("server_db");
    const savedUser = localStorage.getItem("server_user");
    const savedPass = localStorage.getItem("server_pass");

    if (savedUrl) setServerUrl(savedUrl);
    if (savedDB) setServerDB(savedDB);
    if (savedUser) setServerUser(savedUser);
    if (savedPass) setServerPass(savedPass);
  }, []);

  // test code end

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const db = await initDB();
      if (!db) throw new Error("DB not available");

      if (mode === "signup") {
        await db.createUser(username, password, role);
        setSuccess("User created successfully! Please login.");
        setMode("login");
      } else if (mode === "login") {
        const user = await db.getUser(username, password);
        console.log("Login response:", user); // Debugging log

        // Trust the result of db.getUser
        if (user) {
          console.log("Login successful, redirecting..."); // Debugging log
          localStorage.setItem("role", user.role);
          localStorage.setItem("username", user.username);
          localStorage.setItem("server_url", serverUrl);
          localStorage.setItem("server_db", serverDB);
          localStorage.setItem("server_user", serverUser);
          localStorage.setItem("server_pass", serverPass);
          if (user.role === "admin") {
            router.push("/dashboard");
          } else {
            router.push("/op");
          }
        } else {
          console.error("Invalid username or password"); // Debugging log
          setError("Invalid username or password");
        }
      } else if (mode === "forgot") {
        const users = await db.getAllUsers();
        const user = users.find(
          (u: any) => u.username === username.toLowerCase(),
        );
        if (user && "password" in user && typeof user.password === "string") {
          setSuccess(`Password hint: ${atob(user.password).slice(0, 2)}**`);
        } else {
          setError("User not found");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  const saveServerConfig = async () => {
    try {
      const testUrl = `${serverUrl}/_up`;

      const res = await fetch(testUrl);

      if (!res.ok) {
        throw new Error("Server not reachable");
      }

      localStorage.setItem("server_url", serverUrl);
      localStorage.setItem("server_db", serverDB);
      localStorage.setItem("server_user", serverUser);
      localStorage.setItem("server_pass", serverPass);

      alert("Server connected successfully");

      window.location.reload();
    } catch (err) {
      if (err instanceof Error) {
        alert(err);
      }
      alert("Cannot connect to server. Please check the IP.");
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center p-4 relative">
      <button
        onClick={() => setShowServerConfig(true)}
        className="absolute top-6 left-6 bg-gray-800 hover:bg-gray-700 p-3 rounded-xl text-white shadow-lg"
      >
        ⚙
      </button>
      <div className="w-full max-w-5xl bg-gray-900/80 backdrop-blur-lg border border-gray-700 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left side - Brand/Info */}
          <div className="lg:w-2/5 bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-12 flex flex-col justify-center">
            <div className="text-center lg:text-left">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto lg:mx-0 mb-8">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
                Family Cable Network
              </h1>
              <p className="text-gray-300 text-lg leading-relaxed">
                Advanced cable network management system with role-based access
                control, real-time analytics, and comprehensive customer
                management tools.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 p-4 rounded-xl">
                  <div className="text-blue-400 font-semibold mb-1">Admin</div>
                  <div className="text-gray-400 text-sm">
                    Full system control
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-xl">
                  <div className="text-emerald-400 font-semibold mb-1">
                    Operator
                  </div>
                  <div className="text-gray-400 text-sm">Daily operations</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Form */}
          <div className="lg:w-3/5 p-12 lg:p-16">
            <div className="max-w-lg mx-auto">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-white mb-3">
                  {mode === "login"
                    ? "Welcome Back"
                    : mode === "signup"
                      ? "Create Account"
                      : "Reset Password"}
                </h2>
                <p className="text-gray-400 text-lg">
                  {mode === "login"
                    ? "Sign in to your account"
                    : mode === "signup"
                      ? "Register for a new account"
                      : "Recover your account access"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        ></path>
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-white placeholder-gray-500"
                      placeholder="Enter username"
                      required
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          ></path>
                        </svg>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-white placeholder-gray-500"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                  </div>
                )}

                {mode === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Role
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          ></path>
                        </svg>
                      </div>
                      <select
                        value={role}
                        onChange={(e) =>
                          setRole(e.target.value as "admin" | "op")
                        }
                        className="w-full pl-12 pr-4 py-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-white appearance-none"
                      >
                        <option value="admin">Administrator</option>
                        <option value="op">Operator</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-red-400 text-center">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-900/30 border border-green-700/50 rounded-xl">
                    <p className="text-green-400 text-center">{success}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white text-xl font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </span>
                  ) : mode === "login" ? (
                    "Sign In"
                  ) : mode === "signup" ? (
                    "Create Account"
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>

              <div className="mt-10 text-center space-y-4">
                {mode === "login" && (
                  <>
                    <button
                      onClick={() => setMode("signup")}
                      className="text-blue-400 hover:text-blue-300 font-medium transition block"
                    >
                      Don't have an account?{" "}
                      <span className="underline">Sign up here</span>
                    </button>
                    <button
                      onClick={() => setMode("forgot")}
                      className="text-gray-400 hover:text-gray-300 text-sm transition block"
                    >
                      Forgot your password?
                    </button>
                  </>
                )}
                {mode !== "login" && (
                  <button
                    onClick={() => setMode("login")}
                    className="text-blue-400 hover:text-blue-300 font-medium transition"
                  >
                    ← Back to Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showServerConfig && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-2xl w-[400px] border border-gray-700">
            <h3 className="text-xl text-white mb-6 font-semibold">
              Configure Server
            </h3>

            <div className="space-y-4">
              <input
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Server URL"
              />

              <input
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700"
                value={serverDB}
                onChange={(e) => setServerDB(e.target.value)}
                placeholder="Database Name"
              />

              <input
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700"
                value={serverUser}
                onChange={(e) => setServerUser(e.target.value)}
                placeholder="Username"
              />

              <input
                type="password"
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700"
                value={serverPass}
                onChange={(e) => setServerPass(e.target.value)}
                placeholder="Password"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowServerConfig(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={saveServerConfig}
                className="px-4 py-2 bg-blue-600 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
