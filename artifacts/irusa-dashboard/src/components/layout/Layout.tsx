import { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function Layout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen flex flex-col relative">
      <TopNav />
      <main className="flex-1 px-8 pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <footer className="px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-foreground/15 mb-4" />
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
            <span className="flex items-center gap-3">
              <span lang="ar" dir="rtl" className="font-arabic text-base normal-case tracking-normal text-foreground/70">تيسير</span>
              <span className="text-muted-foreground/50">·</span>
              <span>Taysir</span>
              <span className="text-muted-foreground/50">·</span>
              <span>Islamic Relief USA</span>
            </span>
            <span>{year}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
