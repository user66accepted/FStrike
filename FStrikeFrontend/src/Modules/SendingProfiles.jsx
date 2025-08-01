import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash, FaServer, FaShieldAlt } from "react-icons/fa";
import NewProfileModal from "../Modals/NewProfileModal";
import config from "../config/apiConfig";

export default function SendingProfiles() {
  const [profiles, setProfiles]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Fetch all profiles
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/GetProfiles`);
      if (!res.ok) throw new Error("Could not load profiles");
      const { profiles } = await res.json();
      setProfiles(profiles);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Delete handler
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this profile?")) return;
    try {
      const res = await fetch(`${config.API_BASE_URL}/DeleteProfile/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setProfiles((prev) => prev.filter((p) => p.profileId !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEdit = async (id) => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/GetProfile/${id}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const { profile, headers } = await res.json();
      setSelectedProfile({ ...profile, headers });
      setIsModalOpen(true);
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-center py-16">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-cyber-muted">Loading sending profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-3 h-3 bg-green-400 status-indicator"></div>
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            SMTP Configuration
          </h1>
        </div>
        <p className="text-cyber-muted">
          Manage email sending profiles • SMTP server configurations
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* New Profile Button */}
      <button
        onClick={() => {
          setSelectedProfile(null);
          setIsModalOpen(true);
        }}
        className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 mb-6 hover:scale-105 transition-transform"
      >
        <FaServer />
        <span className="font-medium">New SMTP Profile</span>
      </button>

      {/* Main Content Card */}
      <div className="glass-card p-6">
        {/* Table Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-cyber-muted">Show</label>
            <select className="glass-select px-3 py-2 rounded-lg w-20">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-cyber-muted">entries</span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-cyber-muted">Search:</label>
            <input
              type="text"
              className="glass-select px-3 py-2 rounded-lg w-64"
              placeholder="Filter profiles..."
            />
          </div>
        </div>

        {/* Profiles Table */}
        {profiles.length > 0 ? (
          <div className="data-table rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Profile Name</th>
                  <th className="text-left">Interface Type</th>
                  <th className="text-left">Created Date</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.profileId}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaShieldAlt className="text-cyber-secondary" />
                        <span className="font-semibold text-cyber-primary">{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="badge badge-success">SMTP</div>
                    </td>
                    <td className="text-cyber-muted font-mono text-sm">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(p.profileId)}
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="Edit Profile"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="Clone Profile"
                        >
                          <FaClone />
                        </button>
                        <button
                          onClick={() => handleDelete(p.profileId)}
                          className="glass-button p-2 rounded-lg text-cyber-accent hover:text-red-400"
                          title="Delete Profile"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <p className="text-cyber-muted text-lg">No sending profiles found</p>
            <p className="text-cyber-muted text-sm mt-2">Create your first SMTP profile to enable email delivery</p>
          </div>
        )}

        {/* Pagination */}
        {profiles.length > 0 && (
          <div className="flex justify-between items-center mt-6 pt-6">
            <span className="text-cyber-muted text-sm">
              Showing 1 to {profiles.length} of {profiles.length} entries
            </span>
            <div className="flex items-center space-x-2">
              <button className="glass-button px-3 py-1 text-sm rounded">
                Previous
              </button>
              <button className="bg-cyber-primary text-black px-3 py-1 text-sm rounded font-medium">
                1
              </button>
              <button className="glass-button px-3 py-1 text-sm rounded">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <NewProfileModal
          profile={selectedProfile}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProfile(null);
            fetchProfiles();
          }}
        />
      )}
    </div>
  );
}
