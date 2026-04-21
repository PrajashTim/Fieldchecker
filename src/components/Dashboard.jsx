import React, { useState } from 'react';
import FieldCard from './FieldCard';
import mockData from '../data/mockState.json';

const Dashboard = () => {
  const { schedule } = mockData;
  const availableDates = Object.keys(schedule).sort();
  
  // Default to the first available date (today)
  const [selectedDate, setSelectedDate] = useState(availableDates[0]);
  const [filter630, setFilter630] = useState(false);
  const [filter800, setFilter800] = useState(false);
  const [filterTurf, setFilterTurf] = useState(false);

  // Get the fields for the currently selected date
  const fieldsForDate = schedule[selectedDate] || [];

  const checkAvailability = (field) => {
    // If we only want turf, and it's not turf, drop it.
    if (filterTurf && field.type.toLowerCase() !== 'turf') {
      return false;
    }

    if (!filter630 && !filter800) return true;

    if (filter630) {
      const hasEveningBlock = field.events.some(e => 
        e.time.includes('6:00') || e.time.includes('6:30') || e.time.includes('7:00') || e.time.includes('8:00 PM') || e.time.includes('8:30 PM')
      );
      if (hasEveningBlock) return false;
    }

    if (filter800) {
      const hasMorningBlock = field.events.some(e => 
        e.time.includes('8:00 AM') || e.time.includes('8:30 AM') || e.time.includes('9:00 AM') || e.time.includes('10:00 AM')
      );
      if (hasMorningBlock) return false;
    }
    
    // If the filters are active and the specific block isn't taken, it is available for that block regardless of daytime events!
    return true;
  };

  const formatDateLabel = (dateStr, index) => {
    if (index === 0) return `Today (${dateStr})`;
    if (index === 1) return `Tomorrow (${dateStr})`;
    return dateStr;
  };

  const displayedFields = fieldsForDate.filter(checkAvailability);

  return (
    <main className="container dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Live Field Status</h2>
          <p className="dashboard-subtitle">Real-time availability for pickup soccer in NoVA</p>
        </div>
        
        <div className="controls-group">
          <div className="date-picker-wrap">
            <label htmlFor="scheduleDate">Select Date:</label>
            <select 
              id="scheduleDate"
              className="glass-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {availableDates.map((dateStr, idx) => (
                <option key={dateStr} value={dateStr}>{formatDateLabel(dateStr, idx)}</option>
              ))}
            </select>
          </div>

          <button 
            className={`filter-btn ${filterTurf ? 'active' : ''}`}
            onClick={() => setFilterTurf(!filterTurf)}
          >
            {filterTurf ? '🌿 Turf Only' : '🌿 Show Turf'}
          </button>

          <button 
            className={`filter-btn ${filter630 ? 'active' : ''}`}
            onClick={() => setFilter630(!filter630)}
          >
            {filter630 ? '⏱️ 6:30 PM+ Open' : '⏱️ Check 6:30 PM'}
          </button>
          
          <button 
            className={`filter-btn ${filter800 ? 'active' : ''}`}
            onClick={() => setFilter800(!filter800)}
          >
            {filter800 ? '☀️ 8:00 AM+ Open' : '☀️ Check 8:00 AM'}
          </button>
        </div>
      </div>

      <div className="fields-grid">
        {displayedFields.map((field) => (
          <FieldCard key={field.id} field={field} />
        ))}
      </div>
      
      {displayedFields.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No fields found matching your filters for this date.
        </div>
      )}
    </main>
  );
};

export default Dashboard;
