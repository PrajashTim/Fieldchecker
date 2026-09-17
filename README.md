# Pitch Scout / NoVA Field Check

Pitch Scout aggregates public schedule signals for soccer pickup fields around Chantilly and Centreville, Virginia. It reports confirmed conflicts and source coverage; it does not reserve fields or guarantee access.

## Current sources

- FXA LeagueLab: current soccer, flag football, ultimate, softball and kickball schedules that map to configured fields.
- Chantilly, Westfield and Centreville high-school athletics schedules.
- Explicitly published FC Dulles programs, currently the Fall 2026 REC Academy sessions at Poplar Tree #2.

Fairfax County/FCPS permit calendars are not available as a complete public occupancy feed, so missing permit coverage is shown as unverified rather than open. See [the source coverage register](docs/SOURCE_COVERAGE.md) and [deep dive](docs/DEEP_DIVE.md).

## Automatic updates

GitHub Actions rebuilds the rolling 30-day snapshot three times daily. Every successful run starts at the current date and adds the new date at the end of the window. Critical-source failures are retried and cannot overwrite the last known-good snapshot.

## Local development

```bash
npm ci
npm run dev
```

To regenerate schedule data locally:

```bash
node scraper/engine.js
```

The frontend is React/Vite and the generated snapshot is stored at `src/data/mockState.json`.
