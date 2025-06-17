import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
      <div className="w-full max-w-2xl bg-white rounded-md shadow-lg">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-800">New Campaign</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 text-sm" role="alert">
            <strong className="font-semibold">{error}</strong>
          </div>
        )}

        {validationError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 text-sm" role="alert">
            <strong className="font-semibold">{validationError}</strong>
          </div>
        )}

        {!error && hasMissingOptions && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 text-sm space-y-1" role="alert">
            {missingOptions.profiles && (
              <div><strong className="font-semibold">No Sending Profiles added</strong></div>
            )}
            {missingOptions.templates && (
              <div><strong className="font-semibold">No Email Templates added</strong></div>
            )}
            {missingOptions.landingPages && (
              <div><strong className="font-semibold">No Landing Pages added</strong></div>
            )}
            {missingOptions.groups && (
              <div><strong className="font-semibold">No Groups added</strong></div>
            )}
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name:</label>
            <input
              type="text"
              name="name"
              placeholder="Campaign name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email Template:</label>
            <select 
              name="templateId"
              value={formData.templateId}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring focus:ring-blue-200"
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

          <div>
            <label className="block text-sm font-medium text-gray-700">Landing Page Options:</label>
            <div className="space-y-3">
              {/* Regular Landing Page Option */}
              <div>
                <select 
                  name="landingPageId"
                  value={formData.landingPageId}
                  onChange={handleInputChange}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring focus:ring-blue-200"
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
              <div className="border rounded-md p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
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
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="useEvilginx" className="text-sm font-medium text-gray-700">
                    🔗 Use Evilginx URL
                  </label>
                </div>
                {formData.useEvilginx && (
                  <input
                    type="text"
                    name="evilginxUrl"
                    placeholder="Enter Evilginx URL"
                    value={formData.evilginxUrl}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                  />
                )}
              </div>

              {/* Website Mirroring Option */}
              <div className="border rounded-md p-3 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
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
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="useWebsiteMirroring" className="text-sm font-medium text-gray-700">
                    🌐 Real-time Website Mirroring
                  </label>
                </div>
                {formData.useWebsiteMirroring && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="mirrorTargetUrl"
                      placeholder="Enter website URL to mirror (e.g., facebook.com, gmail.com)"
                      value={formData.mirrorTargetUrl}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                    />
                    <div className="text-xs text-gray-600 bg-blue-100 p-2 rounded">
                      <p className="font-medium mb-1">🚀 Real-time website mirroring will:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Create a live proxy of the target website</li>
                        <li>Track all user interactions and form submissions</li>
                        <li>Maintain full functionality of the original site</li>
                        <li>Inject tracking pixels for comprehensive analytics</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">URL:</label>
            <input
              type="text"
              name="url"
              placeholder="http://192.168.1.1"
              value={formData.url}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col md:flex-row md:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Launch Date</label>
              <input
                type="text"
                name="launchDate"
                value={formData.launchDate}
                onChange={handleInputChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Send Emails By (Optional)</label>
              <input
                type="text"
                name="sendByDate"
                value={formData.sendByDate}
                onChange={handleInputChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Sending Profile:</label>
            <div className="flex space-x-2">
              <select 
                name="profileId"
                value={formData.profileId}
                onChange={handleInputChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring focus:ring-blue-200"
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
                className="mt-1 px-4 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200"
                disabled={loading || missingOptions.profiles}
              >
                Send Test Email
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Groups:</label>
            <select 
              name="groupId"
              value={formData.groupId}
              onChange={handleInputChange}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring focus:ring-blue-200"
              disabled={loading || missingOptions.groups}
            >
              <option value="">Select Group</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.group_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-6 py-4 space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-gray-700 border border-gray-300 bg-white hover:bg-gray-100"
          >
            Close
          </button>
          <button 
            onClick={handleSubmit}
            disabled={hasMissingOptions || submitting}
            className="px-4 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Launch Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCampaignModal;
