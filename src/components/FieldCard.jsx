import React from 'react';

const FieldCard = ({ field }) => {
  const { name, subfield, location, status, statusReason, events } = field;

  // Determine status color class
  let statusClass = 'status-unknown';
  let statusLabel = 'Unknown';

  if (status === 'open') {
    statusClass = 'status-open';
    statusLabel = 'Available Now';
  } else if (status === 'occupied') {
    statusClass = 'status-occupied';
    statusLabel = 'Occupied / Scheduled';
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
          {statusReason}
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
          <div className="status-reason" style={{ opacity: 0.6 }}>No events scheduled on this field today.</div>
        )}
      </div>
    </div>
  );
};

export default FieldCard;
