import React, { useState, useEffect } from 'react';
import { FaTimes, FaRocket, FaEnvelope, FaGlobe, FaUsers, FaCalendar, FaLink } from 'react-icons/fa';
import { fetchProfiles, fetchTemplates, fetchLandingPages, fetchGroups } from '../services/apiService';
import httpClient from '../services/httpClient';

const NewCampaignModal = ({ isOpen, onClose, onSave }) => {
  const [profiles, setProfiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [landingPages, setLandingPages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    landingPageId: '',
    url: '',
    launchDate: 'April 8th 2025, 11:21 am',
    sendByDate: '',
    profileId: '',
    groupId: '',
    useEvilginx: false,
    evilginxUrl: '',
    useWebsiteMirroring: false,
    mirrorTargetUrl: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profilesData, templatesData, landingPagesData, groupsData] = await Promise.all([
          fetchProfiles(),
          fetchTemplates(),
          fetchLandingPages(),
          fetchGroups()
        ]);

        setProfiles(profilesData || []);
        setTemplates(templatesData || []);
        setLandingPages(landingPagesData || []);
        setGroups(groupsData || []);
        setError(null);
      } catch (err) {
        setError('Failed to load data. Please try again later.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchData();
      // Reset form when modal opens
      setFormData({
        name: '',
        templateId: '',
        landingPageId: '',
        url: '',
        launchDate: 'April 8th 2025, 11:21 am',
        sendByDate: '',
        profileId: '',
        groupId: '',
        useEvilginx: false,
        evilginxUrl: '',
        useWebsiteMirroring: false,
        mirrorTargetUrl: ''
      });
      setValidationError(null);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    // Basic required fields
    const requiredFields = [
      { field: 'name', label: 'Campaign name' },
      { field: 'templateId', label: 'Email template' },
      { field: 'url', label: 'URL' },
      { field: 'launchDate', label: 'Launch date' },
      { field: 'profileId', label: 'Sending profile' },
      { field: 'groupId', label: 'Group' }
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field]) {
        setValidationError(`${label} is required`);
        return false;
      }
    }

    // Landing page validation - only required if not using Evilginx or Website Mirroring
    if (!formData.useEvilginx && !formData.useWebsiteMirroring && !formData.landingPageId) {
      setValidationError('Landing page is required (unless using Evilginx or Website Mirroring)');
      return false;
    }

    // Evilginx URL validation
    if (formData.useEvilginx && !formData.evilginxUrl) {
      setValidationError('Evilginx URL is required when using Evilginx option');
      return false;
    }

    // Website mirroring URL validation
    if (formData.useWebsiteMirroring && !formData.mirrorTargetUrl) {
      setValidationError('Target URL is required for website mirroring');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Run complete validation
    if (!validateForm()) {
      return;
    }

    // Debug: Log what we're about to send
    console.log('Submitting campaign data:', formData);

    try {
      setSubmitting(true);
      const response = await httpClient.post('/SaveCampaign', formData);
      console.log('Campaign created:', response.data);
      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error('Error creating campaign:', err);
      setValidationError(err.response?.data?.error || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Check which dropdowns have no options
  const missingOptions = {
    profiles: !loading && (!profiles || profiles.length === 0),
    templates: !loading && (!templates || templates.length === 0),
    landingPages: !loading && (!landingPages || landingPages.length === 0),
    groups: !loading && (!groups || groups.length === 0)
  };

  // Are there any missing options?
  const hasMissingOptions = Object.values(missingOptions).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div className="glass-card w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-cyber-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaRocket className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">Deploy Campaign</h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <p className="text-cyber-muted text-sm mt-2 relative z-10">
            Configure and launch a new phishing simulation campaign
          </p>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="bg-red-400/10 border border-red-400/20 text-red-400 px-6 py-3 text-sm">
            <strong className="font-semibold">{error}</strong>
          </div>
        )}

        {validationError && (
          <div className="bg-red-400/10 border border-red-400/20 text-red-400 px-6 py-3 text-sm">
            <strong className="font-semibold">{validationError}</strong>
          </div>
        )}

        {!error && hasMissingOptions && (
          <div className="bg-red-400/10 border border-red-400/20 text-red-400 px-6 py-3 text-sm space-y-1">
            {missingOptions.profiles && (
              <div><strong className="font-semibold">No Sending Profiles configured</strong></div>
            )}
            {missingOptions.templates && (
              <div><strong className="font-semibold">No Email Templates configured</strong></div>
            )}
            {missingOptions.landingPages && (
              <div><strong className="font-semibold">No Landing Pages configured</strong></div>
            )}
            {missingOptions.groups && (
              <div><strong className="font-semibold">No Target Groups configured</strong></div>
            )}
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Campaign Name */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaRocket />
              <span>Campaign Name</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="Enter campaign name"
              value={formData.name}
              onChange={handleInputChange}
              className="glass-select w-full px-4 py-3 rounded-lg"
            />
          </div>

          {/* Email Template */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaEnvelope />
              <span>Email Template</span>
            </label>
            <select 
              name="templateId"
              value={formData.templateId}
              onChange={handleInputChange}
              className="glass-select w-full px-4 py-3 rounded-lg"
              disabled={loading || missingOptions.templates}
            >
              <option value="">Select Template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.template_name}
                </option>
              ))}
            </select>
          </div>

          {/* Landing Page Options */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-4 flex items-center space-x-2">
              <FaGlobe />
              <span>Target Configuration</span>
            </label>
            <div className="space-y-4">
              {/* Regular Landing Page Option */}
              <div className="glass-card p-4">
                <h4 className="text-cyber-secondary font-medium mb-3">Standard Landing Page</h4>
                <select 
                  name="landingPageId"
                  value={formData.landingPageId}
                  onChange={handleInputChange}
                  className="glass-select w-full px-4 py-3 rounded-lg"
                  disabled={loading || missingOptions.landingPages || formData.useEvilginx || formData.useWebsiteMirroring}
                >
                  <option value="">Select Landing Page</option>
                  {landingPages.map(page => (
                    <option key={page.id} value={page.id}>
                      {page.page_name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Evilginx Option */}
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    id="useEvilginx"
                    checked={formData.useEvilginx}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        useEvilginx: e.target.checked,
                        landingPageId: e.target.checked ? '' : prev.landingPageId,
                        useWebsiteMirroring: e.target.checked ? false : prev.useWebsiteMirroring
                      }));
                    }}
                    className="w-4 h-4 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50"
                  />
                  <label htmlFor="useEvilginx" className="text-cyber-secondary font-medium">
                    🔗 Evilginx Integration
                  </label>
                </div>
                {formData.useEvilginx && (
                  <input
                    type="text"
                    name="evilginxUrl"
                    placeholder="Enter Evilginx URL"
                    value={formData.evilginxUrl}
                    onChange={handleInputChange}
                    className="glass-select w-full px-4 py-3 rounded-lg"
                  />
                )}
              </div>

              {/* Website Mirroring Option */}
              <div className="glass-card p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    id="useWebsiteMirroring"
                    checked={formData.useWebsiteMirroring}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        useWebsiteMirroring: e.target.checked,
                        landingPageId: e.target.checked ? '' : prev.landingPageId,
                        useEvilginx: e.target.checked ? false : prev.useEvilginx
                      }));
                    }}
                    className="w-4 h-4 text-cyber-primary bg-transparent border-cyber-primary/50 rounded focus:ring-cyber-primary/50"
                  />
                  <label htmlFor="useWebsiteMirroring" className="text-cyber-secondary font-medium">
                    🌐 Real-time Website Mirroring
                  </label>
                </div>
                {formData.useWebsiteMirroring && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      name="mirrorTargetUrl"
                      placeholder="Enter website URL to mirror (e.g., facebook.com, gmail.com)"
                      value={formData.mirrorTargetUrl}
                      onChange={handleInputChange}
                      className="glass-select w-full px-4 py-3 rounded-lg"
                    />
                    <div className="bg-cyber-primary/5 border border-cyber-primary/20 p-3 rounded-lg">
                      <p className="text-cyber-primary font-medium text-sm mb-2">🚀 Advanced Mirroring Features:</p>
                      <ul className="text-cyber-muted text-xs space-y-1">
                        <li>• Live proxy of target website</li>
                        <li>• Real-time interaction tracking</li>
                        <li>• Full functionality preservation</li>
                        <li>• Comprehensive analytics injection</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* URL and Dates */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                <FaLink />
                <span>Campaign URL</span>
              </label>
              <input
                type="text"
                name="url"
                placeholder="http://192.168.1.1"
                value={formData.url}
                onChange={handleInputChange}
                className="glass-select w-full px-4 py-3 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                <FaCalendar />
                <span>Launch Date</span>
              </label>
              <input
                type="text"
                name="launchDate"
                value={formData.launchDate}
                onChange={handleInputChange}
                className="glass-select w-full px-4 py-3 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2">Send Emails By (Optional)</label>
            <input
              type="text"
              name="sendByDate"
              value={formData.sendByDate}
              onChange={handleInputChange}
              className="glass-select w-full px-4 py-3 rounded-lg"
              placeholder="Optional deadline for email delivery"
            />
          </div>

          {/* Sending Profile and Groups */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2">Sending Profile</label>
              <div className="space-y-2">
                <select 
                  name="profileId"
                  value={formData.profileId}
                  onChange={handleInputChange}
                  className="glass-select w-full px-4 py-3 rounded-lg"
                  disabled={loading || missingOptions.profiles}
                >
                  <option value="">Select Sending Profile</option>
                  {profiles.map(profile => (
                    <option key={profile.profileId} value={profile.profileId}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <button 
                  className="glass-button px-4 py-2 text-sm rounded-lg disabled:opacity-50"
                  disabled={loading || missingOptions.profiles}
                >
                  Send Test Email
                </button>
              </div>
            </div>

            <div>
              <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
                <FaUsers />
                <span>Target Groups</span>
              </label>
              <select 
                name="groupId"
                value={formData.groupId}
                onChange={handleInputChange}
                className="glass-select w-full px-4 py-3 rounded-lg"
                disabled={loading || missingOptions.groups}
              >
                <option value="">Select Target Group</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
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
            onClick={handleSubmit}
            disabled={hasMissingOptions || submitting}
            className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? (
              <div className="flex items-center space-x-2">
                <div className="loading-spinner w-4 h-4"></div>
                <span>Deploying...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <FaRocket />
                <span>Launch Campaign</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCampaignModal;
