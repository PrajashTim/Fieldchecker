import React from 'react';

const FieldCard = ({ field, filter630, filter800, selectedDate, todayStr }) => {
  const { name, subfield, location, status, statusReason, events, unavailableSources = [] } = field;

  // Determine status color class
  let statusClass = 'status-unknown';
  let statusLabel = 'Unknown';
  let displayReason = statusReason;

  const isTimeFilterActive = filter630 || filter800;

  const isToday = selectedDate === todayStr;
  const dateLabel = isToday ? 'Today' : selectedDate;

  if (isTimeFilterActive) {
    const coverageIncomplete = status === 'unknown' || unavailableSources.length > 0;
    statusClass = coverageIncomplete ? 'status-unknown' : 'status-open';

    let timeLabel = '';
    if (filter630 && filter800) timeLabel = '8:00 AM & 6:30 PM';
    else if (filter630) timeLabel = '6:30 PM+';
    else if (filter800) timeLabel = '8:00 AM+';

    statusLabel = coverageIncomplete ? `Not verified at ${timeLabel}` : `No known conflict at ${timeLabel}`;

    if (status === 'occupied' && !coverageIncomplete) {
      displayReason = `Known events do not overlap your requested time on ${dateLabel}.`;
    } else if (coverageIncomplete) {
      displayReason = 'No overlapping event was found, but permit coverage is incomplete.';
    } else if (status === 'open') {
      displayReason = 'Schedule clears - no events all day.';
    }
  } else {
    if (status === 'open') {
      statusClass = 'status-open';
      statusLabel = `Available on ${dateLabel}`;
    } else if (status === 'occupied') {
      statusClass = 'status-occupied';
      statusLabel = 'Occupied / Scheduled';
    } else {
      statusClass = 'status-unknown';
      statusLabel = 'Availability not verified';
    }
  }

  return (
    <div className="glass-panel field-card">
      <div className="field-header">
        <h3 className="field-name">{name}</h3>
        {subfield && <span className="field-subfield">{subfield}</span>}
      </div>
      
      <div className="field-location">
        <span>📍 {location}</span>
      </div>

      <div className={`field-status-block ${statusClass}`}>
        <div className="status-row status-indicator">
          <span className="status-dot"></span>
          <span>{statusLabel}</span>
        </div>
        
        <div className="status-reason">
          {displayReason}
        </div>
      </div>

      <div className="schedule-container">
        <div className="schedule-title">Full Day Schedule</div>
        {events && events.length > 0 ? (
          <ul className="schedule-list">
            {events.map((evt, idx) => (
              <li key={idx} className="schedule-item">
                <span className="schedule-time">{evt.time}</span>
                <span className="schedule-event">{evt.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="status-reason" style={{ opacity: 0.75 }}>
            {status === 'unknown'
              ? `No conflicts were detected for ${dateLabel}, but source coverage is incomplete.`
              : `No events scheduled on ${dateLabel}.`}
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldCard;
