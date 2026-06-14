import {
  LayoutDashboard,
  Radio,
  Settings,
  Printer,
  ChevronRight,
} from "lucide-react";

export type AppPage = "queue" | "socket" | "settings";

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface SidebarProps {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
  queueCount?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "queue", label: "Dashboard", icon: LayoutDashboard },
  { id: "socket", label: "Socket Monitor", icon: Radio },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activePage,
  onPageChange,
  queueCount = 0,
}: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen overflow-hidden">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
          <Printer className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">
            Printer Manager
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Restaurant POS
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`
                w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium
                transition-all duration-150 group relative
                ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
                }
              `}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.id === "queue" && queueCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {queueCount > 99 ? "99+" : queueCount}
                </span>
              )}
              {isActive && (
                <ChevronRight className="w-3 h-3 text-primary opacity-60" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <p className="text-[11px] text-muted-foreground text-center">
          v1.1.0 · Restaurant POS
        </p>
      </div>
    </aside>
  );
}
