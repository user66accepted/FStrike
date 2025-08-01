import React, { useState } from "react";
import { FaTimes, FaGlobe, FaDownload, FaLink } from "react-icons/fa";
import { extractSite } from "../services/apiService";

const ImportSiteModal = ({ isOpen, onClose, onSuccess }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!url.trim()) {
      return;
    }

    try {
      setLoading(true);
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
              <FaGlobe className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">Import Website</h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <p className="text-cyber-muted text-sm mt-2 relative z-10">
            Extract and import website content for landing page creation
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaLink />
              <span>Website URL</span>
            </label>
            <input
              type="text"
              className="glass-select w-full px-4 py-3 rounded-lg"
              placeholder="Enter website URL (e.g., www.google.com, facebook.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-cyber-muted text-xs mt-2">
              Enter the complete URL of the website you want to import and clone
            </p>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-cyber-secondary font-medium mb-3 flex items-center space-x-2">
              <FaDownload />
              <span>Import Features</span>
            </h3>
            <div className="bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
              <p className="text-cyber-primary font-medium text-sm mb-2">🌐 Website Extraction Capabilities:</p>
              <ul className="text-cyber-muted text-xs space-y-1">
                <li>• Complete HTML structure preservation</li>
                <li>• Automatic CSS and JavaScript extraction</li>
                <li>• Image and asset downloading</li>
                <li>• Form element identification and tracking</li>
                <li>• Responsive design maintenance</li>
                <li>• SEO metadata preservation</li>
              </ul>
            </div>
          </div>

          {url && (
            <div className="glass-card p-4">
              <h4 className="text-cyber-secondary font-medium mb-2">Preview URL:</h4>
              <div className="bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
                <code className="text-cyber-primary text-sm break-all">{url}</code>
              </div>
            </div>
          )}
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
            disabled={!url.trim() || loading}
            className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="loading-spinner w-4 h-4"></div>
                <span>Importing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <FaDownload />
                <span>Import Website</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSiteModal;
