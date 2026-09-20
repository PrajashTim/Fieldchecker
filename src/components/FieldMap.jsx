import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '../vendor/leaflet.css';

import { DirectionsLink } from './DirectionsLink';
import { coordsForField, CHANTILLY, PARK_COORDS } from '../data/fieldCoords';
import { overlappingEvents, PERMIT_DISCLAIMER } from '../lib/pickup';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pinLabel(field) {
  return field.subfield ? `${field.name} · ${field.subfield}` : field.name;
}

const SUBFIELD_ZOOM = 15;

function pinIcon(field, open, isRec, isSelected) {
  const classes = [
    'glow-pin',
    open ? 'is-open' : 'is-busy',
    isRec ? 'is-top' : '',
    isSelected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');
  return L.divIcon({
    className: 'glow-pin-icon',
    html: `<div class="${classes}" data-park="${escapeHtml(field.name)}"><span class="glow-pin-name">${escapeHtml(field.name)}</span>${field.subfield ? `<span class="glow-pin-sub">${escapeHtml(field.subfield)}</span>` : ''}<span class="glow-pin-dot"></span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function applyZoomLabels(markers, zoom, selectedId, recommendationId) {
  const showSub = zoom >= SUBFIELD_ZOOM;
  const labeledParks = new Set();
  markers.forEach(({ marker, field }) => {
    const wrap = marker.getElement()?.querySelector('.glow-pin');
    if (!wrap) return;
    wrap.classList.toggle('show-sub', showSub);
    wrap.querySelectorAll('.glow-pin-sub').forEach(el => {
      el.hidden = !showSub;
    });
    const keepName = showSub
      || field.id === selectedId
      || field.id === recommendationId
      || !labeledParks.has(field.name);
    wrap.classList.toggle('hide-name', !keepName);
    if (keepName) labeledParks.add(field.name);
  });
}

const FieldMap = ({
  fields,
  recommendation,
  pickupLabel,
  dateLabel,
  pickupMinutes,
}) => {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const selectedRef = useRef(recommendation?.id || fields[0]?.id || null);
  const recommendationRef = useRef(recommendation?.id);
  const [selectedId, setSelectedId] = useState(selectedRef.current);
  const [showDaySchedule, setShowDaySchedule] = useState(false);

  recommendationRef.current = recommendation?.id;

  const selectField = (fieldId) => {
    selectedRef.current = fieldId;
    setSelectedId(fieldId);
    setShowDaySchedule(false);
    const marker = markersRef.current.get(fieldId)?.marker;
    if (marker) marker.setZIndexOffset(800);
    const map = mapRef.current;
    if (map) applyZoomLabels(markersRef.current, map.getZoom(), fieldId, recommendation?.id);
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const start = fields.find(field => field.id === recommendation?.id) || fields[0];
    const origin = start ? coordsForField(start, fields) : CHANTILLY;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      tap: true,
    }).setView([origin.lat, origin.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    const onZoom = () => applyZoomLabels(
      markersRef.current,
      map.getZoom(),
      selectedRef.current,
      recommendationRef.current,
    );
    map.on('zoomend', onZoom);
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    requestAnimationFrame(resize);
    const timer = window.setTimeout(resize, 250);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(mapEl.current);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      map.off('zoomend', onZoom);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    fields.forEach(field => {
      const { lat, lng } = coordsForField(field, fields);
      const open = !field.overlapsPickup;
      const isRec = recommendation?.id === field.id;
      const marker = L.marker([lat, lng], {
        icon: pinIcon(field, open, isRec, field.id === selectedRef.current),
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: isRec ? 700 : 400,
        title: pinLabel(field),
      });
      marker.on('click', event => {
        L.DomEvent.stopPropagation(event);
        selectField(field.id);
      });
      marker.addTo(map);
      const iconEl = marker.getElement();
      if (iconEl) {
        L.DomEvent.disableClickPropagation(iconEl);
        iconEl.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          selectField(field.id);
        });
      }
      markersRef.current.set(field.id, { marker, field });
    });
    applyZoomLabels(markersRef.current, map.getZoom(), selectedRef.current, recommendation?.id);
  }, [fields, recommendation, PARK_COORDS]);

  useEffect(() => {
    selectedRef.current = selectedId;
    markersRef.current.forEach(({ marker }, id) => {
      const wrap = marker.getElement()?.querySelector('.glow-pin');
      if (!wrap) return;
      wrap.classList.toggle('is-selected', id === selectedId);
      marker.setZIndexOffset(
        id === selectedId || id === recommendation?.id ? 800 : 400,
      );
    });
    const map = mapRef.current;
    if (map) applyZoomLabels(markersRef.current, map.getZoom(), selectedId, recommendation?.id);
  }, [selectedId, recommendation]);

  useEffect(() => {
    if (selectedId && fields.some(field => field.id === selectedId)) return;
    const next = recommendation?.id || fields[0]?.id || null;
    selectedRef.current = next;
    setSelectedId(next);
  }, [fields, recommendation, selectedId]);

  const showTopPick = () => {
    const start = fields.find(field => field.id === recommendation?.id) || fields[0];
    if (!start) return;
    selectField(start.id);
    const map = mapRef.current;
    const origin = coordsForField(start, fields);
    map?.flyTo([origin.lat, origin.lng], 14, { duration: 0.45 });
  };

  const selected = fields.find(field => field.id === selectedId) || null;
  const conflicts = selected ? overlappingEvents(selected.events, pickupMinutes) : [];

  return (
    <div className="simple-map">
      <div className="simple-map-stage">
        <div ref={mapEl} className="simple-map-canvas" role="application" aria-label="Field map" />
        <button type="button" className="map-recenter" onClick={showTopPick}>Top pick</button>
      </div>
      {selected && (
        <aside className="simple-map-sheet">
          <p className="simple-map-kicker">{recommendation?.id === selected.id ? 'Top pick' : selected.location}</p>
          <h2>
            {selected.name}
            {selected.subfield ? ` · ${selected.subfield}` : ''}
          </h2>
          <p className={selected.overlapsPickup ? 'simple-map-busy' : 'simple-map-open'}>
            {selected.overlapsPickup ? `Conflict at ${pickupLabel}` : `Open at ${pickupLabel}`}
          </p>
          {selected.overlapsPickup ? (
            <ul>
              {conflicts.slice(0, 2).map((event, index) => (
                <li key={event.eventId || index}>{event.time} {event.title}</li>
              ))}
            </ul>
          ) : (
            <p className="simple-map-note">{PERMIT_DISCLAIMER}</p>
          )}
          <div className="simple-map-actions">
            <DirectionsLink field={selected} siblings={fields} />
            <span className="simple-map-date">{dateLabel}</span>
          </div>
          <button
            type="button"
            className="map-schedule-toggle"
            onClick={() => setShowDaySchedule(open => !open)}
            aria-expanded={showDaySchedule}
          >
            {showDaySchedule ? 'Hide full day schedule' : 'Show full day schedule'}
          </button>
          {showDaySchedule && (
            <div className="map-day-schedule">
              {selected.events?.length > 0 ? (
                <ul className="schedule-list">
                  {selected.events.map((evt, idx) => (
                    <li key={evt.eventId || idx} className="schedule-item">
                      <span className="schedule-time">{evt.time}{evt.status === 'rescheduled' ? ' · rescheduled' : ''}</span>
                      <span className="schedule-event">{evt.title}</span>
                      <span className="schedule-meta">
                        {evt.source ? <span className="source-chip">{evt.source}</span> : null}
                        {evt.precision === 'exact_subfield' ? <span>exact field</span> : evt.precision ? <span>{evt.precision}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="simple-map-note">No public-schedule events on {dateLabel}.</p>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default FieldMap;
