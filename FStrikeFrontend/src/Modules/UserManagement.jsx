import React, { useState } from 'react';
import { FaPlus, FaTimes, FaUserPlus, FaUsers, FaShieldAlt } from 'react-icons/fa';
import httpClient from '../services/httpClient';

function UserManagement() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: ''
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const response = await httpClient.post('/CreateUser', {
        username: formData.username,
        password: formData.password,
        email: formData.email
      });

      if (response.data) {
        setSuccessMessage('User created successfully!');
        setErrorMessage('');
        setFormData({
          username: '',
          password: '',
          confirmPassword: '',
          email: ''
        });
        setTimeout(() => {
          setShowModal(false);
          setSuccessMessage('');
        }, 2000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create user');
      setSuccessMessage('');
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-3 h-3 bg-green-400 status-indicator"></div>
              <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
                Access Control
              </h1>
            </div>
            <p className="text-cyber-muted">
              Manage system users and access permissions • Administrative control panel
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
          >
            <FaUserPlus />
            <span className="font-medium">Create New User</span>
          </button>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* Main Content */}
      <div className="glass-card p-6">
        <div className="text-center py-16">
          <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <p className="text-cyber-muted text-lg">User Management Dashboard</p>
          <p className="text-cyber-muted text-sm mt-2">Create and manage system user accounts</p>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-8 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-cyber-primary flex items-center space-x-2">
                <FaShieldAlt />
                <span>Create New User</span>
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrors({});
                  setSuccessMessage('');
                  setErrorMessage('');
                }}
                className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {successMessage && (
              <div className="bg-green-400/10 border border-green-400/20 text-green-400 px-4 py-3 rounded-lg mb-4">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-400/10 border border-red-400/20 text-red-400 px-4 py-3 rounded-lg mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-cyber-muted mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`glass-select w-full px-4 py-3 rounded-lg ${
                    errors.username ? 'border-red-400/50' : ''
                  }`}
                  placeholder="Enter username"
                />
                {errors.username && (
                  <p className="mt-2 text-sm text-red-400">{errors.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-cyber-muted mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`glass-select w-full px-4 py-3 rounded-lg ${
                    errors.email ? 'border-red-400/50' : ''
                  }`}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-400">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-cyber-muted mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`glass-select w-full px-4 py-3 rounded-lg ${
                    errors.password ? 'border-red-400/50' : ''
                  }`}
                  placeholder="Enter password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-400">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-cyber-muted mb-2">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`glass-select w-full px-4 py-3 rounded-lg ${
                    errors.confirmPassword ? 'border-red-400/50' : ''
                  }`}
                  placeholder="Confirm password"
                />
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-cyber-primary/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setErrors({});
                    setSuccessMessage('');
                    setErrorMessage('');
                  }}
                  className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;