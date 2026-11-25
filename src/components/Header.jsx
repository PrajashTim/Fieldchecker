import React from 'react';
import mockData from '../data/mockState.json';
import { relativeUpdated } from '../lib/pickup';
import { IconLayers, IconList, IconMap, LogoMark } from './Icons';

const TABS = [
  { key: 'home', href: '#', label: 'Fields', Icon: IconList },
  { key: 'map', href: '#map', label: 'Map', Icon: IconMap },
  { key: 'sources', href: '#sources', label: 'Sources', Icon: IconLayers },
];

const Header = ({ page }) => {
  const updated = new Date(mockData.lastUpdated);
  const exact = updated.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <a href="#" className="logo">
            <LogoMark />
            <span>Field<b>Check</b></span>
          </a>
          <nav className="site-nav" aria-label="Main">
            {TABS.map(({ key, href, label, Icon }) => (
              <a key={key} href={href} className={page === key ? 'is-active' : undefined}>
                <Icon size={16} /> {label}
              </a>
            ))}
          </nav>
          <span className="updated-pill" title={`Schedules last updated ${exact}`}>
            <span className="live-dot" /> Updated {relativeUpdated(mockData.lastUpdated)}
          </span>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Main">
        {TABS.map(({ key, href, label, Icon }) => (
          <a key={key} href={href} className={page === key ? 'is-active' : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </>
  );
};

export default Header;
