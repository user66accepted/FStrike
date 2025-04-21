import React from "react";
import { FaSave } from "react-icons/fa";

const AccountSettingsTab = () => {
  // You could manage state for these fields or fetch from an API.
  // For demonstration, we use static placeholders.
  const ApolloStrikeVersion = "0.1.1";
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
    <div className="mt-8 w-1/2">
      <div className="mb-4 flex justify-between">
        <p className="block text-gray-700 font-semibold">ApolloStrike version</p>
        <p>{ApolloStrikeVersion}</p>
      </div>

      <div className="mb-4 flex justify-between">
        <label className="block text-gray-700 font-semibold">API Key</label>
        <div className="flex">
          <input
            type="text"
            className="border border-gray-200 rounded-l px-3 py-2 w-[450px] bg-gray-50 text-gray-400 text-sm"
            value={apiKey}
            readOnly
          />
          <button
            className="bg-teal-500 text-white px-4 py-2 rounded-r hover:bg-teal-600 cursor-pointer"
            onClick={handleResetApiKey}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-4 flex justify-between">
        <label className="block text-gray-700 font-semibold">Username</label>
        <input
          type="text"
          className="border border-gray-300 rounded px-3 py-2 w-[520px]"
          defaultValue={username}
        />
      </div>

      <div className="mb-4 flex justify-between">
        <label className="block text-gray-700 font-semibold">Old Password</label>
        <input
          type="password"
          className="border border-gray-300 rounded px-3 py-2 w-[520px]"
          placeholder="Enter old password"
        />
      </div>

      <div className="mb-4 flex justify-between">
        <label className="block text-gray-700 font-semibold">New Password</label>
        <input
          type="password"
          className="border border-gray-300 rounded px-3 py-2 w-[520px]"
          placeholder="Enter new password"
        />
      </div>

      <div className="mb-4 flex justify-between">
        <label className="block text-gray-700 font-semibold">Confirm New Password</label>
        <input
          type="password"
          className="border border-gray-300 rounded px-3 py-2 w-[520px]"
          placeholder="Confirm new password"
        />
      </div>

      <button
        className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 cursor-pointer flex items-center gap-2"
        onClick={handleSave}
      >
        <FaSave />
        Save
      </button>
    </div>
  );
};

export default AccountSettingsTab;
