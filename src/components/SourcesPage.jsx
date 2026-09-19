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
  const fwsaUnmapped = sourceHealth.fwsa?.unmappedLocations || [];

  return (
    <main className="container sources-page">
      <h2>Sources and methodology</h2>
      <p className="dashboard-subtitle">
        Pitch Scout reports known conflicts from public schedules. It does not reserve fields.
        A missing event is not proof a field is free. Snapshot last built {new Date(lastUpdated).toLocaleString()}.
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
            <strong>Fairfax Soccer League</strong>
            <span>The public homepage and GoSports schedule app exist, but the Fall 2026 grid is a JavaScript app without a static table we can map to exact catalog subfields yet.</span>
          </li>
          <li>
            <strong>NVASA</strong>
            <span>Public team pages currently expose Spring 2026. Fall 2026 was not posted on the divisions selector, so it is not claimed in the header.</span>
          </li>
          <li>
            <strong>ZogSports DC / Arlington</strong>
            <span>Program pages are public. Team schedules stay with registered participants, so they are not scraped.</span>
          </li>
          <li>
            <strong>WAWSL</strong>
            <span>No current public site was found on 19 Sep 2026. Historical pages are not treated as a live schedule.</span>
          </li>
          <li>
            <strong>Member club calendars</strong>
            <span>Virginia Valor PlayMetrics, CYA Otto Sport, and SYA SportsEngine team practices are not scraped. Those stay behind login unless the club sends an authorized export.</span>
          </li>
          <li>
            <strong>Stringfellow Park</strong>
            <span>The catalog still has 42 fields. Turf Only hides Stringfellow because it is grass, which is why 41 turf cards show by default.</span>
          </li>
        </ul>
      </section>

      {(fxaUnmapped.length > 0 || nvslUnmapped.length > 0 || fwsaUnmapped.length > 0) && (
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
    chantilly: 'Chantilly HS athletics',
    westfield: 'Westfield HS athletics',
    centreville: 'Centreville HS athletics',
    'fc-dulles': 'FC Dulles published programs',
    'fairfax-county-permits': 'Fairfax County / FCPS permits',
  };
  return names[source.provider] || source.provider;
}

export default SourcesPage;
