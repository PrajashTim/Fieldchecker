import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import MapPage from './components/MapPage';
import SourcesPage from './components/SourcesPage';
import './App.css';

function pageFromHash() {
  if (window.location.hash === '#sources') return 'sources';
  if (window.location.hash === '#map') return 'map';
  return 'home';
}

function App() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="app-container">
      <Header page={page} />
      {page === 'sources' ? <SourcesPage /> : page === 'map' ? <MapPage /> : <Dashboard />}
    </div>
  );
}

export default App;
