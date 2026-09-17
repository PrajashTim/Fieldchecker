import React from 'react';

const PERMIT_DISCLAIMER =
  'Could not verify county or school permits, private/member practice schedules, or walk-on use. A permitted group can still have the field.';

const FieldCard = ({ field, filter630, filter800, selectedDate, todayStr }) => {
  const { name, subfield, location, status, events } = field;

  const isTimeFilterActive = filter630 || filter800;
  const isToday = selectedDate === todayStr;
  const dateLabel = isToday ? 'Today' : selectedDate;

  let statusClass = 'status-open';
  let statusLabel = `Open on ${dateLabel}`;
  let displayReason = PERMIT_DISCLAIMER;

  if (isTimeFilterActive) {
    let timeLabel = '';
    if (filter630 && filter800) timeLabel = '8:00 AM & 6:30 PM';
    else if (filter630) timeLabel = '6:30 PM+';
    else if (filter800) timeLabel = '8:00 AM+';

    statusClass = 'status-open';
    statusLabel = `Open at ${timeLabel}`;
    displayReason = status === 'occupied'
      ? `No connected-source event overlaps that window on ${dateLabel}. ${PERMIT_DISCLAIMER}`
      : PERMIT_DISCLAIMER;
  } else if (status === 'occupied') {
    statusClass = 'status-occupied';
    statusLabel = 'Known conflict';
    displayReason = 'A connected public schedule has this field booked.';
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
              <li key={evt.eventId || idx} className="schedule-item">
                <span className="schedule-time">{evt.time}{evt.status === 'rescheduled' ? ' · rescheduled' : ''}</span>
                <span className="schedule-event">{evt.title}</span>
                <span className="schedule-meta">
                  {[
                    evt.source,
                    evt.precision === 'exact_subfield' ? 'exact field' : evt.precision,
                  ].filter(Boolean).join(' · ')}
                  {evt.sourceUrl ? (
                    <>
                      {(evt.source || evt.precision) ? ' · ' : ''}
                      <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="status-reason" style={{ opacity: 0.75 }}>
            No public-schedule events on {dateLabel}. {PERMIT_DISCLAIMER}
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldCard;
