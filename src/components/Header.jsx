import React from 'react';
import mockData from '../data/mockState.json';

const Header = ({ page }) => {
  const date = new Date(mockData.lastUpdated);
  const formattedDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="header">
      <div className="container header-content">
        <a href="#" className="logo">
          <span className="logo-icon">⚽</span>
          NoVA Field Check
        </a>
        <nav className="site-nav" aria-label="Main">
          <a href="#" className={page === 'home' ? 'is-active' : undefined}>Fields</a>
          <a href="#map" className={page === 'map' ? 'is-active' : undefined}>Map version</a>
          <a href="#sources" className={page === 'sources' ? 'is-active' : undefined}>Sources</a>
        </nav>
        <div className="last-updated">
          <span>Last updated: {formattedDate}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
