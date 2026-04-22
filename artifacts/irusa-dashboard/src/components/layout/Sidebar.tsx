import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, BarChart3, Upload, ListChecks } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/events", label: "Events", icon: Calendar },
    { href: "/donors", label: "Donors", icon: Users },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/import", label: "Import Data", icon: Upload },
  ];

  return (
    <div className="w-64 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md h-screen flex flex-col fixed left-0 top-0 z-10">
      <div className="px-6 pt-8 pb-6 border-b border-sidebar-border">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-3">
          Islamic Relief USA
        </p>
        <h1 className="text-2xl font-bold text-sidebar-foreground flex items-baseline gap-2 leading-none tracking-tight">
          Taysir<span className="text-primary">.</span>
          <span lang="ar" dir="rtl" className="font-arabic text-lg font-normal text-muted-foreground">تيسير</span>
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-5 border-t border-sidebar-border">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Tracking & Organizing
        </p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          for non-profits
        </p>
      </div>
    </div>
  );
}
