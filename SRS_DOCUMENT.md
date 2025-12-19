# Software Requirements Specification (SRS)
# FStrike - Advanced Phishing Simulation Platform

**Version:** 1.0  
**Date:** December 19, 2025  
**Project:** FStrike  
**Organization:** Security Testing Platform

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Requirements](#6-database-requirements)
7. [Security Requirements](#7-security-requirements)
8. [Appendices](#8-appendices)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for FStrike, an advanced phishing simulation and security awareness training platform. The system is designed to help organizations test their security posture through controlled phishing campaigns.

### 1.2 Scope
FStrike is a comprehensive web-based platform that enables security professionals to:
- Create and manage phishing campaigns
- Design custom email templates with tracking capabilities
- Deploy landing pages and website mirroring sessions
- Capture and analyze user interactions
- Monitor real-time Gmail browser sessions
- Generate detailed analytics and reports

### 1.3 Definitions, Acronyms, and Abbreviations
- **SRS**: Software Requirements Specification
- **API**: Application Programming Interface
- **JWT**: JSON Web Token
- **SMTP**: Simple Mail Transfer Protocol
- **SQL**: Structured Query Language
- **WebSocket**: Full-duplex communication protocol
- **Phishing**: Simulated social engineering attack
- **Landing Page**: Web page designed to capture user credentials
- **Website Mirroring**: Proxy-based cloning of legitimate websites

### 1.4 References
- Express.js Documentation
- React.js Documentation
- SQLite Documentation
- Puppeteer API Documentation
- Socket.IO Documentation

### 1.5 Overview
This document is organized into sections covering system description, functional requirements, interface specifications, and non-functional requirements.

---

## 2. Overall Description

### 2.1 Product Perspective
FStrike is a standalone web application consisting of:
- **Backend**: Node.js/Express REST API server
- **Frontend**: React.js single-page application
- **Database**: SQLite for data persistence
- **Real-time Communication**: Socket.IO for live updates
- **Browser Automation**: Puppeteer for Gmail session control

### 2.2 Product Functions
The system provides the following major functions:

#### 2.2.1 Campaign Management
- Create, read, update, and delete phishing campaigns
- Configure campaign parameters (launch date, target groups, templates)
- Monitor campaign status and progress
- Support for multiple campaign types (email, landing page, website mirroring)

#### 2.2.2 Email Template Management
- Create custom HTML email templates
- Add tracking pixels for email open detection
- Attach files to email templates
- Variable substitution for personalization

#### 2.2.3 User Group Management
- Organize target users into groups
- Import users from CSV/Excel files
- Manage user attributes (name, email, position)
- AI-powered user information scraping

#### 2.2.4 Landing Page Management
- Design custom landing pages
- Form data capture
- Redirect functionality
- Real-time form submission tracking

#### 2.2.5 Website Mirroring
- Clone legitimate websites using proxy technology
- Capture credentials and form data
- Real-time cookie capture
- Session tracking and management

#### 2.2.6 Gmail Browser Sessions
- Remote browser control for Gmail access
- Real-time session sharing via WebSocket
- Screen capture and streaming
- Email scraping and analysis
- Cookie and credential capture

#### 2.2.7 Tracking and Analytics
- Email open tracking with pixel tracking
- Link click monitoring
- Form submission tracking
- Login attempt logging
- Real-time analytics dashboard

### 2.3 User Classes and Characteristics
1. **System Administrator**: Full access to all features
2. **Campaign Manager**: Create and manage campaigns
3. **Analyst**: View reports and analytics
4. **Target User**: Recipient of phishing campaigns (external)

### 2.4 Operating Environment
- **Server OS**: Linux (Ubuntu/Debian recommended)
- **Client OS**: Any modern OS with web browser
- **Web Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **Node.js**: v14.x or higher
- **Database**: SQLite 3.x

### 2.5 Design and Implementation Constraints
- Must use HTTPS for secure communication
- Email sending requires SMTP server configuration
- Browser automation requires sufficient server resources
- Real-time features require WebSocket support
- File uploads limited to 300MB

### 2.6 Assumptions and Dependencies
- Users have modern web browsers with JavaScript enabled
- Server has internet connectivity for external requests
- SMTP server is available for email sending
- Sufficient disk space for uploaded files and databases

---

## 3. System Features

### 3.1 Authentication and Authorization

#### 3.1.1 Description
Secure user authentication system using JWT tokens.

#### 3.1.2 Functional Requirements
- **FR-AUTH-001**: System shall authenticate users via username/password
- **FR-AUTH-002**: System shall generate JWT tokens upon successful authentication
- **FR-AUTH-003**: System shall validate JWT tokens for protected endpoints
- **FR-AUTH-004**: System shall hash passwords using bcrypt
- **FR-AUTH-005**: System shall create default admin user on first run
- **FR-AUTH-006**: JWT tokens shall expire after 1 hour

### 3.2 Campaign Management

#### 3.2.1 Description
Complete lifecycle management of phishing campaigns.

#### 3.2.2 Functional Requirements
- **FR-CAMP-001**: System shall allow creation of new campaigns
- **FR-CAMP-002**: System shall support campaign scheduling with launch dates
- **FR-CAMP-003**: System shall track campaign status (Draft, In Progress, Sent, Failed)
- **FR-CAMP-004**: System shall associate campaigns with email templates
- **FR-CAMP-005**: System shall associate campaigns with user groups
- **FR-CAMP-006**: System shall associate campaigns with landing pages
- **FR-CAMP-007**: System shall support Evilginx integration
- **FR-CAMP-008**: System shall support website mirroring option
- **FR-CAMP-009**: System shall send emails to all users in target group
- **FR-CAMP-010**: System shall generate unique tracking IDs per email
- **FR-CAMP-011**: System shall provide campaign analytics dashboard
- **FR-CAMP-012**: System shall allow campaign deletion with cascading

### 3.3 Email Template Management

#### 3.3.1 Description
Creation and management of email templates for campaigns.

#### 3.3.2 Functional Requirements
- **FR-TMPL-001**: System shall allow creation of HTML email templates
- **FR-TMPL-002**: System shall support rich text editing (CKEditor)
- **FR-TMPL-003**: System shall support variable substitution {{.FirstName}}, {{.LastName}}, {{.Email}}
- **FR-TMPL-004**: System shall allow multiple file attachments per template
- **FR-TMPL-005**: System shall store attachments on server filesystem
- **FR-TMPL-006**: System shall support tracking pixel insertion
- **FR-TMPL-007**: System shall allow template deletion
- **FR-TMPL-008**: System shall list all templates for selection
- **FR-TMPL-009**: System shall validate envelope sender address
- **FR-TMPL-010**: System shall support both HTML and plain text email bodies

### 3.4 User Group Management

#### 3.4.1 Description
Organization and management of target user groups.

#### 3.4.2 Functional Requirements
- **FR-GROUP-001**: System shall allow creation of user groups
- **FR-GROUP-002**: System shall store users with first name, last name, email, position
- **FR-GROUP-003**: System shall support CSV import of users
- **FR-GROUP-004**: System shall support Excel import of users
- **FR-GROUP-005**: System shall prevent duplicate emails within a group
- **FR-GROUP-006**: System shall allow group deletion with users
- **FR-GROUP-007**: System shall validate email addresses
- **FR-GROUP-008**: System shall list all groups with user counts
- **FR-GROUP-009**: System shall support AI-powered user scraping via Bing search

### 3.5 Landing Page Management

#### 3.5.1 Description
Custom landing page creation and form data capture.

#### 3.5.2 Functional Requirements
- **FR-LAND-001**: System shall allow creation of custom HTML landing pages
- **FR-LAND-002**: System shall serve landing pages at unique URLs
- **FR-LAND-003**: System shall capture form submissions
- **FR-LAND-004**: System shall store captured credentials securely
- **FR-LAND-005**: System shall support form field extraction
- **FR-LAND-006**: System shall redirect after form submission (optional)
- **FR-LAND-007**: System shall track link clicks on landing pages
- **FR-LAND-008**: System shall inject form capture JavaScript
- **FR-LAND-009**: System shall log IP addresses and user agents
- **FR-LAND-010**: System shall refresh page after credential capture

### 3.6 Website Mirroring

#### 3.6.1 Description
Advanced proxy-based website cloning for credential capture.

#### 3.6.2 Functional Requirements
- **FR-MIRROR-001**: System shall create mirroring sessions with unique tokens
- **FR-MIRROR-002**: System shall proxy all HTTP/HTTPS requests
- **FR-MIRROR-003**: System shall rewrite URLs in HTML content
- **FR-MIRROR-004**: System shall capture cookies in real-time
- **FR-MIRROR-005**: System shall store cookies to database with attributes
- **FR-MIRROR-006**: System shall emit cookie updates via WebSocket
- **FR-MIRROR-007**: System shall capture form submissions
- **FR-MIRROR-008**: System shall detect and log login attempts
- **FR-MIRROR-009**: System shall maintain session state across requests
- **FR-MIRROR-010**: System shall support JavaScript injection
- **FR-MIRROR-011**: System shall handle AJAX requests
- **FR-MIRROR-012**: System shall preserve browser fingerprinting headers
- **FR-MIRROR-013**: System shall support Google-specific anti-detection

### 3.7 Gmail Browser Service

#### 3.7.1 Description
Remote browser automation for Gmail access and monitoring.

#### 3.7.2 Functional Requirements
- **FR-GMAIL-001**: System shall create headless Chrome browser instances
- **FR-GMAIL-002**: System shall navigate to Gmail login page
- **FR-GMAIL-003**: System shall capture screenshots at regular intervals
- **FR-GMAIL-004**: System shall stream screenshots via WebSocket
- **FR-GMAIL-005**: System shall execute JavaScript commands remotely
- **FR-GMAIL-006**: System shall scrape email data from Gmail inbox
- **FR-GMAIL-007**: System shall detect successful login
- **FR-GMAIL-008**: System shall persist browser sessions to disk
- **FR-GMAIL-009**: System shall support session restoration
- **FR-GMAIL-010**: System shall clean up inactive sessions
- **FR-GMAIL-011**: System shall use stealth plugins for anti-detection
- **FR-GMAIL-012**: System shall customize viewport to victim screen size
- **FR-GMAIL-013**: System shall execute click and type commands
- **FR-GMAIL-014**: System shall navigate to URLs remotely

### 3.8 Tracking and Analytics

#### 3.8.1 Description
Comprehensive tracking of campaign interactions and analytics.

#### 3.8.2 Functional Requirements
- **FR-TRACK-001**: System shall generate unique tracking pixel IDs
- **FR-TRACK-002**: System shall log email opens with timestamp
- **FR-TRACK-003**: System shall detect email client from user agent
- **FR-TRACK-004**: System shall prevent duplicate open logging (5-minute window)
- **FR-TRACK-005**: System shall serve 1x1 transparent PNG pixels
- **FR-TRACK-006**: System shall track link clicks
- **FR-TRACK-007**: System shall log form submissions with field data
- **FR-TRACK-008**: System shall count total opens per campaign
- **FR-TRACK-009**: System shall count unique opens per campaign
- **FR-TRACK-010**: System shall emit real-time updates via WebSocket
- **FR-TRACK-011**: System shall store captured credentials
- **FR-TRACK-012**: System shall log login attempts with details

### 3.9 Sending Profiles

#### 3.9.1 Description
SMTP configuration management for email sending.

#### 3.9.2 Functional Requirements
- **FR-SEND-001**: System shall store SMTP server configurations
- **FR-SEND-002**: System shall support custom email headers
- **FR-SEND-003**: System shall allow SSL/TLS configuration
- **FR-SEND-004**: System shall validate SMTP credentials
- **FR-SEND-005**: System shall support from address customization
- **FR-SEND-006**: System shall allow certificate error ignoring

### 3.10 Real-time Updates

#### 3.10.1 Description
WebSocket-based real-time communication for live updates.

#### 3.10.2 Functional Requirements
- **FR-RT-001**: System shall establish WebSocket connections
- **FR-RT-002**: System shall emit email open events
- **FR-RT-003**: System shall emit form submission events
- **FR-RT-004**: System shall emit cookie capture events
- **FR-RT-005**: System shall emit browser screenshot updates
- **FR-RT-006**: System shall handle client disconnections gracefully

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 Web Dashboard
- Modern, responsive design using React and Tailwind CSS
- Navigation sidebar with module access
- Header with user information
- Dashboard with campaign statistics and charts
- Tables with sorting and filtering
- Modal dialogs for forms and confirmations
- Real-time updates without page refresh

#### 4.1.2 Campaign Module
- Campaign listing with status badges
- Campaign creation wizard
- Statistics dashboard with charts
- Email opens timeline
- Form submissions table
- Login attempts table
- Cookie viewer

#### 4.1.3 Email Template Module
- Rich text editor (CKEditor/TinyMCE)
- Template preview
- Attachment management
- Variable insertion tools

#### 4.1.4 Landing Page Module
- HTML editor
- Form data capture settings
- Redirect URL configuration
- Landing page preview

### 4.2 Hardware Interfaces
- Standard server hardware with network connectivity
- Minimum 2GB RAM for browser automation
- Adequate disk space for database and uploaded files

### 4.3 Software Interfaces

#### 4.3.1 Database Interface
- SQLite 3.x database
- SQL queries for CRUD operations
- Prepared statements for security

#### 4.3.2 Email Interface
- SMTP protocol for email sending
- Nodemailer library for email composition
- Support for attachments and HTML emails

#### 4.3.3 Browser Automation Interface
- Puppeteer for Chrome automation
- Stealth plugins for anti-detection
- Screenshot capture API

#### 4.3.4 Web Scraping Interface
- Selenium WebDriver for Bing searches
- Cheerio for HTML parsing
- Axios for HTTP requests

### 4.4 Communication Interfaces

#### 4.4.1 HTTP/HTTPS
- RESTful API endpoints
- JSON request/response format
- CORS enabled for cross-origin requests

#### 4.4.2 WebSocket
- Socket.IO for bidirectional communication
- Event-based messaging
- Automatic reconnection

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
- **NFR-PERF-001**: API response time < 2 seconds for 95% of requests
- **NFR-PERF-002**: Support 100 concurrent users
- **NFR-PERF-003**: Screenshot streaming at 1 frame per second minimum
- **NFR-PERF-004**: Email sending rate of 10+ emails per minute
- **NFR-PERF-005**: Database queries optimized with indexes

### 5.2 Security Requirements
- **NFR-SEC-001**: All passwords hashed with bcrypt (10 rounds)
- **NFR-SEC-002**: JWT tokens for authentication
- **NFR-SEC-003**: HTTPS required for production
- **NFR-SEC-004**: SQL injection prevention via prepared statements
- **NFR-SEC-005**: XSS prevention via input sanitization
- **NFR-SEC-006**: CSRF protection for state-changing operations
- **NFR-SEC-007**: Helmet.js for security headers

### 5.3 Reliability Requirements
- **NFR-REL-001**: System uptime of 99.5%
- **NFR-REL-002**: Automatic session cleanup for stale connections
- **NFR-REL-003**: Error logging for debugging
- **NFR-REL-004**: Graceful degradation on service failures

### 5.4 Maintainability Requirements
- **NFR-MAINT-001**: Modular code architecture
- **NFR-MAINT-002**: Code documentation and comments
- **NFR-MAINT-003**: Separation of concerns (MVC pattern)
- **NFR-MAINT-004**: Configuration via environment variables

### 5.5 Usability Requirements
- **NFR-USE-001**: Intuitive user interface
- **NFR-USE-002**: Responsive design for mobile/tablet
- **NFR-USE-003**: Visual feedback for user actions
- **NFR-USE-004**: Clear error messages

### 5.6 Scalability Requirements
- **NFR-SCALE-001**: Support for 1000+ campaigns
- **NFR-SCALE-002**: Support for 10,000+ target users
- **NFR-SCALE-003**: Database size up to 10GB
- **NFR-SCALE-004**: Horizontal scaling capability

---

## 6. Database Requirements

### 6.1 Database Tables

#### 6.1.1 Users
Stores system user accounts.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| username | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| email | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.2 Campaigns
Stores phishing campaign information.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| name | TEXT | NOT NULL |
| template_id | INTEGER | NOT NULL, FOREIGN KEY |
| landing_page_id | INTEGER | FOREIGN KEY |
| url | TEXT | NOT NULL |
| launch_date | TEXT | NOT NULL |
| send_by_date | TEXT | |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY |
| group_id | INTEGER | NOT NULL, FOREIGN KEY |
| status | TEXT | DEFAULT 'Draft' |
| use_evilginx | INTEGER | DEFAULT 0 |
| evilginx_url | TEXT | |
| use_website_mirroring | INTEGER | DEFAULT 0 |
| mirror_target_url | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.3 EmailTemplates
Stores email template configurations.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FOREIGN KEY |
| template_name | TEXT | NOT NULL |
| envelope_sender | TEXT | NOT NULL |
| subject | TEXT | NOT NULL |
| text | TEXT | NOT NULL |
| html | TEXT | NOT NULL |
| add_tracking_image | INTEGER | DEFAULT 0 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.4 UserGroups
Stores target user groups.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| group_name | TEXT | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.5 GroupUsers
Stores individual users within groups.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| group_id | INTEGER | NOT NULL, FOREIGN KEY |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| email | TEXT | NOT NULL |
| position | TEXT | NOT NULL |

#### 6.1.6 LandingPages
Stores landing page HTML content.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| page_name | TEXT | NOT NULL |
| html_content | TEXT | |
| capture_submitted_data | INTEGER | DEFAULT 0 |
| redirect_url | TEXT | |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.7 tracking_pixels
Stores tracking pixel assignments.

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| campaign_id | INTEGER | NOT NULL, FOREIGN KEY |
| user_email | TEXT | NOT NULL |
| createdAt | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.8 open_logs
Stores email open events.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| pixel_id | TEXT | NOT NULL, FOREIGN KEY |
| timestamp | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| ip | TEXT | |
| userAgent | TEXT | |
| email_client | TEXT | DEFAULT 'Unknown' |

#### 6.1.9 captured_credentials
Stores captured login credentials.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| campaign_id | INTEGER | NOT NULL, FOREIGN KEY |
| url | TEXT | |
| username | TEXT | |
| password | TEXT | |
| other_fields | TEXT | |
| ip_address | TEXT | |
| user_agent | TEXT | |
| capture_method | TEXT | DEFAULT 'form_submission' |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### 6.1.10 captured_cookies
Stores captured browser cookies.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| campaign_id | INTEGER | NOT NULL, FOREIGN KEY |
| session_token | TEXT | NOT NULL |
| cookie_name | TEXT | NOT NULL |
| cookie_value | TEXT | |
| domain | TEXT | |
| path | TEXT | DEFAULT '/' |
| expiration_date | INTEGER | |
| secure | INTEGER | DEFAULT 0 |
| http_only | INTEGER | DEFAULT 0 |
| first_seen | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| last_updated | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| is_active | INTEGER | DEFAULT 1 |

#### 6.1.11 GmailBrowserSessions
Stores Gmail browser session metadata.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| session_token | TEXT | NOT NULL, UNIQUE |
| campaign_id | INTEGER | NOT NULL |
| bind_url | TEXT | |
| tracking_id | TEXT | |
| user_info | TEXT | |
| status | TEXT | DEFAULT 'active' |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| logged_in_at | DATETIME | |
| last_activity | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 6.2 Database Relationships
- Campaigns reference EmailTemplates, LandingPages, SendingProfiles, UserGroups
- GroupUsers belong to UserGroups
- tracking_pixels reference Campaigns
- open_logs reference tracking_pixels
- captured_credentials reference Campaigns
- captured_cookies reference Campaigns

---

## 7. Security Requirements

### 7.1 Authentication Security
- Passwords stored as bcrypt hashes with 10 salt rounds
- JWT tokens with 1-hour expiration
- Secure token transmission over HTTPS
- Default admin credentials on first install

### 7.2 Data Security
- Sensitive data (passwords, cookies) stored in database
- No plain-text password storage
- Encrypted communication channels

### 7.3 Network Security
- CORS configuration for controlled access
- Helmet.js for security headers
- Rate limiting on authentication endpoints (recommended)

### 7.4 Application Security
- Input validation on all user inputs
- Prepared SQL statements to prevent injection
- XSS prevention in HTML rendering
- File upload restrictions (type and size)

---

## 8. Appendices

### 8.1 Technology Stack
- **Backend**: Node.js, Express.js
- **Frontend**: React.js, Tailwind CSS, Ant Design
- **Database**: SQLite
- **Real-time**: Socket.IO
- **Browser Automation**: Puppeteer, Selenium WebDriver
- **Email**: Nodemailer
- **Security**: bcrypt, jsonwebtoken, helmet

### 8.2 Default Credentials
- Username: `admin`
- Password: `admin123`
- Email: `admin@example.com`

### 8.3 API Port Configuration
- Backend: Port 5001 (configurable via environment)
- Frontend: Port 5173 (Vite development server)

### 8.4 Environment Variables
- `PORT`: Server port (default: 5001)
- `JWT_SECRET`: Secret key for JWT signing
- `NGROK_AUTH_TOKEN`: Ngrok authentication token (optional)

---

**End of Document**
