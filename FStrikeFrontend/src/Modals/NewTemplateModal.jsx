import React, { useState, useEffect } from "react";
import { FaFileImport, FaTrash } from "react-icons/fa";
import ImportEmailModal from "./ImportEmailModal";
import RichTextEditor from "../Utils/RichTextEditor";

// Basic email validation function
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
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
      return `${htmlContent} <img src='http://161.97.104.136:5000/track?email=user@example.com' width='1' height='1' style='display:none;' />`;
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
      const response = await fetch("http://147.93.87.182:5000/api/SaveTemplate", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to save template");
      }
      const result = await response.json();
      alert(result.message);
      onClose();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Error saving template: " + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30 backdrop-blur-md">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-300">
          <h2 className="text-3xl font-semibold">
            {initialTemplate ? "Edit Template" : "New Template"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition">
            &times;
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Name:</label>
              <input
                type="text"
                value={templateName}
                required
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
                placeholder="Template name"
              />
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="mt-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <FaFileImport /> Import Email
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Envelope Sender:</label>
            <input
              type="email"
              value={envelopeSender}
              required
              onChange={(e) => setEnvelopeSender(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md p-2"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject:</label>
            <input
              type="text"
              value={subject}
              required
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md p-2"
              placeholder="Email Subject"
            />
          </div>
          <div>
            <div className="flex border-b border-gray-300 mb-2">
              <button
                onClick={() => setActiveTab("text")}
                className={`px-4 py-2 font-semibold ${
                  activeTab === "text" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setActiveTab("html")}
                className={`px-4 py-2 font-semibold ${
                  activeTab === "html" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500"
                }`}
              >
                HTML
              </button>
            </div>
            {activeTab === "text" ? (
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 h-32"
                placeholder="Enter text content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            ) : (
              <RichTextEditor value={htmlContent} onChange={setHtmlContent} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addTrackingImage}
              onChange={() => setAddTrackingImage(!addTrackingImage)}
              className="h-5 w-5"
            />
            <label className="text text-gray-700">Add Tracking Image</label>
          </div>
          <div className="mt-10">
            <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileUpload} />
            <label
              htmlFor="file-upload"
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md cursor-pointer"
            >
              + Add Files
            </label>
          </div>
          <div className="border rounded-md p-4 border-gray-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="p-2">Name</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAttachments.length > 0 ? (
                  paginatedAttachments.map((file, index) => (
                    <tr key={index}>
                      <td className="p-2 text-gray-700 flex items-center gap-2">
                        📄 {file.original_name || file.name}
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => handleDeleteFile((currentPage - 1) * itemsPerPage + index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="p-2 text-gray-500 text-center">
                      No files uploaded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-black font-semibold py-2 px-4 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTemplate}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md"
            >
              Save Template
            </button>
          </div>
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