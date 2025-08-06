import React from "react";
import { useDispatch } from "react-redux";
import { logout } from "../Store/authSlice"; // Adjust the path if necessary
import { useNavigate } from "react-router-dom";
import { FaSignOutAlt, FaShieldAlt } from "react-icons/fa"; // Font Awesome Icons

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout()); // Clear Redux state
    localStorage.removeItem("authToken"); // Clear token from storage
    navigate("/login"); // Redirect to login page
  };

  return (
    <header className="header-glass fixed top-0 left-0 w-full z-50 px-6 py-4">
      {/* Left Section: Logo + App Name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <FaShieldAlt className="h-8 w-8 text-cyber-primary" />
            <div className="absolute inset-0 text-cyber-primary opacity-30 animate-ping">
              <FaShieldAlt className="h-8 w-8" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-cyber-primary tracking-tight">C-Strike</h1>
            <span className="text-xs text-cyber-muted tracking-wider uppercase">
              Security Framework v2.0
            </span>
          </div>
        </div>

        {/* Right Section: System Status and Controls */}
        <div className="flex items-center space-x-6">
          {/* System Clock */}
          <div className="text-sm text-cyber-muted">
            <div className="flex items-center space-x-2">
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* System Status */}
          <div className="glass-card px-3 py-1">
            <span className="text-xs text-cyber-primary uppercase tracking-wide">
              System Operational
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="glass-button flex items-center px-4 py-2 rounded-lg transition-all duration-300"
            title="Terminate Session"
          >
            <FaSignOutAlt className="mr-2 w-4 h-4" /> 
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
