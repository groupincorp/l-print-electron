import { useState } from "react";
import { Sidebar, type AppPage } from "./sidebar";
import { Topbar } from "./topbar";
import { PrintQueue } from "@/components/gui/print-queue";
import { PrintSocket } from "@/components/gui/print-socket";
import { ServerForm } from "@/components/gui/server-form";
import { PrinterList } from "@/components/gui/printer-list";

interface AppShellProps {
  token: string | null;
}

export function AppShell({ token }: AppShellProps) {
  const [activePage, setActivePage] = useState<AppPage>("queue");
  const [queueCount, setQueueCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        queueCount={queueCount}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar activePage={activePage} isConnected={isConnected} />

        <main className="flex-1 overflow-auto">
          {activePage === "queue" && (
            <PrintQueue
              token={token}
              onQueueCountChange={setQueueCount}
              onConnectionChange={setIsConnected}
            />
          )}
          {activePage === "socket" && (
            <PrintSocket onConnectionChange={setIsConnected} />
          )}
          {activePage === "printers" && <PrinterList />}
          {activePage === "settings" && (
            <ServerForm onSave={() => {}} embedded />
          )}
        </main>
      </div>
    </div>
  );
}
