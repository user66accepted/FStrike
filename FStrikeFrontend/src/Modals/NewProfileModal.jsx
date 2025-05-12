import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus, FaMailBulk } from "react-icons/fa";

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
        ? `http://147.93.87.182:5000/api/UpdateProfile/${profile.profileId}`
        : "http://147.93.87.182:5000/api/SaveProfile";

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
      className="fixed inset-0 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-lg w-full max-w-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-black cursor-pointer"
        >
          <FaTimes size={18} />
        </button>

        <h2 className="text-2xl font-bold mb-4">
          {profile ? "Edit Sending Profile" : "New Sending Profile"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-gray-600 font-bold text-sm">Name:</label>
            <input
              name="name"
              type="text"
              placeholder="Profile name"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.name}
              onChange={handleInputChange}
            />
            {errors.name && (
              <div className="text-red-500 text-sm">{errors.name}</div>
            )}
          </div>

          {/* Interface Type */}
          <div>
            <label className="text-gray-600 font-bold text-sm">
              Interface Type:
            </label>
            <input
              type="text"
              readOnly
              value="SMTP"
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* From */}
          <div>
            <label className="text-gray-600 font-bold text-sm">SMTP From:</label>
            <input
              name="from"
              type="text"
              placeholder="First Last <test@example.com>"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.from}
              onChange={handleInputChange}
            />
            {errors.from && (
              <div className="text-red-500 text-sm">{errors.from}</div>
            )}
          </div>

          {/* Host */}
          <div>
            <label className="text-gray-600 font-bold text-sm">Host:</label>
            <input
              name="host"
              type="text"
              placeholder="smtp.example.com:25"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.host}
              onChange={handleInputChange}
            />
            {errors.host && (
              <div className="text-red-500 text-sm">{errors.host}</div>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="text-gray-600 font-bold text-sm">Username:</label>
            <input
              name="username"
              type="text"
              placeholder="Username"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.username}
              onChange={handleInputChange}
            />
            {errors.username && (
              <div className="text-red-500 text-sm">{errors.username}</div>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="text-gray-600 font-bold text-sm">Password:</label>
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.password}
              onChange={handleInputChange}
            />
            {errors.password && (
              <div className="text-red-500 text-sm">{errors.password}</div>
            )}
          </div>

          {/* Ignore Certs */}
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              name="ignoreCerts"
              className="form-checkbox h-6 w-6"
              checked={form.ignoreCerts}
              onChange={handleInputChange}
            />
            <span>Ignore Certificate Errors</span>
          </label>

          {/* Headers */}
          <div>
            <h3 className="font-semibold mb-2">Email Headers:</h3>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                placeholder="X-Custom-Header"
                className="border border-gray-300 rounded px-3 py-2 flex-1"
                value={customHeader.key}
                onChange={(e) =>
                  setCustomHeader((ch) => ({ ...ch, key: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="{{URL}}-gophish"
                className="border border-gray-300 rounded px-3 py-2 flex-1"
                value={customHeader.value}
                onChange={(e) =>
                  setCustomHeader((ch) => ({ ...ch, value: e.target.value }))
                }
              />
              <button
                onClick={addHeader}
                className="flex items-center space-x-2 bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded cursor-pointer"
              >
                <FaPlus />
                <span>Add</span>
              </button>
            </div>
            <div className="border border-gray-300 rounded">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2">Header</th>
                    <th className="px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-2 text-center text-gray-500">
                        No data available in table
                      </td>
                    </tr>
                  ) : (
                    headers.map((h, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td
                          className="px-4 py-2 text-red-500 cursor-pointer"
                          onClick={() => deleteHeader(idx)}
                        >
                          <FaTimes />
                        </td>
                        <td className="px-4 py-2">{h.key}</td>
                        <td className="px-4 py-2">{h.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-6">
            <button className="flex items-center space-x-2 bg-teal-400 hover:bg-teal-600 text-white px-4 py-2 rounded font-semibold cursor-pointer">
              <FaMailBulk />
              <span>Send Test Email</span>
            </button>
            <div className="space-x-2">
              <button
                onClick={onClose}
                className="border border-gray-300 hover:bg-gray-200 px-4 py-2 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-teal-400 hover:bg-teal-600 text-white px-4 py-2 rounded font-semibold cursor-pointer"
              >
                {profile ? "Update Profile" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
