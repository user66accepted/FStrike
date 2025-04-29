import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash } from "react-icons/fa";
import NewProfileModal from "../Modals/NewProfileModal";
import InfoBar from "../components/InfoBar";

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
      const res = await fetch("http://161.97.104.136:5000/api/GetProfiles");
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
      const res = await fetch(`http://161.97.104.136:5000/api/DeleteProfile/${id}`, {
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
      const res = await fetch(`http://161.97.104.136:5000/api/GetProfile/${id}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const { profile, headers } = await res.json();
      setSelectedProfile({ ...profile, headers });
      setIsModalOpen(true);
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="p-6">Loading profiles…</div>;

  return (
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Sending Profiles</h1>
      <hr className="my-4 bg-gray-300" />

      <button
        onClick={() => {
          setSelectedProfile(null);
          setIsModalOpen(true);
        }}
        className="bg-teal-500 mt-8 mb-8 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-400 cursor-pointer"
      >
        <FaPlus /> New Profile
      </button>

      <table className="w-full mt-4">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left">
            <th className="p-2">Name</th>
            <th className="p-2">Interface Type</th>
            <th className="p-2">Last Modified</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.profileId}>
              <td className="p-2">{p.name}</td>
              <td className="p-2">SMTP</td>
              <td className="p-2">
                {new Date(p.createdAt).toLocaleString()}
              </td>
              <td className="p-2 flex gap-2">
                <button
                  onClick={() => handleEdit(p.profileId)}
                  className="bg-teal-500 text-white p-2 rounded hover:bg-teal-600"
                >
                  <FaEdit />
                </button>
                <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
                  <FaClone />
                </button>
                <button
                  onClick={() => handleDelete(p.profileId)}
                  className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
          {profiles.length === 0 && (
            <tr>
              <td colSpan="4" className="p-4 text-center text-gray-500">
                <InfoBar text="Profiles" />
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
