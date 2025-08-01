import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus, FaMailBulk, FaUser, FaServer, FaKey, FaEnvelope, FaLock } from "react-icons/fa";
import config from "../config/apiConfig";

export default function NewProfileModal({ profile, onClose }) {
  const [form, setForm] = useState({
    name: "",
    from: "",
    host: "",
    username: "",
    password: "",
    ignoreCerts: true,
  });
  const [headers, setHeaders]         = useState([]);
  const [customHeader, setCustomHeader] = useState({ key: "", value: "" });
  const [errors, setErrors]           = useState({});

  // Seed form when editing
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        from: profile.fromAddress,
        host: profile.host,
        username: profile.username,
        password: profile.password,
        ignoreCerts: Boolean(profile.ignoreCertErrors),
      });
      setHeaders(profile.headers || []);
    }
  }, [profile]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addHeader = () => {
    if (customHeader.key && customHeader.value) {
      setHeaders((h) => [...h, customHeader]);
      setCustomHeader({ key: "", value: "" });
    }
  };

  const deleteHeader = (idx) => {
    setHeaders((h) => h.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^<>]+<[^<>@]+@[^<>]+\.[^<>]+>$/;
    const hostRegex  = /^[a-zA-Z0-9.-]+(:\d+)?$/;

    if (!form.name.trim()) errs.name = "Profile name is required";
    if (!form.from.trim() || !emailRegex.test(form.from))
      errs.from = 'Valid "SMTP From" is required (e.g., John Doe <email@example.com>)';
    if (!form.host.trim() || !hostRegex.test(form.host))
      errs.host = 'Valid "Host" is required (e.g., smtp.example.com or smtp.example.com:25)';
    if (!form.username.trim()) errs.username = "Username is required";
    if (!form.password.trim()) errs.password = "Password is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      name: form.name,
      from: form.from,
      host: form.host,
      username: form.username,
      password: form.password,
      ignoreCertErrors: form.ignoreCerts,
      headers,
    };

    try {
      const url = profile
        ? `${config.API_BASE_URL}/UpdateProfile/${profile.profileId}`
        : `${config.API_BASE_URL}/SaveProfile`;

      const method = profile ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      alert(`Profile ${profile ? "updated" : "saved"} successfully.`);
      onClose();
    } catch (err) {
      alert(`Failed to ${profile ? "update" : "save"} profile: ${err.message}`);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.id === "modal-overlay") onClose();
  };

  return (
    <div
      id="modal-overlay"
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50"
    >
      <div className="glass-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-cyber-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaLock className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">
                {profile ? "Edit Sending Profile" : "Create Sending Profile"}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary transition-all duration-300"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <p className="text-cyber-muted text-sm mt-2 relative z-10">
            Configure SMTP settings for secure email delivery in campaigns
          </p>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Profile Name */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaUser />
              <span>Profile Name</span>
            </label>
            <input
              name="name"
              type="text"
              placeholder="Enter profile name (e.g., Corporate Email)"
              className="glass-select w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
              value={form.name}
              onChange={handleInputChange}
            />
            {errors.name && (
              <div className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                <span>⚠️</span>
                <span>{errors.name}</span>
              </div>
            )}
          </div>

          {/* Interface Type */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaServer />
              <span>Interface Type</span>
            </label>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-cyber-secondary font-medium">SMTP Protocol</span>
                <span className="badge badge-success">Active</span>
              </div>
              <p className="text-cyber-muted text-xs mt-2">
                Simple Mail Transfer Protocol for reliable email delivery
              </p>
            </div>
          </div>

          {/* SMTP From */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaEnvelope />
              <span>SMTP From Address</span>
            </label>
            <input
              name="from"
              type="text"
              placeholder="John Doe <john.doe@company.com>"
              className="glass-select w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
              value={form.from}
              onChange={handleInputChange}
            />
            {errors.from && (
              <div className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                <span>⚠️</span>
                <span>{errors.from}</span>
              </div>
            )}
            <p className="text-cyber-muted text-xs mt-2">
              Format: Display Name &lt;email@domain.com&gt;
            </p>
          </div>

          {/* Host */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaServer />
              <span>SMTP Host</span>
            </label>
            <input
              name="host"
              type="text"
              placeholder="smtp.gmail.com:587"
              className="glass-select w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
              value={form.host}
              onChange={handleInputChange}
            />
            {errors.host && (
              <div className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                <span>⚠️</span>
                <span>{errors.host}</span>
              </div>
            )}
            <p className="text-cyber-muted text-xs mt-2">
              Include port number (e.g., smtp.example.com:587 or smtp.example.com:25)
            </p>
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                <FaUser />
                <span>Username</span>
              </label>
              <input
                name="username"
                type="text"
                placeholder="Enter SMTP username"
                className="glass-select w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
                value={form.username}
                onChange={handleInputChange}
              />
              {errors.username && (
                <div className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>{errors.username}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                <FaKey />
                <span>Password</span>
              </label>
              <input
                name="password"
                type="password"
                placeholder="Enter SMTP password"
                className="glass-select w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
                value={form.password}
                onChange={handleInputChange}
              />
              {errors.password && (
                <div className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>{errors.password}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ignore Certificate Errors */}
          <div className="glass-card p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center space-x-3">
                <FaLock className="text-cyber-secondary" />
                <div>
                  <span className="text-cyber-secondary font-medium">Ignore Certificate Errors</span>
                  <p className="text-cyber-muted text-xs mt-1">
                    Skip SSL certificate validation (use with caution)
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                name="ignoreCerts"
                className="w-5 h-5 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50 focus:ring-2 transition-all duration-300"
                checked={form.ignoreCerts}
                onChange={handleInputChange}
              />
            </label>
          </div>

          {/* Email Headers */}
          <div className="glass-card p-4">
            <h3 className="text-cyber-secondary font-medium mb-4 flex items-center space-x-2">
              <FaEnvelope />
              <span>Custom Email Headers</span>
            </h3>
            
            {/* Add Header Form */}
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                placeholder="Header Name (e.g., X-Mailer)"
                className="glass-select flex-1 px-3 py-2 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
                value={customHeader.key}
                onChange={(e) =>
                  setCustomHeader((ch) => ({ ...ch, key: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Header Value (e.g., {{URL}}-campaign)"
                className="glass-select flex-1 px-3 py-2 rounded-lg focus:ring-2 focus:ring-cyber-primary/50 transition-all duration-300"
                value={customHeader.value}
                onChange={(e) =>
                  setCustomHeader((ch) => ({ ...ch, value: e.target.value }))
                }
              />
              <button
                onClick={addHeader}
                disabled={!customHeader.key || !customHeader.value}
                className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus />
                <span>Add</span>
              </button>
            </div>

            {/* Headers Table */}
            <div className="data-table rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cyber-primary/20">
                    <th className="p-3 text-left text-cyber-primary font-medium w-8">Action</th>
                    <th className="p-3 text-left text-cyber-primary font-medium">Header Name</th>
                    <th className="p-3 text-left text-cyber-primary font-medium">Header Value</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-cyber-muted italic">
                        <div className="flex flex-col items-center space-y-2">
                          <FaEnvelope className="text-cyber-primary/50 text-2xl" />
                          <span>No custom headers configured</span>
                          <span className="text-xs">Add headers to customize email metadata</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    headers.map((h, idx) => (
                      <tr key={idx} className="border-b border-cyber-primary/10 hover:bg-cyber-primary/5 transition-colors duration-200">
                        <td className="p-3">
                          <button
                            onClick={() => deleteHeader(idx)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 rounded"
                            title="Remove header"
                          >
                            <FaTimes />
                          </button>
                        </td>
                        <td className="p-3 text-cyber-secondary font-medium">{h.key}</td>
                        <td className="p-3 text-cyber-muted font-mono text-sm">{h.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-cyber-primary/20 px-6 py-4">
          <button className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform">
            <FaMailBulk />
            <span>Send Test Email</span>
          </button>
          <div className="space-x-3">
            <button
              onClick={onClose}
              className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary transition-colors duration-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform"
              disabled={Object.keys(errors).length > 0}
            >
              <div className="flex items-center space-x-2">
                <FaLock />
                <span>{profile ? "Update Profile" : "Save Profile"}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
