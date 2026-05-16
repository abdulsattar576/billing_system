"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface DarkModeContextType {
  dark: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  dark: false,
  toggle: () => {},
});

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("fcn_dark_mode");
    const isDark = saved === "true";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("fcn_dark_mode", String(next));
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  return (
    <DarkModeContext.Provider value={{ dark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
