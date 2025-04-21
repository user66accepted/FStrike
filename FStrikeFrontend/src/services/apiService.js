import config from '../config/apiConfig';
import httpClient from './httpClient';

// For backward compatibility
const API_BASE_URL = config.API_BASE_URL;

export const fetchProfiles = async () => {
  try {
    const response = await httpClient.get('/GetProfiles');
    return response.data.profiles;
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
};

export const fetchTemplates = async () => {
  try {
    const response = await httpClient.get('/GetEmailTemplates');
    return response.data.templates;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
};

export const fetchLandingPages = async () => {
  try {
    const response = await httpClient.get('/GetLandingPages');
    return response.data;
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    return [];
  }
};

export const fetchGroups = async () => {
  try {
    const response = await httpClient.get('/GetUserGroups');
    return response.data.groups;
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
};

// Add more API methods here
export const fetchCampaigns = async () => {
  try {
    const response = await httpClient.get('/GetCampaigns');
    return response.data.campaigns;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
};

export const deleteCampaign = async (campaignId) => {
  try {
    const response = await httpClient.delete(`/DeleteCampaign/${campaignId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
};

export const launchCampaign = async (campaignId) => {
  try {
    const response = await httpClient.post(`/LaunchCampaign/${campaignId}`);
    return response.data;
  } catch (error) {
    console.error('Error launching campaign:', error);
    throw error;
  }
};

export const closeCampaign = async (campaignId) => {
  try {
    const response = await httpClient.post(`/CloseCampaign/${campaignId}`);
    return response.data;
  } catch (error) {
    console.error('Error closing campaign:', error);
    throw error;
  }
};

export const login = async (username, password) => {
  try {
    const response = await httpClient.post('/login', { username, password });
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const extractSite = async (url) => {
  try {
    const response = await httpClient.post('/extract', { url });
    return response.data;
  } catch (error) {
    console.error('Error extracting site:', error);
    throw error;
  }
}; 