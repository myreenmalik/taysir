import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, BarChart3, Upload } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/events", label: "Events", icon: Calendar },
    { href: "/donors", label: "Donors", icon: Users },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/import", label: "Import Data", icon: Upload },
  ];

  return (
    <div className="w-64 border-r border-sidebar-border bg-sidebar h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">IRUSA Smart Dashboard</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === item.href || (item.href !== "/" && location.startsWith(item.href))
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
