import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '../vendor/leaflet.css';

import { mapsDirectionsUrl } from './DirectionsLink';
import DayTimeline from './DayTimeline';
import { IconCheck, IconChevron, IconNav, IconPin, IconStar, IconTarget, IconX } from './Icons';
import { coordsForField, CHANTILLY, PARK_COORDS } from '../data/fieldCoords';
import { hubRank, overlappingEvents } from '../lib/pickup';

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
const PHONE_QUERY = '(max-width: 860px)';
const PEEK_HEIGHT = 112;

/** On phones the sheet covers the bottom of the map; shift the view so a point lands in the visible part. */
function visibleCenter(map, latlng, zoom, coveredPx) {
  if (!coveredPx) return latlng;
  const point = map.project(latlng, zoom).add([0, coveredPx / 2]);
  return map.unproject(point, zoom);
}

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
  const sheetRef = useRef(null);
  const areaRef = useRef(null);
  const dragRef = useRef(null);
  const [isPhone, setIsPhone] = useState(() => window.matchMedia?.(PHONE_QUERY).matches ?? false);
  const [areaH, setAreaH] = useState(0);
  const [snap, setSnap] = useState('mid');
  const [dragH, setDragH] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setAreaH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const snapHeights = {
    peek: PEEK_HEIGHT,
    mid: Math.round(Math.max(areaH * 0.5, PEEK_HEIGHT + 120)),
    full: Math.round(Math.max(areaH - 44, PEEK_HEIGHT + 200)),
  };

  const coveredPx = () => (isPhone ? (dragH ?? snapHeights[snap]) : 0);

  const onDragStart = (event) => {
    if (!isPhone || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragRef.current = {
      startY: event.clientY,
      startH: dragH ?? snapHeights[snap],
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onDragMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = drag.startY - event.clientY;
    if (!drag.moved && Math.abs(dy) < 5) return;
    drag.moved = true;
    const now = performance.now();
    drag.velocity = (drag.lastY - event.clientY) / Math.max(now - drag.lastT, 1);
    drag.lastY = event.clientY;
    drag.lastT = now;
    setDragH(Math.min(Math.max(drag.startH + dy, PEEK_HEIGHT - 24), snapHeights.full));
  };

  const onDragEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const order = ['peek', 'mid', 'full'];
    if (!drag.moved) {
      // A tap on the handle steps the sheet: peek → mid → full → peek.
      setSnap(current => order[(order.indexOf(current) + 1) % order.length]);
      return;
    }
    const height = dragH ?? drag.startH;
    let target;
    if (drag.velocity > 0.45) target = order.find(key => snapHeights[key] > height + 10) || 'full';
    else if (drag.velocity < -0.45) target = [...order].reverse().find(key => snapHeights[key] < height - 10) || 'peek';
    else target = order.reduce((best, key) => (
      Math.abs(snapHeights[key] - height) < Math.abs(snapHeights[best] - height) ? key : best
    ), 'mid');
    setSnap(target);
    setDragH(null);
  };

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
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: true,
      tap: true,
    }).setView([origin.lat, origin.lng], 12);
    if (window.matchMedia?.(PHONE_QUERY).matches) {
      const covered = Math.max(mapEl.current.clientHeight * 0.5, PEEK_HEIGHT + 120);
      map.setView(visibleCenter(map, L.latLng(origin.lat, origin.lng), 12, covered), 12, { animate: false });
    }
    L.control.zoom({ position: 'bottomright' }).addTo(map);
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
    if (map) map.flyTo(visibleCenter(map, L.latLng(origin.lat, origin.lng), 13, coveredPx()), 13, { duration: 0.45 });
  };

  const focusField = (field) => {
    selectField(field.id);
    const map = mapRef.current;
    const origin = coordsForField(field, fields);
    if (map) {
      const zoom = Math.max(map.getZoom(), 14);
      const covered = isPhone ? snapHeights[snap === 'full' ? 'mid' : snap] : 0;
      map.flyTo(visibleCenter(map, L.latLng(origin.lat, origin.lng), zoom, covered), zoom, { duration: 0.45 });
    }
    sheetRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (snap === 'full') setSnap('mid');
  };

  const selected = fields.find(field => field.id === selectedId) || null;
  const others = fields
    .filter(field => field.id !== selectedId)
    .sort((a, b) => {
      const [ah, at] = hubRank(a.id);
      const [bh, bt] = hubRank(b.id);
      return Number(a.overlapsPickup) - Number(b.overlapsPickup) || ah - bh || at - bt;
    });
  const freeCount = fields.filter(field => !field.overlapsPickup).length;
  const conflicts = selected ? overlappingEvents(selected.events, pickupMinutes) : [];

  return (
    <div
      className="simple-map"
      ref={areaRef}
      style={isPhone && selected ? { '--sheet-h': `${dragH ?? snapHeights[snap]}px` } : undefined}
    >
      <div className="simple-map-stage">
        <div ref={mapEl} className="simple-map-canvas" role="application" aria-label="Field map" />
        <button type="button" className="map-recenter" onClick={showTopPick}><IconTarget size={14} /> Top pick</button>
      </div>
      {selected && (
        <aside
          className={`simple-map-sheet${selected.overlapsPickup ? ' is-busy' : ' is-open'}${isPhone ? ` snap-${dragH != null ? 'drag' : snap}` : ''}${dragH != null ? ' is-dragging' : ''}`}
          style={isPhone ? { height: dragH ?? snapHeights[snap] } : undefined}
        >
          <div
            className="sheet-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <button
              type="button"
              className="sheet-grip"
              aria-label={snap === 'full' ? 'Shrink panel' : 'Expand panel'}
              onClick={event => event.preventDefault()}
            >
              <span />
            </button>
            <div className="sheet-head">
              <div>
                <p className="simple-map-kicker">
                  {recommendation?.id === selected.id ? <><IconStar size={12} /> Top pick</> : <><IconPin size={12} /> {selected.location}</>}
                </p>
                <h2>{selected.name}</h2>
                {selected.subfield && <p className="sheet-sub">{selected.subfield}</p>}
              </div>
              <span className={`status-pill ${selected.overlapsPickup ? 'is-busy' : 'is-open'}`}>
                {selected.overlapsPickup ? 'Busy' : 'Free'} · {pickupLabel}
              </span>
            </div>
          </div>
          <div className="sheet-body" ref={sheetRef}>
          <DayTimeline events={selected.events} pickupMinutes={pickupMinutes} busy={selected.overlapsPickup} showLabels />
          {selected.overlapsPickup && conflicts.length > 0 && (
            <ul className="sheet-conflicts">
              {conflicts.slice(0, 2).map((event, index) => (
                <li key={event.eventId || index}><b>{event.time}</b> {event.title}</li>
              ))}
            </ul>
          )}
          <div className="simple-map-actions">
            <a className="btn btn-primary btn-sm" href={mapsDirectionsUrl(selected, fields)} target="_blank" rel="noopener noreferrer">
              <IconNav size={14} /> Directions
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowDaySchedule(open => !open)}
              aria-expanded={showDaySchedule}
            >
              {showDaySchedule ? 'Hide schedule' : `Day schedule (${selected.events?.length || 0})`}
            </button>
          </div>
          {showDaySchedule && (
            <div className="map-day-schedule">
              {selected.events?.length > 0 ? (
                <ul className="event-list">
                  {selected.events.map((evt, idx) => (
                    <li key={evt.eventId || idx} className={conflicts.includes(evt) ? 'is-hit' : undefined}>
                      <span className="event-time">{evt.time}{evt.status === 'rescheduled' ? ' · moved' : ''}</span>
                      <span className="event-title">{evt.title}</span>
                      {evt.source && <span className="event-meta"><span className="source-chip">{evt.source}</span></span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="event-empty">Nothing on the public schedules for {dateLabel}.</p>
              )}
            </div>
          )}

          <div className="sheet-list">
            <p className="sheet-list-head">
              All fields <span><b className="txt-open">{freeCount} free</b> · <b className="txt-busy">{fields.length - freeCount} busy</b></span>
            </p>
            <ul>
              {others.map(field => (
                <li key={field.id}>
                  <button
                    type="button"
                    className={`sheet-row${field.overlapsPickup ? ' is-busy' : ' is-open'}`}
                    onClick={() => focusField(field)}
                  >
                    <span className="status-icon">
                      {field.overlapsPickup ? <IconX size={12} strokeWidth={3} /> : <IconCheck size={12} strokeWidth={3} />}
                    </span>
                    <span className="sheet-row-text">
                      <span className="sheet-row-name">{field.name}</span>
                      <span className="sheet-row-sub">{field.subfield}{field.id === recommendation?.id ? ' · Top pick' : ''}</span>
                    </span>
                    <DayTimeline events={field.events} pickupMinutes={pickupMinutes} busy={field.overlapsPickup} mini />
                    <IconChevron size={14} className="sheet-row-go" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default FieldMap;
