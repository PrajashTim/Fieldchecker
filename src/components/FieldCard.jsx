import React from 'react';
import { DirectionsLink } from './DirectionsLink';

const PERMIT_DISCLAIMER =
  'Could not verify county or school permits, private/member practice schedules, or walk-on use. A permitted group can still have the field.';

const FieldCard = ({ field, pickupLabel, dateLabel, isRecommended, overlapsPickup }) => {
  const { name, subfield, location, events } = field;
  let statusClass = 'status-open';
  let statusLabel = `Open ${dateLabel} at ${pickupLabel}`;
  let displayReason = PERMIT_DISCLAIMER;

  if (overlapsPickup) {
    statusClass = 'status-occupied';
    statusLabel = 'Known conflict';
    displayReason = `A connected public schedule overlaps ${pickupLabel} on ${dateLabel}.`;
  }

  return (
    <div className={`glass-panel field-card${isRecommended ? ' field-card-recommended' : ''}`}>
      <div className="field-header">
        <h3 className="field-name">{name}</h3>
        {subfield && <span className="field-subfield">{subfield}</span>}
      </div>
      
      <div className="field-location">
        <span>📍 {location}</span>
        <DirectionsLink field={field} />
      </div>

      {isRecommended && <div className="recommended-badge">Top pick</div>}

      <div className={`field-status-block ${statusClass}`}>
        <div className="status-row status-indicator">
          <span className="status-dot"></span>
          <span>{statusLabel}</span>
        </div>
        
        <div className="status-reason">
          {displayReason}
        </div>
        {!overlapsPickup && events?.length > 0 && (
          <div className="status-reason status-other-events">
            Other connected-source events that day are listed below; they do not overlap {pickupLabel}.
          </div>
        )}
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
                  {evt.source ? <span className="source-chip">{evt.source}</span> : null}
                  {evt.precision === 'exact_subfield' ? <span>exact field</span> : evt.precision ? <span>{evt.precision}</span> : null}
                  {evt.sourceUrl ? (
                    <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
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
