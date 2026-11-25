import React, { useEffect, useRef } from 'react';
import mockData from '../data/mockState.json';
import {
  DEFAULT_PICKUP_MINUTES,
  MORNING_PICKUP_MINUTES,
  TIME_OPTIONS,
  dayChipParts,
  formatClock,
  overlapsPickupWindow,
} from '../lib/pickup';
import { IconClock, IconGrass, IconMoon, IconSun } from './Icons';

function openCount(dateStr, pickupMinutes, filterTurf) {
  const rows = (mockData.schedule[dateStr] || []).filter(field => (
    !filterTurf || String(field.type).toLowerCase() === 'turf'
  ));
  return rows.filter(field => !overlapsPickupWindow(field.events, pickupMinutes)).length;
}

const PRESETS = [
  { minutes: MORNING_PICKUP_MINUTES, label: 'Morning', Icon: IconSun },
  { minutes: DEFAULT_PICKUP_MINUTES, label: 'Evening', Icon: IconMoon },
];

const PickupControls = ({ pickup, compact = false }) => {
  const { selectedDate, setSelectedDate, pickupMinutes, setPickupMinutes, filterTurf, setFilterTurf } = pickup;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const dates = Object.keys(mockData.schedule).sort().filter(d => d >= todayStr);
  const stripRef = useRef(null);

  useEffect(() => {
    const active = stripRef.current?.querySelector('.day-chip.is-active');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selectedDate]);

  const isPreset = PRESETS.some(p => p.minutes === pickupMinutes);

  return (
    <div className={`pickup-controls${compact ? ' is-compact' : ''}`}>
      <div className="day-strip" ref={stripRef} role="tablist" aria-label="Day">
        {dates.map(dateStr => {
          const parts = dayChipParts(dateStr, todayStr);
          const count = openCount(dateStr, pickupMinutes, filterTurf);
          const active = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              type="button"
              role="tab"
              aria-selected={active}
              className={`day-chip${active ? ' is-active' : ''}`}
              onClick={() => setSelectedDate(dateStr)}
            >
              <span className="day-chip-top">{parts.top}</span>
              <span className="day-chip-num">{parts.day}</span>
              {!compact && <span className="day-chip-count">{count} open</span>}
            </button>
          );
        })}
      </div>

      <div className="time-row">
        <div className="seg" role="group" aria-label="Kickoff time">
          {PRESETS.map(({ minutes, label, Icon }) => (
            <button
              key={minutes}
              type="button"
              className={`seg-btn${pickupMinutes === minutes ? ' is-active' : ''}`}
              aria-pressed={pickupMinutes === minutes}
              onClick={() => setPickupMinutes(minutes)}
            >
              <Icon size={15} />
              <span>{label}<span className="seg-sub"> {formatClock(minutes)}</span></span>
            </button>
          ))}
          <label className={`seg-btn seg-select${!isPreset ? ' is-active' : ''}`}>
            <IconClock size={15} />
            <span className="seg-select-label">{isPreset ? 'Other' : formatClock(pickupMinutes)}</span>
            <select
              value={String(pickupMinutes)}
              onChange={e => setPickupMinutes(Number(e.target.value))}
              aria-label="Kickoff time"
            >
              {TIME_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className={`turf-toggle${filterTurf ? ' is-on' : ''}`}
          aria-pressed={filterTurf}
          onClick={() => setFilterTurf(v => !v)}
          title={filterTurf ? 'Showing turf only. Tap to include grass.' : 'Showing turf and grass. Tap for turf only.'}
        >
          <IconGrass size={15} />
          <span>{filterTurf ? 'Turf only' : 'Turf + grass'}</span>
        </button>
      </div>
    </div>
  );
};

export default PickupControls;
