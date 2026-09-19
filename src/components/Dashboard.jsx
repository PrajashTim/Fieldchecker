import React, { useState } from 'react';
import FieldCard from './FieldCard';
import { DirectionsLink } from './DirectionsLink';
import mockData from '../data/mockState.json';
import {
  DEFAULT_PICKUP_MINUTES,
  MORNING_PICKUP_MINUTES,
  PERMIT_DISCLAIMER,
  TIME_OPTIONS,
  formatClock,
  formatFriendlyDate,
  hubRank,
  overlapsPickupWindow,
  pickBestField,
  turfFilterLabel,
} from '../lib/pickup';

function connectedSubtitle(sourceHealth) {
  const named = [
    sourceHealth.fxa?.ok && 'FXA',
    sourceHealth.ncsl?.eventCount > 0 && 'NCSL/Demosphere',
    sourceHealth.sya?.eventCount > 0 && 'SYA',
    sourceHealth.nvsl?.eventCount > 0 && 'NVSL',
    sourceHealth.fsl?.eventCount > 0 && 'FSL',
    sourceHealth.fwsa?.eventCount > 0 && 'FWSA',
    sourceHealth.nvasa?.eventCount > 0 && 'NVASA',
  ].filter(Boolean);
  const prefix = named.length
    ? `Public schedules from ${named.join(', ')}, and high-school athletics.`
    : 'Public schedules from FXA and high-school athletics.';
  return `${prefix} Open still cannot confirm private permits.`;
}

const Dashboard = () => {
  const { schedule, sourceHealth = {} } = mockData;
  const availableDates = Object.keys(schedule).sort();
  const todayStr = new Date().toLocaleDateString('en-CA');
  const defaultDate = availableDates.includes(todayStr) ? todayStr : availableDates[0];

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [pickupMinutes, setPickupMinutes] = useState(DEFAULT_PICKUP_MINUTES);
  const [filterTurf, setFilterTurf] = useState(true);

  const filteredDates = availableDates.filter(d => d >= todayStr);
  const fieldsForDate = schedule[selectedDate] || [];
  const pickupLabel = formatClock(pickupMinutes);
  const dateLabel = formatFriendlyDate(selectedDate, todayStr);

  const displayedFields = fieldsForDate.filter(field => !filterTurf || field.type.toLowerCase() === 'turf');
  const openAtPickup = displayedFields.filter(field => !overlapsPickupWindow(field.events, pickupMinutes));
  const recommendation = pickBestField(openAtPickup);
  const unexpectedFailures = Object.values(sourceHealth).filter(source => (
    source && !source.ok && source.provider !== 'fairfax-county-permits'
  ));

  const setPresetTime = (minutes) => {
    setPickupMinutes(current => (current === minutes ? current : minutes));
  };

  const recHub = recommendation ? hubRank(recommendation.id)[0] : null;
  const why = recHub === 0
    ? 'Chantilly High School is the group midpoint, and it is clear at this time in connected public schedules.'
    : recHub === 1
      ? 'Chantilly High School is booked at this time. Sully Highlands Park is the next hub pick.'
      : recommendation
        ? 'Chantilly High School and Sully Highlands Park are booked at this time. Next pick is the closest remaining field.'
        : '';

  return (
    <main className="container dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Check known field conflicts before pickup</h2>
          <p className="dashboard-subtitle">
            {connectedSubtitle(sourceHealth)}
            {' '}<a href="#sources">How we check this</a>
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
                <option key={dateStr} value={dateStr}>{formatFriendlyDate(dateStr, todayStr)}</option>
              ))}
            </select>
          </div>

          <div className="date-picker-wrap">
            <label htmlFor="pickupTime">Pickup time:</label>
            <select
              id="pickupTime"
              className="glass-select"
              value={String(pickupMinutes)}
              onChange={(e) => setPickupMinutes(Number(e.target.value))}
            >
              {TIME_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`filter-btn ${filterTurf ? 'active' : ''}`}
            aria-pressed={filterTurf}
            onClick={() => setFilterTurf(!filterTurf)}
          >
            {turfFilterLabel(filterTurf)}
          </button>

          <button 
            className={`filter-btn ${pickupMinutes === DEFAULT_PICKUP_MINUTES ? 'active' : ''}`}
            onClick={() => setPresetTime(DEFAULT_PICKUP_MINUTES)}
          >
            ⏱️ 6:30 PM+ Open
          </button>
          
          <button 
            className={`filter-btn ${pickupMinutes === MORNING_PICKUP_MINUTES ? 'active' : ''}`}
            onClick={() => setPresetTime(MORNING_PICKUP_MINUTES)}
          >
            ☀️ 8:00 AM+ Open
          </button>
        </div>
      </div>

      {unexpectedFailures.length > 0 && (
        <div className="source-warning" role="status">
          <strong>A connected schedule feed failed.</strong>
          <span>
            {unexpectedFailures.map(source => source.provider).join(', ')} did not update this snapshot. Confirmed conflicts from healthy sources are still shown.
          </span>
        </div>
      )}

      <section className="recommendation" aria-label="Best field available">
        <p className="recommendation-kicker">Best field available</p>
        {recommendation ? (
          <>
            <h3 className="recommendation-title">
              {recommendation.name}
              {recommendation.subfield ? ` · ${recommendation.subfield}` : ''}
            </h3>
            <p className="recommendation-when">
              Open {dateLabel} at {pickupLabel}
              <DirectionsLink field={recommendation} className="directions-link directions-link-inline" />
            </p>
            <p className="recommendation-why">{why}</p>
            <p className="recommendation-disclaimer">{PERMIT_DISCLAIMER}</p>
          </>
        ) : (
          <p className="recommendation-why">
            No connected-source opening at {pickupLabel} on {dateLabel}. Try another time.
          </p>
        )}
      </section>

      <div className="fields-grid">
        {displayedFields.map((field) => (
          <FieldCard
            key={field.id}
            field={field}
            pickupLabel={pickupLabel}
            dateLabel={dateLabel}
            isRecommended={recommendation?.id === field.id}
            overlapsPickup={overlapsPickupWindow(field.events, pickupMinutes)}
          />
        ))}
      </div>
      
      {displayedFields.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No fields found matching your filters for this date.
        </div>
      )}

      <footer className="site-footer">
        <p className="footer-disclaimer">
          Advisory only. Open means no conflict was found in connected public schedules. It is not a reservation and does not include county/school permits or private team calendars. The top pick prefers Chantilly High School, then Sully Highlands Park, then the next-closest field.
        </p>
      </footer>
    </main>
  );
};

export default Dashboard;
