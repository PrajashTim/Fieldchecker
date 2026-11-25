import React, { useState } from 'react';
import DayTimeline from './DayTimeline';
import { mapsDirectionsUrl } from './DirectionsLink';
import { isPermitChecked, overlappingEvents } from '../lib/pickup';
import {
  IconCheck, IconChevron, IconExternal, IconNav, IconPin, IconShield, IconStar, IconX,
} from './Icons';

const FieldRow = ({ field, siblings, pickupMinutes, pickupLabel, isTop }) => {
  const [open, setOpen] = useState(false);
  const busy = field.overlapsPickup;
  const conflicts = busy ? overlappingEvents(field.events, pickupMinutes) : [];
  const events = field.events || [];
  const label = field.subfield || field.type;

  return (
    <li className={`field-row${busy ? ' is-busy' : ' is-open'}${open ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="field-row-main"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="status-icon">{busy ? <IconX size={14} strokeWidth={3} /> : <IconCheck size={14} strokeWidth={3} />}</span>
        <span className="field-row-text">
          <span className="field-row-name">
            {label}
            {isTop && <span className="mini-badge is-top"><IconStar size={11} /> Top pick</span>}
            {isPermitChecked(field.id) && (
              <span className="mini-badge" title="FCPS community-use permits checked"><IconShield size={11} /> Permits</span>
            )}
          </span>
          <span className="field-row-status">
            {busy
              ? (conflicts[0] ? `Busy · ${conflicts[0].time}` : 'Busy at this time')
              : events.length ? `Free at ${pickupLabel} · ${events.length} other event${events.length > 1 ? 's' : ''}` : `Free all day`}
          </span>
        </span>
        <DayTimeline events={events} pickupMinutes={pickupMinutes} busy={busy} />
        <IconChevron size={16} className="row-chevron" />
      </button>

      {open && (
        <div className="field-row-detail">
          <DayTimeline events={events} pickupMinutes={pickupMinutes} busy={busy} showLabels />
          {events.length > 0 ? (
            <ul className="event-list">
              {events.map((evt, idx) => {
                const hit = conflicts.includes(evt);
                return (
                  <li key={evt.eventId || idx} className={hit ? 'is-hit' : undefined}>
                    <span className="event-time">{evt.time}{evt.status === 'rescheduled' ? ' · moved' : ''}</span>
                    <span className="event-title">{evt.title}</span>
                    <span className="event-meta">
                      {evt.source && <span className="source-chip">{evt.source}</span>}
                      {evt.sourceUrl && (
                        <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Source <IconExternal size={11} />
                        </a>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="event-empty">Nothing on the public schedules for this field today.</p>
          )}
          <a className="text-link" href={mapsDirectionsUrl(field, siblings)} target="_blank" rel="noopener noreferrer">
            <IconNav size={13} /> Directions to this field
          </a>
        </div>
      )}
    </li>
  );
};

const ParkCard = ({ park, pickupMinutes, pickupLabel, recommendationId }) => {
  const openFields = park.fields.filter(f => !f.overlapsPickup).length;
  const total = park.fields.length;
  const tone = openFields === 0 ? 'none' : openFields === total ? 'all' : 'some';

  return (
    <article className={`park-card tone-${tone}`}>
      <header className="park-head">
        <div className="park-title">
          <h3>{park.name}</h3>
          <p>
            <IconPin size={13} /> {park.location}
            {Number.isFinite(park.distance) && park.distance < 99 && (
              <span className="dot-sep">{park.distance === 0 ? 'Home base' : `${park.distance} mi`}</span>
            )}
          </p>
        </div>
        <span className={`count-pill tone-${tone}`}>
          {openFields}/{total} free
        </span>
        <a
          className="icon-btn"
          href={mapsDirectionsUrl(park.fields[0], park.fields)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${park.name}`}
          title="Directions"
        >
          <IconNav size={16} />
        </a>
      </header>
      <ul className="field-rows">
        {park.fields.map(field => (
          <FieldRow
            key={field.id}
            field={field}
            siblings={park.fields}
            pickupMinutes={pickupMinutes}
            pickupLabel={pickupLabel}
            isTop={field.id === recommendationId}
          />
        ))}
      </ul>
    </article>
  );
};

export default ParkCard;
