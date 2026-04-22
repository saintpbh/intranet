import API_BASE from '../api';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiImage from './ApiImage';

const Home = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-bar">
          <ApiImage src="/assets/admin_logo.png" alt="한국기독교장로회총회" className="header-logo" />
          <div className="header-title-group">
            <h1>주소록</h1>
          </div>
        </div>
      </header>
      <main className="app-main" style={{padding: '24px 16px'}}>
        <div className="card" style={{marginBottom: '16px'}}>
          <h3 style={{margin: '0 0 8px', color: 'var(--text-primary)'}}>열람망 바로가기</h3>
        </div>
        <Link to="/minister" style={{textDecoration:'none'}}>
          <div className="result-row">
            <span className="result-name">목회자 전용 열람망</span>
            <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
        <Link to="/elder" style={{textDecoration:'none'}}>
          <div className="result-row">
            <span className="result-name">장로 전용 열람망</span>
            <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
        <Link to="/admin" style={{textDecoration:'none'}}>
          <div className="result-row">
            <span className="result-name">관리자 시스템</span>
            <svg className="chevron" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
      </main>
    </div>
  );
};

export default Home;
