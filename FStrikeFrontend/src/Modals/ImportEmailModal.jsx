import React, { useState } from "react";
import { FaTimes, FaFileImport, FaCode, FaLink } from "react-icons/fa";
import config from "../config/apiConfig";

const ImportEmailModal = ({ isOpen, onClose, onSuccess }) => {
  const [rawEmailSource, setRawEmailSource] = useState("");
  const [changeLinks, setChangeLinks] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!rawEmailSource.trim()) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/import_email`, {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div className="glass-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-cyber-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaFileImport className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">Import Email</h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <p className="text-cyber-muted text-sm mt-2 relative z-10">
            Import email content from HTML source code
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaCode />
              <span>Email Source Code</span>
            </label>
            <textarea
              value={rawEmailSource}
              onChange={(e) => setRawEmailSource(e.target.value)}
              className="glass-select w-full px-4 py-3 rounded-lg resize-none"
              placeholder="Paste your email HTML source code here..."
              rows={12}
              required
            />
            <p className="text-cyber-muted text-xs mt-2">
              Paste the complete HTML source of the email you want to import
            </p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="changeLinks"
                checked={changeLinks}
                onChange={(e) => setChangeLinks(e.target.checked)}
                className="w-4 h-4 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50"
              />
              <label
                htmlFor="changeLinks"
                className="text-cyber-secondary font-medium flex items-center space-x-2"
              >
                <FaLink />
                <span>Convert links to tracking links</span>
              </label>
            </div>
            <div className="mt-3 bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
              <p className="text-cyber-primary font-medium text-sm mb-1">🔗 Link Conversion Features:</p>
              <ul className="text-cyber-muted text-xs space-y-1">
                <li>• Automatically converts URLs to trackable links</li>
                <li>• Monitors click-through rates and engagement</li>
                <li>• Preserves original link functionality</li>
                <li>• Real-time analytics integration</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-cyber-primary/20 px-6 py-4 space-x-3">
          <button
            onClick={onClose}
            className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!rawEmailSource.trim() || loading}
            className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="loading-spinner w-4 h-4"></div>
                <span>Importing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <FaFileImport />
                <span>Import Email</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportEmailModal;
