import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { extractSite } from "../services/apiService";

const ImportSiteModal = ({ isOpen, onClose, onSuccess }) => {

  const [url, setUrl] = useState("");

  if (!isOpen) return null;

  const handleImport = async () => {
    try {
      const data = await extractSite(url);
      console.log("Import successful:", data);

      // Call onSuccess to pass data back to the parent component
      if (onSuccess) {
        onSuccess(data);
      }

      alert("Site imported successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error importing Site: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Import Site</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL:
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 mt-1"
              placeholder="Example: www.google.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSiteModal;
