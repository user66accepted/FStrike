import React from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import AccountSettingsTab from "./AccountSettingsTab";

const AccountsSettings = () => {
  return (
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Settings</h1>
      <hr className="my-4 bg-gray-300 mb-18 mt-8" />

      <Tabs>
        <TabList>
          <Tab>Account Settings</Tab>
          <Tab>UI Settings</Tab>
          <Tab>Reporting Settings</Tab>
        </TabList>
          <AccountSettingsTab />
        <TabPanel>
         
        </TabPanel>
        <TabPanel>
          
        </TabPanel>
        <TabPanel>
          
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default AccountsSettings;
