import React, { useMemo, useState } from 'react';
import ParkCard from './ParkCard';
import PickupControls from './PickupControls';
import DayTimeline from './DayTimeline';
import { mapsDirectionsUrl } from './DirectionsLink';
import mockData from '../data/mockState.json';
import {
  PICKUP_DURATION_MINUTES,
  formatClock,
  formatFriendlyDate,
  groupByPark,
  hubRank,
  isPermitChecked,
  overlapsPickupWindow,
  pickBestField,
} from '../lib/pickup';
import {
  IconAlert, IconInfo, IconMap, IconNav, IconShield, IconStar, PitchArt,
} from './Icons';

const SOURCE_NAMES = {
  fxa: 'FXA', ncsl: 'NCSL', sya: 'SYA', nvsl: 'NVSL', fsl: 'FSL', fwsa: 'FWSA', nvasa: 'NVASA',
  loudounPrcs: 'Loudoun permits', fcpsCommunityUse: 'FCPS permits',
};

function connectedSources(sourceHealth) {
  return Object.entries(SOURCE_NAMES)
    .filter(([key]) => {
      const s = sourceHealth[key];
      return key === 'fxa' || key === 'loudounPrcs' || key === 'fcpsCommunityUse' ? s?.ok : s?.eventCount > 0;
    })
    .map(([, name]) => name);
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Free' },
  { key: 'busy', label: 'Busy' },
];

const Dashboard = ({ pickup }) => {
  const { schedule, sourceHealth = {} } = mockData;
  const todayStr = new Date().toLocaleDateString('en-CA');
  const { selectedDate, pickupMinutes, filterTurf } = pickup;
  const [view, setView] = useState('all');

  const pickupLabel = formatClock(pickupMinutes);
  const endLabel = formatClock(Math.min(pickupMinutes + PICKUP_DURATION_MINUTES, 24 * 60 - 1));
  const dateLabel = formatFriendlyDate(selectedDate, todayStr);

  const { fields, recommendation, parks, openCount } = useMemo(() => {
    const rows = (schedule[selectedDate] || [])
      .filter(field => !filterTurf || String(field.type).toLowerCase() === 'turf')
      .map(field => ({ ...field, overlapsPickup: overlapsPickupWindow(field.events, pickupMinutes) }));
    const open = rows.filter(f => !f.overlapsPickup);
    const grouped = groupByPark(rows).sort((a, b) => {
      const aOpen = a.fields.some(f => !f.overlapsPickup) ? 0 : 1;
      const bOpen = b.fields.some(f => !f.overlapsPickup) ? 0 : 1;
      return aOpen - bOpen || a.rank[0] - b.rank[0] || a.distance - b.distance;
    });
    return { fields: rows, recommendation: pickBestField(open), parks: grouped, openCount: open.length };
  }, [schedule, selectedDate, pickupMinutes, filterTurf]);

  const visibleParks = parks
    .map(park => ({
      ...park,
      fields: view === 'all' ? park.fields : park.fields.filter(f => (view === 'open' ? !f.overlapsPickup : f.overlapsPickup)),
    }))
    .filter(park => park.fields.length);

  const unexpectedFailures = Object.values(sourceHealth).filter(source => (
    source && !source.ok && source.provider !== 'fairfax-county-permits'
  ));
  const sources = connectedSources(sourceHealth);

  const recHub = recommendation ? hubRank(recommendation.id)[0] : null;
  const why = recHub === 0
    ? 'Our home base, and nothing is booked here.'
    : recHub === 1
      ? 'Chantilly HS is booked, so Sully Highlands is next up.'
      : 'Chantilly HS and Sully Highlands are both booked. This is the closest free field.';

  return (
    <main className="page dashboard">
      <section className="hero container">
        <h1>Where are we playing?</h1>
        <p className="hero-sub">
          We check league, club, school and permit schedules{sources.length ? ` like ${sources.slice(0, 3).join(', ')}` : ''} so you don’t show up to a field that’s booked.
          {' '}<a href="#sources">How it works</a>
        </p>
      </section>

      <div className="controls-shell">
        <div className="container">
          <PickupControls pickup={pickup} />
        </div>
      </div>

      <div className="container">
        {unexpectedFailures.length > 0 && (
          <a className="notice" href="#sources" role="status">
            <IconAlert size={15} />
            <span>
              {unexpectedFailures.map(s => SOURCE_NAMES[s.provider] || s.provider.toUpperCase()).join(', ')} didn’t refresh this time — other sources are still current.
            </span>
          </a>
        )}

        <section className="top-pick" aria-label="Top pick">
          <PitchArt className="top-pick-art" />
          {recommendation ? (
            <>
              <span className="eyebrow"><IconStar size={13} /> Top pick · {dateLabel.split(' (')[0]}</span>
              <h2>{recommendation.name}</h2>
              <p className="top-pick-sub">
                {recommendation.subfield}
                {isPermitChecked(recommendation.id) && <span className="mini-badge"><IconShield size={11} /> Permits checked</span>}
              </p>
              <div className="top-pick-time">
                <span className="big-status">Free {pickupLabel} – {endLabel}</span>
                <DayTimeline events={recommendation.events} pickupMinutes={pickupMinutes} busy={false} showLabels />
              </div>
              <p className="top-pick-why">{why}</p>
              <div className="top-pick-actions">
                <a className="btn btn-primary" href={mapsDirectionsUrl(recommendation, fields)} target="_blank" rel="noopener noreferrer">
                  <IconNav size={16} /> Directions
                </a>
                <a className="btn btn-ghost" href="#map"><IconMap size={16} /> See on map</a>
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow is-busy">No free fields</span>
              <h2>Everything’s booked at {pickupLabel}</h2>
              <p className="top-pick-why">Try a different time or include grass fields.</p>
            </>
          )}
        </section>

        <div className="list-head">
          <div>
            <h2>All fields</h2>
            <p><strong className="txt-open">{openCount} free</strong> · <strong className="txt-busy">{fields.length - openCount} busy</strong> at {pickupLabel}</p>
          </div>
          <div className="seg seg-sm" role="group" aria-label="Show">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                className={`seg-btn${view === f.key ? ' is-active' : ''}`}
                aria-pressed={view === f.key}
                onClick={() => setView(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="legend" aria-hidden="true">
          <span><i className="lg-window" /> Your 2-hr game</span>
          <span><i className="lg-booked" /> Booked</span>
          <span><i className="lg-hit" /> Clashes</span>
        </div>

        <div className="park-grid">
          {visibleParks.map(park => (
            <ParkCard
              key={park.name}
              park={park}
              pickupMinutes={pickupMinutes}
              pickupLabel={pickupLabel}
              recommendationId={recommendation?.id}
            />
          ))}
        </div>

        {visibleParks.length === 0 && (
          <p className="empty">No fields match this filter.</p>
        )}

        <footer className="site-footer">
          <IconInfo size={15} />
          <p>
            “Free” means no public schedule we track shows a game or practice then — it’s not a reservation.
            Fairfax park permits, private practices and walk-ons can’t be seen. <a href="#sources">Details</a>
          </p>
        </footer>
      </div>
    </main>
  );
};

export default Dashboard;
