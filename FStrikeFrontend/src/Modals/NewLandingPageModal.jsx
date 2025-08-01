import React, { useState, useEffect } from "react";
import { FaFileImport, FaTimes, FaGlobe, FaCode, FaToggleOn, FaToggleOff, FaExternalLinkAlt } from "react-icons/fa";
import RichTextEditor from "../Utils/RichTextEditor";
import ImportSiteModal from "./ImportSiteModal";
import config from "../config/apiConfig";

const NewLandingPageModal = ({ isOpen, onClose, onSave, editData }) => {
    const [pageName, setPageName] = useState("");
    const [htmlContent, setHtmlContent] = useState("");
    const [showImportModal, setShowImportModal] = useState(false);
    const [captureSubmittedData, setCaptureSubmittedData] = useState(false);
    const [redirectTo, setRedirectTo] = useState("");

    // Load edit data if provided
    useEffect(() => {
        if (editData) {
            setPageName(editData.page_name);
            setHtmlContent(editData.html_content);
            setCaptureSubmittedData(editData.capture_submitted_data === 1);
            setRedirectTo(editData.redirect_url || "");
        } else {
            // Reset form when opening for new page
            setPageName("");
            setHtmlContent("");
            setCaptureSubmittedData(false);
            setRedirectTo("");
        }
    }, [editData]);

    // Handles successful email import from modal
    const handleImportEmailSuccess = (importedData) => {
        setHtmlContent(importedData.html || "");
        setShowImportModal(false);
    };

    // Inject tracking image if enabled
    const getHtmlContentWithTracking = () => {
        return htmlContent;
    };

    // Validate required fields before saving
    const validateFields = () => {
        if (!pageName.trim()) {
            alert("Please enter a page name.");
            return false;
        }
        if (!htmlContent.trim()) {
            alert("Please enter HTML content.");
            return false;
        }
        if (captureSubmittedData && !redirectTo.trim()) {
            alert("Please enter a redirect URL.");
            return false;
        }
        return true;
    };

    // Send the data to the backend API
    const handleSavePage = async () => {
        if (!validateFields()) return;

        const payload = {
            pageName,
            htmlContent,
            captureSubmittedData,
            redirectTo: captureSubmittedData ? redirectTo : null,
        };

        try {
            const url = editData 
                ? `${config.API_BASE_URL}/UpdatePage/${editData.id}`
                : `${config.API_BASE_URL}/SavePage`;
                
            const response = await fetch(url, {
                method: editData ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save page");
            } else {
                const result = await response.json();
                console.log(editData ? "Page updated successfully:" : "Page saved successfully:", result);
                if (onSave) onSave();
                onClose();
            }
        } catch (error) {
            console.error("Error saving page:", error);
            alert(error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
            <div className="glass-card w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="relative p-6 border-b border-cyber-primary/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
                    <div className="relative z-10 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <FaGlobe className="text-cyber-primary text-2xl" />
                            <h2 className="text-2xl font-bold text-cyber-primary">
                                {editData ? 'Edit Landing Page' : 'Create Landing Page'}
                            </h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
                        >
                            <FaTimes size={20} />
                        </button>
                    </div>
                    <p className="text-cyber-muted text-sm mt-2 relative z-10">
                        Design compelling landing pages for phishing simulations
                    </p>
                </div>

                {/* Form Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Page Name and Import */}
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-cyber-muted text-sm font-medium mb-2">Page Name</label>
                            <input
                                type="text"
                                value={pageName}
                                required
                                onChange={(e) => setPageName(e.target.value)}
                                className="glass-select w-full px-4 py-3 rounded-lg"
                                placeholder="Enter landing page name"
                            />
                        </div>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="glass-button px-4 py-3 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
                        >
                            <FaFileImport />
                            <span>Import Site</span>
                        </button>
                    </div>

                    {/* HTML Content Editor */}
                    <div>
                        <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                            <FaCode />
                            <span>HTML Content</span>
                        </label>
                        <div className="glass-card p-4">
                            <RichTextEditor value={getHtmlContentWithTracking()} onChange={setHtmlContent} />
                        </div>
                    </div>

                    {/* Data Capture Options */}
                    <div className="glass-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <label htmlFor="captureSubmittedData" className="text-cyber-secondary font-medium flex items-center space-x-2">
                                    {captureSubmittedData ? (
                                        <FaToggleOn className="text-cyber-primary text-xl" />
                                    ) : (
                                        <FaToggleOff className="text-cyber-muted text-xl" />
                                    )}
                                    <span>Capture Submitted Data</span>
                                </label>
                            </div>
                            <input
                                type="checkbox"
                                checked={captureSubmittedData}
                                onChange={(e) => setCaptureSubmittedData(e.target.checked)}
                                id="captureSubmittedData"
                                className="w-4 h-4 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50"
                            />
                        </div>

                        {captureSubmittedData && (
                            <div className="mt-4">
                                <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                                    <FaExternalLinkAlt />
                                    <span>Redirect URL</span>
                                </label>
                                <input
                                    type="text"
                                    value={redirectTo}
                                    onChange={(e) => setRedirectTo(e.target.value)}
                                    placeholder="www.example.com"
                                    pattern="^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$"
                                    className="glass-select w-full px-4 py-3 rounded-lg"
                                />
                                <div className="mt-2 bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
                                    <p className="text-cyber-primary font-medium text-sm mb-1">📊 Data Collection Active</p>
                                    <p className="text-cyber-muted text-xs">
                                        Form submissions will be captured and users redirected to the specified URL
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-cyber-primary/20 px-6 py-4 space-x-3">
                    <button
                        onClick={onClose}
                        className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSavePage}
                        className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform"
                    >
                        <div className="flex items-center space-x-2">
                            <FaGlobe />
                            <span>{editData ? 'Save Changes' : 'Create Page'}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Import Site Modal */}
            {showImportModal && (
                <ImportSiteModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={handleImportEmailSuccess}
                />
            )}
        </div>
    );
};

export default NewLandingPageModal;
