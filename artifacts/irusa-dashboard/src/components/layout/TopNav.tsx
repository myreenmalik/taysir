import { Link, useLocation } from "wouter";

export function TopNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/events", label: "Events" },
    { href: "/donors", label: "Donors" },
    { href: "/tasks", label: "Tasks" },
    { href: "/reports", label: "Reports" },
    { href: "/import", label: "Import" },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  return (
    <header className="sticky top-0 z-20 bg-background/75 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-4">
        <div className="flex items-end justify-between gap-8">
          {/* Wordmark */}
          <div className="flex flex-col">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium mb-1.5">
              Islamic Relief USA
            </p>
            <Link href="/" className="flex items-baseline gap-2.5 leading-none">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                Taysir<span className="text-primary">.</span>
              </h1>
              <span lang="ar" dir="rtl" className="font-arabic text-xl font-normal text-muted-foreground/80">
                تيسير
              </span>
            </Link>
          </div>

          {/* Inline nav */}
          <nav className="flex items-center gap-7 pb-1.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-sm font-medium transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] bg-foreground" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right meta */}
          <div className="flex flex-col items-end pb-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
              Tracking & Organizing
            </p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              for non-profits
            </p>
          </div>
        </div>
      </div>

      {/* Editorial divider rule */}
      <div className="max-w-7xl mx-auto px-8">
        <div className="h-px bg-foreground/85" />
      </div>
    </header>
  );
}
