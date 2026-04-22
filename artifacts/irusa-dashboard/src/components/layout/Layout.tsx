import { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <TopNav />
      <main className="flex-1 px-8 pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
