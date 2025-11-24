// src/layouts/AppLayout.jsx
import React from 'react';

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      {/* Global Header */}
      <header className="navbar">
        <div className="brand">
          Excel Access Portal
        </div>
        <div className="row">
          {/* You can inject buttons or theme toggle here */}
        </div>
      </header>

      {/* Page Content */}
      <main className="main-content">{children}</main>

      {/* Global Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Excel Access Portal — All rights reserved.</p>
      </footer>
    </div>
  );
}
