import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login as loginAction } from "../Store/authSlice";
import { motion } from "framer-motion";
import { login } from "../services/apiService";
import { FaUser, FaLock, FaShieldAlt, FaSignInAlt } from "react-icons/fa";

export default function LoginCard() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem("authToken", data.token);
      dispatch(loginAction(data.user));
      console.log("Login successful:", data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="glass-card w-[500px] overflow-hidden relative"
      >
        {/* Header Section */}
        <div className="relative p-8 border-b border-cyber-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <FaShieldAlt className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">System Access</h2>
            </div>
            <p className="text-cyber-muted text-sm">
              Secure authentication required • Authorized personnel only
            </p>
          </div>
        </div>

        {/* Login Form Section */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
          className="p-8 space-y-6"
        >
          {/* Username Input */}
          <div className="space-y-2">
            <label className="text-cyber-muted text-sm font-medium flex items-center space-x-2">
              <FaUser />
              <span>Username</span>
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              className="glass-select w-full px-4 py-3 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-cyber-primary/50"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-cyber-muted text-sm font-medium flex items-center space-x-2">
              <FaLock />
              <span>Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="glass-select w-full px-4 py-3 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-cyber-primary/50"
            />
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-400/10 border border-red-400/20 text-red-400 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading || !username || !password}
            className="w-full glass-button px-6 py-4 rounded-lg flex items-center justify-center space-x-2 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <div className="loading-spinner w-5 h-5"></div>
            ) : (
              <>
                <FaSignInAlt />
                <span className="font-semibold">AUTHENTICATE</span>
              </>
            )}
          </button>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-cyber-primary/20">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-cyber-secondary rounded-full animate-pulse"></div>
              <span className="text-xs text-cyber-muted font-mono">SECURE CONNECTION ESTABLISHED</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
