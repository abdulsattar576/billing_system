"use client";

import Link from "next/link";
import React from "react";


export default function DashboardLayout({ children }: any) {
  return (
    <div className="dashboard-container w-full min-h-screen" >
      
      {/* Top Navigation */}
      <header className="dashboard-topbar">
       
      </header>

      <div className="dashboard-content">
        
        {/* Left Sidebar */}
   
         
       

        {/* Main Content */}
        <main className="dashboard-main">
          {children}
        </main>

      </div>
    </div>
  );
}
