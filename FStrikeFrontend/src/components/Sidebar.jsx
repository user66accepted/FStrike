import React from 'react'
import { useState } from "react";
import { FaTachometerAlt, FaBullhorn, FaUsers, FaEnvelope, FaFileAlt, FaPaperPlane, FaCogs, FaUserShield, FaLink, FaBook, FaCode, FaTerminal, FaShieldAlt } from "react-icons/fa";

const Sidebar = ({ activeItem, setActiveItem }) => {
    const menuItems = [
      { name: "Dashboard", icon: <FaTachometerAlt />, label: "Command Center", desc: "Real-time Analytics" },
      { name: "Campaigns", icon: <FaBullhorn />, label: "Operations", desc: "Campaign Management" },
      { name: "Users & Groups", icon: <FaUsers />, label: "Targets", desc: "User Database" },
      { name: "Email Templates", icon: <FaEnvelope />, label: "Payloads", desc: "Email Templates" },
      { name: "Landing Pages", icon: <FaFileAlt />, label: "Assets", desc: "Landing Pages" },
      { name: "Sending Profiles", icon: <FaPaperPlane />, label: "Profiles", desc: "SMTP Configuration" },
      { name: "Account Settings", icon: <FaCogs />, label: "Settings", desc: "Configuration" },
      { name: "User Settings", icon: <FaUserShield />, label: "Admin", desc: "User Management", admin: true },
      { name: "Webhooks", icon: <FaLink />, label: "Webhooks", desc: "API Integration", admin: true },
    ];
  
    return (
      <aside className="sidebar-glass w-80 h-screen fixed left-0 top-20 p-6 overflow-y-auto">
        {/* Sidebar Header */}
        <div className="mb-8">
          <div className="glass-card p-4 text-center">
            <FaTerminal className="h-6 w-6 text-cyber-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-cyber-primary mb-1">System Modules</h2>
            <p className="text-xs text-cyber-muted">Security Operations Center</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={item.name}
              className={`w-full p-4 rounded-xl flex items-center space-x-4 transition-all duration-300 group ${
                activeItem === item.name 
                  ? "glass-card text-cyber-primary shadow-lg" 
                  : "text-cyber-muted hover:glass-card hover:text-cyber-primary"
              }`}
              onClick={() => setActiveItem(item.name)}
            >
              {/* Icon */}
              <div className={`text-lg transition-all duration-300 ${
                activeItem === item.name ? 'text-cyber-primary' : 'text-cyber-muted group-hover:text-cyber-primary'
              }`}>
                {item.icon}
              </div>
              
              {/* Content */}
              <div className="flex-1 text-left">
                <div className={`font-medium text-sm ${
                  activeItem === item.name ? 'text-cyber-primary' : 'group-hover:text-cyber-primary'
                }`}>
                  {item.label}
                </div>
                <div className="text-xs text-cyber-muted opacity-75">
                  {item.desc}
                </div>
              </div>
              
              {/* Admin Badge */}
              {item.admin && (
                <div className="badge badge-danger text-xs">
                  Admin
                </div>
              )}
              
              {/* Active Indicator */}
              {activeItem === item.name && (
                <div className="w-1 h-8 bg-cyber-primary rounded-full status-indicator"></div>
              )}
            </button>
          ))}
        </nav>

        {/* System Status Footer */}
        <div className="mt-8">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between text-xs mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full status-indicator"></div>
                <span className="text-cyber-muted">Secure Connection</span>
              </div>
              <FaShieldAlt className="text-cyber-primary" />
            </div>
            <div className="text-xs text-cyber-muted space-y-1">
              <div>Framework v2.0.1</div>
              <div>Build: {Date.now().toString().slice(-6)}</div>
              <div>Uptime: {Math.floor(Date.now() / 1000 / 60)} min</div>
            </div>
          </div>
        </div>
      </aside>
    );
  };
  
  export default Sidebar;

