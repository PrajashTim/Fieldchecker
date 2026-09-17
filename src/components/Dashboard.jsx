import React, { useState } from 'react';
import FieldCard from './FieldCard';
import mockData from '../data/mockState.json';

const PICKUP_DURATION_MINUTES = 120;
const EVENT_DURATION_MINUTES = 150;
const EVENT_SETUP_BUFFER_MINUTES = 30;

function parseStartMinutes(timeText = '') {
  const match = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

function overlapsPickupWindow(events, pickupStart) {
  const pickupEnd = pickupStart + PICKUP_DURATION_MINUTES;
  return events.some(event => {
    const eventStart = parseStartMinutes(event.time);
    if (eventStart === null) return true;
    const blockedStart = eventStart - EVENT_SETUP_BUFFER_MINUTES;
    const blockedEnd = eventStart + EVENT_DURATION_MINUTES;
    return pickupStart < blockedEnd && pickupEnd > blockedStart;
  });
}

const Dashboard = () => {
  const { schedule, sourceHealth = {} } = mockData;
  const availableDates = Object.keys(schedule).sort();
  
  // Always default to actual today's date in local time, not just the first date in the JSON
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const defaultDate = availableDates.includes(todayStr) ? todayStr : availableDates[0];

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [filter630, setFilter630] = useState(false);
  const [filter800, setFilter800] = useState(false);
  const [filterTurf, setFilterTurf] = useState(true); // turf on by default

  // Only show dates from today onward
  const filteredDates = availableDates.filter(d => d >= todayStr);

  // Get the fields for the currently selected date
  const fieldsForDate = schedule[selectedDate] || [];

  const checkAvailability = (field) => {
    // If we only want turf, and it's not turf, drop it.
    if (filterTurf && field.type.toLowerCase() !== 'turf') {
      return false;
    }

    if (!filter630 && !filter800) return true;

    if (filter630) {
      const hasEveningBlock = overlapsPickupWindow(field.events, 18 * 60 + 30);
      if (hasEveningBlock) return false;
    }

    if (filter800) {
      const hasMorningBlock = overlapsPickupWindow(field.events, 8 * 60);
      if (hasMorningBlock) return false;
    }
    
    // If the filters are active and the specific block isn't taken, it is available for that block regardless of daytime events!
    return true;
  };

  const formatDateLabel = (dateStr) => {
    const today = new Date().toLocaleDateString('en-CA');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
    if (dateStr === today) return `Today (${dateStr})`;
    if (dateStr === tomorrowStr) return `Tomorrow (${dateStr})`;
    return dateStr;
  };

  const displayedFields = fieldsForDate.filter(checkAvailability);

  return (
    <main className="container dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Check known field conflicts before pickup</h2>
          <p className="dashboard-subtitle">
            Schedule signals from FXA Sports · Chantilly HS · Westfield HS · Centreville HS · and more
          </p>
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
              {filteredDates.map((dateStr) => (
                <option key={dateStr} value={dateStr}>{formatDateLabel(dateStr)}</option>
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

      {Object.values(sourceHealth).some(source => !source?.ok) && (
        <div className="source-warning" role="status">
          <strong>Availability is partially unverified.</strong>
          <span>
            One or more schedule sources are unavailable. Confirmed conflicts are shown, but an empty schedule does not mean a field is open.
          </span>
        </div>
      )}

      <div className="fields-grid">
        {displayedFields.map((field) => (
          <FieldCard key={field.id} field={field} filter630={filter630} filter800={filter800} selectedDate={selectedDate} todayStr={todayStr} />
        ))}
      </div>
      
      {displayedFields.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No fields found matching your filters for this date.
        </div>
      )}

      <footer className="site-footer">
        <p className="footer-disclaimer">
          Advisory only. A clear result means no conflict was found in the connected sources; it is not a reservation or guarantee of access.
        </p>
      </footer>
    </main>
  );
};

export default Dashboard;
