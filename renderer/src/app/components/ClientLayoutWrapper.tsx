"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import DBInitializer from "./DBInitializer";
import { DarkModeProvider } from "./DarkModeContext";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWelcome = pathname === "/" || pathname === "" || pathname.startsWith("/login");

  return (
    <DarkModeProvider>
      <div className={`flex h-screen ${isWelcome ? 'bg-black text-white' : ''}`}>
        {!isWelcome && <Sidebar />}
        <main className={`flex-1 overflow-y-auto ${isWelcome ? 'min-h-screen p-0 flex items-center justify-center' : 'bg-gray-50 dark:bg-gray-900'}`}>
          {!isWelcome && <DBInitializer />}
          {children}
        </main>
      </div>
    </DarkModeProvider>
  );
}
