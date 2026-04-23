import React from 'react';
import mockData from '../data/mockState.json';

const Header = () => {
  const date = new Date(mockData.lastUpdated);
  const formattedDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="header">
      <div className="container header-content">
        <div className="logo">
          <span className="logo-icon">⚽</span>
          NoVA Field Check
        </div>
        <div className="last-updated">
          Last updated: {formattedDate}
        </div>
      </div>
    </header>
  );
};

export default Header;
