"use client";

import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGauge,
  faLocationDot,
  faUserPlus,
  faUserMinus,
  faPenToSquare,
  faSearch,
  faClipboardList,
  faReceipt,
  faFileLines,
  faRightToBracket,
  faGlobe,
  faExclamationTriangle,
  faHistory,
  faBan,
  faCreditCard,
  faSun,
  faMoon,
} from "@fortawesome/free-solid-svg-icons";
import Link from 'next/link';
import { useDarkMode } from './DarkModeContext';
// icons for sidebar menu
const menuItems = [
  { name: "Dashboard", icon: faGauge, href: "/dashboard" }, // <-- NEW ITEM
  { name: "Add Area", icon: faLocationDot, href: "/areas" },
  { name: "Add Connection", icon: faUserPlus, href: "/persons" },
  
  { name: "Delete Connection", icon: faUserMinus, href: "/remove" },
  // { name: "Update Record", icon: faPenToSquare, href: "/update-record" },
  { name: "Find Record", icon: faSearch, href: "/searchperson" },
 
  // { name: "Find Person Record", icon: faClipboardList, href: "/find-person" },
 
  { name: "Report Menu", icon: faFileLines, href: "/ReportMenu" },
  { name: "Cash Received", icon: faReceipt, href: "/debitNote" },
  { name: "Credit Note", icon: faCreditCard, href: "/credit-note" },
  { name: "Person Records", icon: faHistory, href: "/person-records" },
  { name: "Disconnection List", icon: faBan, href: "/disconnection-list" },
  { name: "Defaulter Lists", icon: faExclamationTriangle, href: "/defaulter-lists" },
  { name: "Internet Entry", icon: faGlobe, href: "/Internet-entery-page" },
   { name: "Internet Report", icon: faGlobe, href: "/InternetReport" },
   { name: "Login", icon: faRightToBracket, href: "/login" },

];

const Sidebar: React.FC = () => {
  const { dark, toggle } = useDarkMode();

  return (
    <div className="w-64 flex flex-col h-screen bg-white dark:bg-gray-900 shadow-xl border-r border-gray-200 dark:border-gray-700">
      {/* Brand */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">FCN-Management</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control Center</p>
      </div>

      {/* Nav links — scrollable */}
      <nav className="mt-4 flex-1 overflow-y-auto">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.href}
            className="flex items-center px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 border-l-4 border-transparent hover:border-blue-500"
          >
            <FontAwesomeIcon icon={item.icon} className="mr-3 text-lg" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Dark mode toggle — pinned to bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${dark ? 'bg-indigo-600 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
              <FontAwesomeIcon icon={dark ? faMoon : faSun} className="text-sm" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {dark ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>

          {/* Toggle pill */}
          <div className={`relative w-11 h-6 rounded-full transition-all duration-300 ${dark ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${dark ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
