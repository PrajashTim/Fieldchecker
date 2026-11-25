import React from 'react';
import {
  PICKUP_DURATION_MINUTES,
  TIMELINE_END,
  TIMELINE_START,
  eventBlocks,
} from '../lib/pickup';

const SPAN = TIMELINE_END - TIMELINE_START;
const pct = minutes => `${(Math.min(Math.max(minutes, TIMELINE_START), TIMELINE_END) - TIMELINE_START) / SPAN * 100}%`;
const width = (start, end) => `${(Math.min(end, TIMELINE_END) - Math.max(start, TIMELINE_START)) / SPAN * 100}%`;

/** A 6 AM – 11 PM bar: grey/red blocks are booked, the outlined box is your pickup window. */
const DayTimeline = ({ events, pickupMinutes, busy, showLabels = false, mini = false }) => {
  const blocks = eventBlocks(events);
  const hasUnknown = blocks.some(b => b.unknown);
  const pickupEnd = pickupMinutes + PICKUP_DURATION_MINUTES;

  return (
    <div className="timeline-wrap">
      <div className={`timeline${hasUnknown ? ' has-unknown' : ''}${mini ? ' is-mini' : ''}`}>
        {blocks.filter(b => !b.unknown && b.end > TIMELINE_START && b.start < TIMELINE_END).map((b, i) => {
          const hit = pickupMinutes < b.end + 30 && pickupEnd > b.start - 30;
          return (
            <span
              key={i}
              className={`timeline-block${hit ? ' is-hit' : ''}`}
              style={{ left: pct(b.start), width: width(b.start, b.end) }}
              title={`${b.event.time} · ${b.event.title}`}
            />
          );
        })}
        <span
          className={`timeline-window${busy ? ' is-busy' : ''}`}
          style={{ left: pct(pickupMinutes), width: width(pickupMinutes, pickupEnd) }}
        />
      </div>
      {showLabels && (
        <div className="timeline-labels" aria-hidden="true">
          {[[360, '6a'], [600, '10a'], [840, '2p'], [1080, '6p'], [1380, '11p']].map(([m, label]) => (
            <span key={label} style={{ left: pct(m) }}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default DayTimeline;
