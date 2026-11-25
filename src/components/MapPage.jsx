import React, { useMemo } from 'react';
import FieldMap from './FieldMap';
import PickupControls from './PickupControls';
import mockData from '../data/mockState.json';
import {
  formatClock,
  formatFriendlyDate,
  overlapsPickupWindow,
  pickBestField,
} from '../lib/pickup';

const MapPage = ({ pickup }) => {
  const { schedule } = mockData;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const { selectedDate, pickupMinutes, filterTurf } = pickup;

  const pickupLabel = formatClock(pickupMinutes);
  const dateLabel = formatFriendlyDate(selectedDate, todayStr);

  const fields = useMemo(() => {
    const rows = (schedule[selectedDate] || []).filter(field => (
      !filterTurf || String(field.type).toLowerCase() === 'turf'
    ));
    const open = [];
    const mapped = rows.map(field => {
      const overlapsPickup = overlapsPickupWindow(field.events, pickupMinutes);
      const next = { ...field, overlapsPickup };
      if (!overlapsPickup) open.push(next);
      return next;
    });
    return { mapped, recommendation: pickBestField(open) };
  }, [schedule, selectedDate, pickupMinutes, filterTurf]);

  return (
    <main className="map-page">
      <div className="map-page-bar">
        <PickupControls pickup={pickup} compact />
        <div className="map-legend" aria-hidden="true">
          <span><i className="dot-open" /> Free</span>
          <span><i className="dot-busy" /> Busy</span>
          <span><i className="dot-top" /> Top pick</span>
        </div>
      </div>
      <FieldMap
        key={`${selectedDate}-${filterTurf ? 'turf' : 'all'}-${fields.recommendation?.id || 'none'}`}
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
