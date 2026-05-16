"use client";

import React from 'react';
import { useDarkMode } from './DarkModeContext';

const Header: React.FC = () => {
  const { dark } = useDarkMode();

  return (
    <header className={`p-4 shadow-lg transition-colors duration-300 ${dark ? 'bg-gray-900 border-b border-gray-700' : 'bg-gradient-to-r from-blue-600 to-purple-700'}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Family Cable Network</h1>
        <div className="flex items-center space-x-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium text-white ${dark ? 'bg-white/10 border border-white/20' : 'bg-white/20'}`}>
            Admin Panel
          </span>
          {dark && (
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 font-medium">
              Dark Mode
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;