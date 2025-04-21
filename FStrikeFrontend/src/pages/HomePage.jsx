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
        <div className="flex h-screen">
          {/* Fixed Header at the Top */}
          <div className="w-full fixed top-0 left-0 z-50">
            <Header />
          </div>
      
          {/* Sidebar and Main Content Wrapper */}
          <div className="flex flex-1 mt-16"> {/* Adjust margin-top to match header height */}
            <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} />
            
            {/* Main Content - Avoids Header Overlap */}
            <div className="flex-1 p-2">{renderModule()}</div>
          </div>
        </div>
      );
      
}

export default HomePage;
