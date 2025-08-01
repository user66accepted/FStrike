import React, { useState, useEffect } from 'react';

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Dashboard from '../Modules/Dashboard';
import Campaigns from '../Modules/Campaigns/Campaigns';
import UsersAndGroups from '../Modules/UsersAndGroups';
import EmailTemplates from '../Modules/EmailTemplates';
import LandingPages from '../Modules/LandingPages';
import SendingProfiles from '../Modules/SendingProfiles';
import AccountSettings from '../Modules/AccountSettings/AccountSettings';
import UserManagement from '../Modules/UserManagement';
import Webhooks from '../Modules/Webhooks';

function HomePage() {
    const [activeItem, setActiveItem] = useState(() => {
        return localStorage.getItem("activeItem") || "Dashboard";
    });

    useEffect(() => {
        localStorage.setItem("activeItem", activeItem);
    }, [activeItem]);

    const renderModule = () => {
        switch (activeItem) {
            case "Dashboard":
                return <Dashboard />;
            case "Campaigns":
                return <Campaigns />;
            case "Users & Groups":
                return <UsersAndGroups />;
            case "Email Templates":
                return <EmailTemplates />;
            case "Landing Pages":
                return <LandingPages />;
            case "Sending Profiles":
                return <SendingProfiles />;
            case "Account Settings":
                return <AccountSettings />;
            case "User Settings":
                return <UserManagement />;
            case "Webhooks":
                return <Webhooks />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f14 0%, #1a252f 50%, #0d1b2a 100%)' }}>
          {/* Fixed Header */}
          <Header />
      
          {/* Main Layout Container */}
          <div className="flex pt-20"> {/* Add padding-top to account for fixed header */}
            {/* Sidebar */}
            <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} />
            
            {/* Main Content Area */}
            <main className="flex-1 ml-80"> {/* Add left margin to account for sidebar width */}
              {renderModule()}
            </main>
          </div>
        </div>
      );
}

export default HomePage;
