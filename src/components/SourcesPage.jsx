import React from 'react';
import mockData from '../data/mockState.json';

const EXPECTED_GAPS = new Set(['fairfax-county-permits']);

const SourcesPage = () => {
  const { sourceHealth = {}, lastUpdated } = mockData;
  const connected = Object.values(sourceHealth).filter(source => source?.ok);
  const expected = Object.values(sourceHealth).filter(source => !source?.ok && EXPECTED_GAPS.has(source?.provider));
  const failed = Object.values(sourceHealth).filter(source => !source?.ok && !EXPECTED_GAPS.has(source?.provider));
  const fxaUnmapped = sourceHealth.fxa?.unmappedLocations || [];
  const nvslUnmapped = sourceHealth.nvsl?.unmappedLocations || [];
  const syaUnmapped = sourceHealth.sya?.unmappedLocations || [];
  const fslUnmapped = sourceHealth.fsl?.unmappedLocations || [];
  const nvasaUnmapped = sourceHealth.nvasa?.unmappedLocations || [];

  return (
    <main className="container sources-page">
      <h2>Sources and methodology</h2>
      <p className="dashboard-subtitle">
        Pitch Scout reports known conflicts from public schedules. It does not reserve fields.
        A missing event is not proof a field is free. Snapshot last built {new Date(lastUpdated).toLocaleString()}.
        {' '}iOS and other apps can read the same snapshot at <a href="/api">/api</a> and source health at <a href="/api/status">/api/status</a>.
      </p>

      <section className="sources-section">
        <h3>What we check automatically</h3>
        <ul className="sources-list">
          {connected.map(source => (
            <li key={source.provider}>
              <strong>{labelFor(source)}</strong>
              <span>{source.message}</span>
              {source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Open source</a> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="sources-section">
        <h3>Known gaps</h3>
        <ul className="sources-list">
          {expected.map(source => (
            <li key={source.provider}>
              <strong>{labelFor(source)}</strong>
              <span>{source.message}</span>
            </li>
          ))}
          <li>
            <strong>NVASA</strong>
            <span>Fall 2026 is selected on the public hub and is polled each scrape. Team tables were empty of games on 19 Sep 2026, and the league’s venues (Mason District, South Run) are outside this catalog unless an exact field name matches.</span>
          </li>
          <li>
            <strong>WAWSL and Volo (ZogSports)</strong>
            <span>WAWSL is inactive. Volo/ZogSports is Arlington-only. Neither is ingested.</span>
          </li>
          <li>
            <strong>Member-only practices</strong>
            <span>Virginia Valor PlayMetrics, CYA team practices beyond public rec/NCSL pages, and other roster-assigned calendars are not scraped. County/FCPS permits have no public occupancy feed.</span>
          </li>
          <li>
            <strong>Stringfellow Park</strong>
            <span>The catalog still has 42 fields. Turf Only hides Stringfellow because it is grass, which is why 41 turf cards show by default.</span>
          </li>
        </ul>
      </section>

      {(fxaUnmapped.length > 0 || nvslUnmapped.length > 0 || fwsaUnmapped.length > 0 || syaUnmapped.length > 0 || fslUnmapped.length > 0 || nvasaUnmapped.length > 0) && (
        <section className="sources-section">
          <h3>Public games outside this 42-field catalog</h3>
          <p>
            These venues appeared on connected public schedules. They are not mapped onto a nearby catalog field.
            Park-level names such as “Braddock Park” without 7 / 7A / 7B stay unmapped on purpose.
          </p>
          {fxaUnmapped.length > 0 && (
            <p><strong>FXA ({fxaUnmapped.length}):</strong> {fxaUnmapped.join('; ')}</p>
          )}
          {nvslUnmapped.length > 0 && (
            <p><strong>NVSL ({nvslUnmapped.length}):</strong> {nvslUnmapped.join('; ')}</p>
          )}
          {fwsaUnmapped.length > 0 && (
            <p><strong>FWSA ({fwsaUnmapped.length}):</strong> {fwsaUnmapped.join('; ')}</p>
          )}
          {syaUnmapped.length > 0 && (
            <p><strong>SYA ({syaUnmapped.length}):</strong> {syaUnmapped.join('; ')}</p>
          )}
          {fslUnmapped.length > 0 && (
            <p><strong>FSL ({fslUnmapped.length}):</strong> {fslUnmapped.join('; ')}</p>
          )}
          {nvasaUnmapped.length > 0 && (
            <p><strong>NVASA ({nvasaUnmapped.length}):</strong> {nvasaUnmapped.join('; ')}</p>
          )}
        </section>
      )}

      {failed.length > 0 && (
        <section className="sources-section">
          <h3>Connectors that failed this snapshot</h3>
          <ul className="sources-list">
            {failed.map(source => (
              <li key={source.provider}>
                <strong>{labelFor(source)}</strong>
                <span>{source.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sources-section">
        <h3>How status is labeled</h3>
        <p>
          Known conflict means a connected public schedule overlaps the selected time.
          Open means no connected-source conflict was found at that time. Other events that day can still appear on the card.
          County/school permits, private practices, and walk-on use are not fully verified.
        </p>
      </section>
    </main>
  );
};

function labelFor(source) {
  const names = {
    fxa: 'FXA Sports / LeagueLab',
    ncsl: 'NCSL / Demosphere',
    nvsl: 'NVSL',
    fwsa: 'FWSA / LeagueApps',
    sya: 'SYA rec / Otto Sport',
    fsl: 'Fairfax Soccer League',
    nvasa: 'NVASA',
    chantilly: 'Chantilly HS athletics',
    westfield: 'Westfield HS athletics',
    centreville: 'Centreville HS athletics',
    'fc-dulles': 'FC Dulles published programs',
    'fairfax-county-permits': 'Fairfax County / FCPS permits',
  };
  return names[source.provider] || source.provider;
}

export default SourcesPage;
