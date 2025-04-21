import React from 'react'
import { useState } from "react";
import { FaTachometerAlt, FaBullhorn, FaUsers, FaEnvelope, FaFileAlt, FaPaperPlane, FaCogs, FaUserShield, FaLink, FaBook, FaCode } from "react-icons/fa";

const Sidebar = ({ activeItem, setActiveItem }) => {
    const menuItems = [
      { name: "Dashboard", icon: <FaTachometerAlt /> },
      { name: "Campaigns", icon: <FaBullhorn /> },
      { name: "Users & Groups", icon: <FaUsers /> },
      { name: "Email Templates", icon: <FaEnvelope /> },
      { name: "Landing Pages", icon: <FaFileAlt /> },
      { name: "Sending Profiles", icon: <FaPaperPlane /> },
      { name: "Account Settings", icon: <FaCogs /> },
      { name: "User Settings", icon: <FaUserShield />, admin: true },
      { name: "Webhooks", icon: <FaLink />, admin: true },
    ];
  
    return (
      <aside className="w-64 h-screen bg-gray-100 p-4">
        <nav>
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li
                key={item.name}
                className={`p-2 rounded flex items-center gap-2 cursor-pointer transition-colors ${
                  activeItem === item.name ? "bg-slate-800 text-white" : "text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setActiveItem(item.name)}
              >
                {item.icon} {item.name}
                {item.admin && (
                  <span className="bg-gray-400 text-white text-xs px-2 py-1 rounded ml-auto">Admin</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    );
  };
  
  export default Sidebar;
  
