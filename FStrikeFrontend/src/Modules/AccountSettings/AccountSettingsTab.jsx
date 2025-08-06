import React from "react";
import { FaSave, FaKey, FaUser, FaShieldAlt, FaLock } from "react-icons/fa";

const AccountSettingsTab = () => {
  // You could manage state for these fields or fetch from an API.
  // For demonstration, we use static placeholders.
  const ApolloStrikeVersion = "2.0";
  const apiKey = "805a0a1a5e9e5b2486645810172d7d6a2a0241432a461b6fa84bba0e";
  const username = "admin";

  const handleResetApiKey = () => {
    // Logic for resetting API key goes here
    alert("API Key reset triggered");
  };

  const handleSave = () => {
    // Logic for saving account settings goes here
    alert("Account settings saved");
  };

  return (
    <div className="mt-6 max-w-4xl mx-auto">
      {/* System Information Section */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-cyber-primary text-lg font-semibold mb-4 flex items-center space-x-2">
          <FaShieldAlt />
          <span>System Information</span>
        </h3>
        <div className="flex justify-between items-center py-3 border-b border-cyber-primary/20">
          <span className="text-cyber-muted">C-Strike Version</span>
          <span className="text-cyber-primary font-mono">{ApolloStrikeVersion}</span>
        </div>
      </div>

      {/* API Configuration Section */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-cyber-primary text-lg font-semibold mb-4 flex items-center space-x-2">
          <FaKey />
          <span>API Configuration</span>
        </h3>
        <div className="flex justify-between items-center py-3">
          <label className="text-cyber-muted font-medium">API Key</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              className="glass-select px-4 py-2 w-80 rounded-l-lg font-mono text-sm"
              value={apiKey}
              readOnly
            />
            <button
              className="glass-button px-4 py-2 rounded-r-lg hover:scale-105 transition-transform"
              onClick={handleResetApiKey}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Account Security Section */}
      <div className="glass-card p-6">
        <h3 className="text-cyber-primary text-lg font-semibold mb-6 flex items-center space-x-2">
          <FaUser />
          <span>Account Security</span>
        </h3>
        
        <div className="space-y-6">
          {/* Username */}
          <div className="flex justify-between items-center">
            <label className="text-cyber-muted font-medium w-48">Username</label>
            <input
              type="text"
              className="glass-select px-4 py-2 w-80 rounded-lg"
              defaultValue={username}
            />
          </div>

          {/* Password Section */}
          <div className="space-y-4 pt-4 border-t border-cyber-primary/20">
            <h4 className="text-cyber-secondary font-medium flex items-center space-x-2">
              <FaLock />
              <span>Password Management</span>
            </h4>
            
            <div className="flex justify-between items-center">
              <label className="text-cyber-muted font-medium w-48">Current Password</label>
              <input
                type="password"
                className="glass-select px-4 py-2 w-80 rounded-lg"
                placeholder="Enter current password"
              />
            </div>

            <div className="flex justify-between items-center">
              <label className="text-cyber-muted font-medium w-48">New Password</label>
              <input
                type="password"
                className="glass-select px-4 py-2 w-80 rounded-lg"
                placeholder="Enter new password"
              />
            </div>

            <div className="flex justify-between items-center">
              <label className="text-cyber-muted font-medium w-48">Confirm Password</label>
              <input
                type="password"
                className="glass-select px-4 py-2 w-80 rounded-lg"
                placeholder="Confirm new password"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8 pt-6 border-t border-cyber-primary/20">
          <button
            className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
            onClick={handleSave}
          >
            <FaSave />
            <span className="font-medium">Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsTab;
