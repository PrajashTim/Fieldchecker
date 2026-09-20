import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import MapPage from './components/MapPage';
import SourcesPage from './components/SourcesPage';
import mockData from './data/mockState.json';
import { DEFAULT_PICKUP_MINUTES } from './lib/pickup';
import './App.css';

function pageFromHash() {
  if (window.location.hash === '#sources') return 'sources';
  if (window.location.hash === '#map') return 'map';
  return 'home';
}

function defaultPickupDate() {
  const dates = Object.keys(mockData.schedule).sort();
  const today = new Date().toLocaleDateString('en-CA');
  return dates.includes(today) ? today : dates[0];
}

function App() {
  const [page, setPage] = useState(pageFromHash);
  const [selectedDate, setSelectedDate] = useState(defaultPickupDate);
  const [pickupMinutes, setPickupMinutes] = useState(DEFAULT_PICKUP_MINUTES);
  const [filterTurf, setFilterTurf] = useState(true);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const pickup = {
    selectedDate,
    setSelectedDate,
    pickupMinutes,
    setPickupMinutes,
    filterTurf,
    setFilterTurf,
  };

  return (
    <div className="app-container">
      <Header page={page} />
      {page === 'sources' ? <SourcesPage /> : page === 'map' ? <MapPage pickup={pickup} /> : <Dashboard pickup={pickup} />}
    </div>
  );
}

export default App;
