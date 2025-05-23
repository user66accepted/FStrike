import React, { useState, useEffect } from "react";
import { FaFileImport } from "react-icons/fa";
import RichTextEditor from "../Utils/RichTextEditor";
import ImportSiteModal from "./ImportSiteModal";

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
                ? `http://147.93.87.182:5000/api/UpdatePage/${editData.id}`
                : "http://147.93.87.182:5000/api/SavePage";
                
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30 backdrop-blur-md">
            <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-gray-300">
                    <h2 className="text-3xl font-semibold">{editData ? 'Edit Landing Page' : 'New Landing Page'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Name:</label>
                            <input
                                type="text"
                                value={pageName}
                                required
                                onChange={(e) => setPageName(e.target.value)}
                                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                                placeholder="Page name"
                            />
                        </div>
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="mt-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md flex items-center gap-2 cursor-pointer"
                        >
                            <FaFileImport /> Import Site
                        </button>
                    </div>
                    <div>
                        <RichTextEditor value={getHtmlContentWithTracking()} onChange={setHtmlContent} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={captureSubmittedData}
                            onChange={(e) => setCaptureSubmittedData(e.target.checked)}
                            id="captureSubmittedData"
                            className="form-checkbox w-6 h-6"
                        />
                        <label htmlFor="captureSubmittedData" className="text-sm font-medium text-gray-700">
                            Capture Submitted Data
                        </label>
                    </div>
                    {captureSubmittedData && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Redirect to:</label>
                            <input
                                type="text"
                                value={redirectTo}
                                onChange={(e) => setRedirectTo(e.target.value)}
                                placeholder="www.example.com"
                                pattern="^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$"
                                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    )}
                    <div className="flex justify-end gap-4 mt-4">
                        <button
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-black font-semibold py-2 px-4 rounded-md cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSavePage}
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md cursor-pointer"
                        >
                            {editData ? 'Save Changes' : 'Save Page'}
                        </button>
                    </div>
                </div>
            </div>
            {/* Import Email Modal */}
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
