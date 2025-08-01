import React, { useState, useEffect } from "react";
import { FaFileImport, FaTrash, FaTimes, FaEnvelope, FaCode, FaImage, FaPaperclip } from "react-icons/fa";
import ImportEmailModal from "./ImportEmailModal";
import RichTextEditor from "../Utils/RichTextEditor";
import httpClient from "../services/httpClient";

// Basic email validation function
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Generate a UUID for tracking
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const NewTemplateModal = ({ isOpen, onClose, initialTemplate }) => {
  const [templateName, setTemplateName] = useState("");
  const [envelopeSender, setEnvelopeSender] = useState("");
  const [subject, setSubject] = useState("");
  const [activeTab, setActiveTab] = useState("text");
  const [addTrackingImage, setAddTrackingImage] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  // Attachments can be either File objects (new uploads) or existing attachment objects from the backend.
  const [attachments, setAttachments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // When initialTemplate changes, prefill state if editing
  useEffect(() => {
    if (initialTemplate) {
      setTemplateName(initialTemplate.template_name || "");
      setEnvelopeSender(initialTemplate.envelope_sender || "");
      setSubject(initialTemplate.subject || "");
      setTextContent(initialTemplate.text || "");
      setHtmlContent(initialTemplate.html || "");
      setAddTrackingImage(!!initialTemplate.add_tracking_image);
      setAttachments(initialTemplate.attachments || []);
    } else {
      setTemplateName("");
      setEnvelopeSender("");
      setSubject("");
      setTextContent("");
      setHtmlContent("");
      setAddTrackingImage(false);
      setAttachments([]);
    }
  }, [initialTemplate]);

  // Handles successful email import from modal
  const handleImportEmailSuccess = (importedData) => {
    setSubject(importedData.subject || "");
    setHtmlContent(importedData.html || "");
    setTextContent(importedData.text || "");
    setShowImportModal(false);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    // Append new files to attachments array
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDeleteFile = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Inject tracking image if enabled
  const getHtmlContentWithTracking = () => {
    if (addTrackingImage) {
      // Using multi-layer tracking approach for better compatibility
      const trackingId = generateUUID();
      return `${htmlContent}
        <!-- Email tracking -->
        <div style="line-height:0;font-size:0;height:0">
          <!-- Primary tracker -->
          <img src="https://ananthtech.ddns.net/tracker/${trackingId}.png?t=${Date.now()}" 
               width="1" 
               height="1" 
               border="0"
               style="height:1px!important;width:1px!important;border-width:0!important;margin:0!important;padding:0!important;display:block!important;overflow:hidden!important;opacity:0.99"
               alt="" />
          <!-- Secondary tracker (GIF format) -->
          <img src="https://ananthtech.ddns.net/track/${trackingId}/pixel.gif?t=${Date.now()}"
               style="display:none;width:1px;height:1px;"
               alt="" />
          <!-- Tertiary tracker -->
          <img src="https://ananthtech.ddns.net/t/${trackingId}/p.png?t=${Date.now()}"
               style="visibility:hidden;width:1px;height:1px;"
               alt="" />
        </div>`;
    }
    return htmlContent;
  };

  const totalPages = Math.ceil(attachments.length / itemsPerPage);
  const paginatedAttachments = attachments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSaveTemplate = async () => {
    // Basic field validation
    if (!templateName.trim()) {
      alert("Template name is required.");
      return;
    }
    if (!envelopeSender.trim() || !isValidEmail(envelopeSender)) {
      alert("A valid envelope sender email is required.");
      return;
    }
    if (!subject.trim()) {
      alert("Subject is required.");
      return;
    }
    if (!getHtmlContentWithTracking().trim()) {
      alert("HTML content is required.");
      return;
    }

    // Create FormData instance at the start
    const formData = new FormData();
    // If editing an existing template, include its ID
    if (initialTemplate && initialTemplate.id) {
      formData.append("templateId", initialTemplate.id);
    }
    formData.append("templateName", templateName);
    formData.append("envelopeSender", envelopeSender);
    formData.append("subject", subject);
    formData.append("textContent", textContent);
    formData.append("htmlContent", getHtmlContentWithTracking());
    formData.append("addTrackingImage", addTrackingImage);

    // Append attachments:
    // For new uploads (File objects) append normally.
    // For existing attachments (plain objects with an id), send as JSON.
    attachments.forEach((att) => {
      if (att instanceof File) {
        formData.append("attachments", att);
      } else if (att.id) {
        formData.append("existingAttachments", JSON.stringify(att));
      }
    });

    try {
      const response = await httpClient.post("/SaveTemplate", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert(response.data.message);
      onClose();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Error saving template: " + error.message);
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
              <FaEnvelope className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">
                {initialTemplate ? "Edit Template" : "Create Email Template"}
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
            Design professional email templates for phishing simulations
          </p>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Template Name and Import */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-cyber-muted text-sm font-medium mb-2">Template Name</label>
              <input
                type="text"
                value={templateName}
                required
                onChange={(e) => setTemplateName(e.target.value)}
                className="glass-select w-full px-4 py-3 rounded-lg"
                placeholder="Enter template name"
              />
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="glass-button px-4 py-3 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
            >
              <FaFileImport />
              <span>Import Email</span>
            </button>
          </div>

          {/* Envelope Sender */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2">Envelope Sender</label>
            <input
              type="email"
              value={envelopeSender}
              required
              onChange={(e) => setEnvelopeSender(e.target.value)}
              className="glass-select w-full px-4 py-3 rounded-lg"
              placeholder="sender@example.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2">Email Subject</label>
            <input
              type="text"
              value={subject}
              required
              onChange={(e) => setSubject(e.target.value)}
              className="glass-select w-full px-4 py-3 rounded-lg"
              placeholder="Enter email subject"
            />
          </div>

          {/* Content Tabs */}
          <div>
            <div className="flex border-b border-cyber-primary/20 mb-4">
              <button
                onClick={() => setActiveTab("text")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "text" 
                    ? "border-b-2 border-cyber-primary text-cyber-primary" 
                    : "text-cyber-muted hover:text-cyber-secondary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaCode />
                  <span>Text Content</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("html")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "html" 
                    ? "border-b-2 border-cyber-primary text-cyber-primary" 
                    : "text-cyber-muted hover:text-cyber-secondary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FaCode />
                  <span>HTML Content</span>
                </div>
              </button>
            </div>

            {activeTab === "text" ? (
              <textarea
                className="glass-select w-full px-4 py-3 rounded-lg h-32 resize-none"
                placeholder="Enter plain text content..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            ) : (
              <div className="glass-card p-4">
                <RichTextEditor value={htmlContent} onChange={setHtmlContent} />
              </div>
            )}
          </div>

          {/* Tracking Image Option */}
          <div className="glass-card p-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="addTracking"
                checked={addTrackingImage}
                onChange={() => setAddTrackingImage(!addTrackingImage)}
                className="w-4 h-4 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50"
              />
              <label htmlFor="addTracking" className="text-cyber-secondary font-medium flex items-center space-x-2">
                <FaImage />
                <span>Add Email Tracking</span>
              </label>
            </div>
            {addTrackingImage && (
              <div className="mt-3 bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
                <p className="text-cyber-primary font-medium text-sm mb-1">📊 Multi-Layer Tracking Enabled</p>
                <p className="text-cyber-muted text-xs">
                  Invisible tracking pixels will monitor email opens and engagement
                </p>
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <label className="text-cyber-secondary font-medium flex items-center space-x-2">
                <FaPaperclip />
                <span>Attachments</span>
              </label>
              <div>
                <input 
                  type="file" 
                  id="file-upload" 
                  multiple 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
                <label
                  htmlFor="file-upload"
                  className="glass-button px-4 py-2 text-sm rounded-lg cursor-pointer hover:scale-105 transition-transform"
                >
                  + Add Files
                </label>
              </div>
            </div>

            <div className="data-table rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cyber-primary/20">
                    <th className="p-3 text-left text-cyber-primary font-medium">Filename</th>
                    <th className="p-3 text-right text-cyber-primary font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttachments.length > 0 ? (
                    paginatedAttachments.map((file, index) => (
                      <tr key={index} className="border-b border-cyber-primary/10">
                        <td className="p-3 text-cyber-secondary flex items-center space-x-2">
                          <FaPaperclip className="text-cyber-muted" />
                          <span>{file.original_name || file.name}</span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteFile((currentPage - 1) * itemsPerPage + index)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="p-8 text-center text-cyber-muted italic">
                        No attachments added
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
            onClick={handleSaveTemplate}
            className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform"
          >
            <div className="flex items-center space-x-2">
              <FaEnvelope />
              <span>Save Template</span>
            </div>
          </button>
        </div>
      </div>

      {/* Import Email Modal */}
      {showImportModal && (
        <ImportEmailModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportEmailSuccess}
        />
      )}
    </div>
  );
};

export default NewTemplateModal;