import React from 'react';
import mockData from '../data/mockState.json';

const EXPECTED_GAPS = new Set(['fairfax-county-permits']);

const SourcesPage = () => {
  const { sourceHealth = {}, lastUpdated } = mockData;
  const connected = Object.values(sourceHealth).filter(source => source?.ok);
  const expected = Object.values(sourceHealth).filter(source => !source?.ok && EXPECTED_GAPS.has(source?.provider));
  const failed = Object.values(sourceHealth).filter(source => !source?.ok && !EXPECTED_GAPS.has(source?.provider));

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
            <strong>Member club calendars</strong>
            <span>Virginia Valor PlayMetrics, CYA Otto Sport, and SYA SportsEngine team practices are not scraped. Those stay behind login unless the club sends an authorized export.</span>
          </li>
          <li>
            <strong>Stringfellow Park</strong>
            <span>The catalog still has 42 fields. Turf Only hides Stringfellow because it is grass, which is why 41 turf cards show by default.</span>
          </li>
        </ul>
      </section>

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
    chantilly: 'Chantilly HS athletics',
    westfield: 'Westfield HS athletics',
    centreville: 'Centreville HS athletics',
    'fc-dulles': 'FC Dulles published programs',
    'fairfax-county-permits': 'Fairfax County / FCPS permits',
  };
  return names[source.provider] || source.provider;
}

export default SourcesPage;
