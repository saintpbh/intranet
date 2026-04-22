import { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import { Link } from 'react-router-dom';
import ApiImage from './ApiImage';

const AdminApp = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <ApiImage src="/assets/admin_logo.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>관리자</h1>
          </div>
          <Link to="/" className="header-nav-link">홈</Link>
        </div>
      </header>
      <main className="app-main">
        <AdminDashboard />
      </main>
    </div>
  );
};

export default AdminApp;
