import React from "react";
import { useDispatch } from "react-redux";
import { logout } from "../Store/authSlice"; // Adjust the path if necessary
import { useNavigate } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa"; // Font Awesome Logout Icon

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout()); // Clear Redux state
    localStorage.removeItem("authToken"); // Clear token from storage
    navigate("/login"); // Redirect to login page
  };

  return (
    <header className="bg-slate-800 text-white p-4 flex justify-between items-center fixed top-0 left-0 w-full z-50">
      {/* Left Section: Logo + App Name */}
      <div className="flex items-center">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="h-10 w-10 object-contain invert mr-3" // Adjust size & apply inversion
        />
        <h1 className="text-3xl font-bold">FStrike</h1>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="flex items-center bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition duration-300 cursor-pointer"
      >
        <FaSignOutAlt className="mr-2" /> Logout
      </button>
    </header>
  );
};

export default Header;
