import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import AccountSettingsTab from "./AccountSettingsTab";
import { FaCog, FaPalette, FaChartBar } from "react-icons/fa";

const AccountsSettings = () => {
  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            System Configuration
          </h1>
        </div>
        <p className="text-cyber-muted">
          Configure system preferences and security settings • Administrative controls
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* Settings Content */}
      <div className="glass-card p-6">
        <Tabs>
          <TabList className="flex space-x-1 mb-6 bg-transparent border-b-2 border-cyber-primary/20">
            <Tab className="px-6 py-3 text-cyber-muted hover:text-cyber-primary cursor-pointer transition-colors border-b-2 border-transparent data-[selected]:border-cyber-primary data-[selected]:text-cyber-primary">
              <div className="flex items-center space-x-2">
                <FaCog />
                <span>Account Settings</span>
              </div>
            </Tab>
            <Tab className="px-6 py-3 text-cyber-muted hover:text-cyber-primary cursor-pointer transition-colors border-b-2 border-transparent data-[selected]:border-cyber-primary data-[selected]:text-cyber-primary">
              <div className="flex items-center space-x-2">
                <FaPalette />
                <span>UI Settings</span>
              </div>
            </Tab>
            <Tab className="px-6 py-3 text-cyber-muted hover:text-cyber-primary cursor-pointer transition-colors border-b-2 border-transparent data-[selected]:border-cyber-primary data-[selected]:text-cyber-primary">
              <div className="flex items-center space-x-2">
                <FaChartBar />
                <span>Reporting Settings</span>
              </div>
            </Tab>
          </TabList>

          <TabPanel>
            <AccountSettingsTab />
          </TabPanel>
          <TabPanel>
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <p className="text-cyber-muted text-lg">UI Settings</p>
              <p className="text-cyber-muted text-sm mt-2">Theme and interface customization options</p>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-cyber-muted text-lg">Reporting Settings</p>
              <p className="text-cyber-muted text-sm mt-2">Configure analytics and report generation</p>
            </div>
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
};

export default AccountsSettings;
