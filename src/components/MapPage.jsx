import React, { useMemo, useState } from 'react';
import FieldMap from './FieldMap';
import mockData from '../data/mockState.json';
import {
  DEFAULT_PICKUP_MINUTES,
  TIME_OPTIONS,
  formatClock,
  formatFriendlyDate,
  overlapsPickupWindow,
  pickBestField,
} from '../lib/pickup';

const MapPage = () => {
  const { schedule } = mockData;
  const availableDates = Object.keys(schedule).sort();
  const todayStr = new Date().toLocaleDateString('en-CA');
  const defaultDate = availableDates.includes(todayStr) ? todayStr : availableDates[0];
  const filteredDates = availableDates.filter(date => date >= todayStr);

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [pickupMinutes, setPickupMinutes] = useState(DEFAULT_PICKUP_MINUTES);

  const pickupLabel = formatClock(pickupMinutes);
  const dateLabel = formatFriendlyDate(selectedDate, todayStr);

  const fields = useMemo(() => {
    const rows = (schedule[selectedDate] || []).filter(field => field.type.toLowerCase() === 'turf');
    const open = [];
    const mapped = rows.map(field => {
      const overlapsPickup = overlapsPickupWindow(field.events, pickupMinutes);
      const next = { ...field, overlapsPickup };
      if (!overlapsPickup) open.push(next);
      return next;
    });
    return { mapped, recommendation: pickBestField(open) };
  }, [schedule, selectedDate, pickupMinutes]);

  return (
    <main className="map-page">
      <div className="map-page-bar">
        <label className="map-page-control">
          <span>Date</span>
          <select
            className="glass-select"
            value={selectedDate}
            onChange={event => setSelectedDate(event.target.value)}
          >
            {filteredDates.map(dateStr => (
              <option key={dateStr} value={dateStr}>{formatFriendlyDate(dateStr, todayStr)}</option>
            ))}
          </select>
        </label>
        <label className="map-page-control">
          <span>Time</span>
          <select
            className="glass-select"
            value={String(pickupMinutes)}
            onChange={event => setPickupMinutes(Number(event.target.value))}
          >
            {TIME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <p className="map-page-hint">Green open · Red conflict · Starts on the top pick</p>
      </div>
      <FieldMap
        key={`${selectedDate}-${fields.recommendation?.id || 'none'}`}
        fields={fields.mapped}
        recommendation={fields.recommendation}
        pickupLabel={pickupLabel}
        dateLabel={dateLabel}
        pickupMinutes={pickupMinutes}
      />
    </main>
  );
};

export default MapPage;
