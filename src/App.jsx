import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import MapPage from './components/MapPage';
import SourcesPage from './components/SourcesPage';
import mockData from './data/mockState.json';
import { DEFAULT_PICKUP_MINUTES } from './lib/pickup';
import './App.css';

const PHONE_QUERY = '(max-width: 860px)';

function pageFromHash() {
  const { hash } = window.location;
  if (hash === '#sources') return 'sources';
  if (hash === '#map') return 'map';
  if (hash === '#fields') return 'home';
  // No tab picked yet: phones start on the map, desktop on the field list.
  return window.matchMedia?.(PHONE_QUERY).matches ? 'map' : 'home';
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
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
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
    <div className={`app-container${page === 'map' ? ' is-map' : ''}`}>
      <Header page={page} />
      {page === 'sources' ? <SourcesPage /> : page === 'map' ? <MapPage pickup={pickup} /> : <Dashboard pickup={pickup} />}
    </div>
  );
}

export default App;
