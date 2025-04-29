import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";

const ImportEmailModal = ({ isOpen, onClose, onSuccess }) => {
  const [rawEmailSource, setRawEmailSource] = useState("");
  const [changeLinks, setChangeLinks] = useState(true);

  if (!isOpen) return null;

  const handleImport = async () => {
    try {
      const response = await fetch("http://161.97.104.136:5000/api/import_email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: rawEmailSource,
          convert_links: changeLinks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to import email");
      }

      const data = await response.json();
      console.log("Import successful:", data);

      // Call onSuccess to pass data back to the parent component
      if (onSuccess) {
        onSuccess(data);
      }

      alert("Email imported successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error importing email: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Import Email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email Content:
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 mt-1 h-40"
              placeholder="Raw Email Source"
              value={rawEmailSource}
              onChange={(e) => setRawEmailSource(e.target.value)}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              className="mr-2"
              checked={changeLinks}
              onChange={(e) => setChangeLinks(e.target.checked)}
            />
            <label className="text-sm text-gray-700">
              Change Links to Point to Landing Page
            </label>
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

export default ImportEmailModal;
