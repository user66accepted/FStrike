import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { login as loginAction } from "../Store/authSlice"; // Adjust the path as needed
import { motion } from "framer-motion";
import { login } from "../services/apiService";

export default function LoginCard() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate(); // Initialize navigate

  const handleLogin = async () => {
    setError("");
    try {
      const data = await login(username, password);

      // Save token to local storage
      localStorage.setItem("authToken", data.token);

      // Dispatch login action to Redux with the user object
      dispatch(loginAction(data.user));

      console.log("Login successful:", data);

      // Redirect to home page
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-gray-100 shadow-xl rounded-[36px] flex w-[620px] h-[380px] overflow-hidden relative">
        {/* Left Section with Background Image and Overlay */}
        <div
          className="relative w-[280px] flex flex-col items-center justify-center px-6 
                     rounded-bl-2xl rounded-tr-[50px] rounded-br-[50px] text-white"
          style={{ backgroundImage: "url('/welcome_bg.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-black opacity-60 rounded-bl-2xl rounded-tr-[50px] rounded-br-[50px]"></div>
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold">Welcome</h2>
            <p className="text-sm mt-8">
              FStrike is a proprietary solution developed and maintained by Cyber Div 101
            </p>
          </div>
        </div>

        {/* Right Section with Rolling Animation */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="w-1/2 flex flex-col justify-center px-6 absolute right-5 top-0 h-full bg-gray-100"
        >
          <h2 className="text-xl font-bold text-slate-700">Sign In</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-4 px-3 py-2 w-full border rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 px-3 py-2 w-full border rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {error && <p className="text-red-500 mt-2">{error}</p>}
          <button
            onClick={handleLogin}
            className="mt-4 w-full bg-slate-700 text-white py-2 rounded-md font-semibold hover:bg-slate-800 transition cursor-pointer"
          >
            LOGIN
          </button>
        </motion.div>
      </div>
    </div>
  );
}
