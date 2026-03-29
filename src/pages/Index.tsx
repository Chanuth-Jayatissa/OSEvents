import { useState } from "react";
import NavigationBar from "@/components/NavigationBar";
import CommandCenter from "@/components/CommandCenter";
import VaultView from "@/components/VaultView";
import SponsorHub from "@/components/SponsorHub";
import LogisticsView from "@/components/LogisticsView";
import FinanceView from "@/components/FinanceView";
import { EventBusProvider } from "@/contexts/EventBusContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("command");

  return (
    <EventBusProvider>
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <NavigationBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex overflow-hidden">
          {activeTab === "command" && <CommandCenter />}
          {activeTab === "vault" && <VaultView />}
          {activeTab === "sponsors" && <SponsorHub />}
          {activeTab === "logistics" && <LogisticsView />}
          {activeTab === "finance" && <FinanceView />}
        </div>
      </div>
    </EventBusProvider>
  );
};

export default Index;
