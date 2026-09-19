import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import SourcesPage from './components/SourcesPage';
import './App.css';

function pageFromHash() {
  return window.location.hash === '#sources' ? 'sources' : 'home';
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
      <Header />
      {page === 'sources' ? <SourcesPage /> : <Dashboard />}
    </div>
  );
}

export default App;
