# Pitch Scout / NoVA Field Check — Deep Dive

## Product intent

Pitch Scout is a field-conflict aggregation tool for soccer pickup groups and Nova Royals. Its job is not to reserve a field or guarantee access. Its job is to reduce avoidable wasted trips by collecting known schedules from multiple public systems into one fast, mobile-friendly view.

The core user question is:

> “For the date and time we want to play, is there a known event occupying this field, and how complete is the evidence?”

That last clause matters. An absence of scraped events is not proof that a field is available.

## Existing architecture

- React/Vite static frontend deployed on Vercel.
- A GitHub Actions workflow runs the scraper three times daily.
- The scraper writes a 30-day snapshot to `src/data/mockState.json`.
- GitHub Actions commits the snapshot to `main`.
- Vercel redeploys the static application from the updated repository.
- Sources originally included:
  - FXA league schedules through a legacy LeagueApps discovery API.
  - Chantilly High School athletics.
  - Westfield High School athletics.
  - Centreville High School athletics.
- The field catalog contains 42 field/subfield records.

## Confirmed root causes

### 1. Empty data was treated as confirmed availability

Every source adapter returned an empty object after errors or zero results. The aggregation engine then used this rule:

```text
events found -> occupied
no events -> open
```

This is the primary trust failure. Network errors, source migrations, parser breakage and truly empty schedules were indistinguishable.

### 2. School URLs were pinned to the 2025–2026 school year

The Chantilly, Westfield and Centreville adapters still requested `year=2025-2026` in September 2026. After changing the academic year dynamically to `2026-2027`, the current 30-day run found:

- Chantilly: 4 relevant home-turf events.
- Westfield: 4 relevant home-turf events.
- Centreville: source healthy, 0 relevant home-turf events in the window.

### 3. FXA migrated away from the legacy integration

The app discovers FXA leagues through the old LeagueApps-oriented endpoint. It now returns zero `LIVE` or `UPCOMING` leagues. FXA's own help content describes LeagueApps as its legacy system as of May 1, 2026.

The endpoint still contains historical records, including Spring/Summer 2026, but it does not provide the current Fall 2026 inventory needed by Pitch Scout. This is a provider migration, not an empty season.

### 4. GitHub Actions reported success during a total data outage

The workflow only checked whether the Node process exited successfully. All adapters swallowed provider errors and the engine still wrote a JSON file, committed it and exited with code 0. The timestamp therefore looked fresh while the underlying information was unusable.

### 5. Time filtering used string fragments instead of overlap logic

The 6:30 PM filter looked for literal strings such as `6:30`, `7:00` and `8:00 PM`. It missed times such as 7:15 PM and ignored event duration. A user could therefore see “open at 6:30” shortly before a scheduled game.

The local repair uses a conservative two-hour pickup window, a 30-minute event setup buffer and a 150-minute assumed event duration.

## Repairs implemented locally

- Dynamic academic-year selection for all school schedule sources.
- Explicit source-health metadata in the generated dataset.
- FXA zero-league response classified as degraded.
- Fail-closed field status:
  - Known event -> `occupied`.
  - No event and all required sources healthy -> `open`.
  - No event but any required source degraded -> `unknown`.
- Global warning banner when source coverage is incomplete.
- Field cards now say “Availability not verified” instead of “Available.”
- Conservative interval-overlap logic for 8:00 AM and 6:30 PM pickup filters.
- ESLint configured correctly for Node-based scraper files.
- Production frontend build verified.

After the repair, the current snapshot contains 4 confirmed occupied field/date records and 1,256 unknown records. This is less visually satisfying but truthful.

## Remaining data and modeling risks

### FXA replacement is mandatory

Most park fields depend entirely on FXA. Until a supported current FXA source is integrated, those fields cannot be certified as clear.

### “Open” is too strong a word

Even a fully working FXA feed and school athletics feed do not represent every permit, practice, school activity, maintenance closure, weather closure or walk-on group. Recommended public labels:

- `Known conflict`
- `No conflict found in connected sources`
- `Not verified`

Never promise that a field is open or available unless the authoritative facility operator supplies that status.

### School venue data may not identify the exact subfield

Westfield and Centreville events are currently mapped to one configured turf record. A source entry saying “Westfield High School” may refer to the stadium rather than the auxiliary turf. Venue-to-subfield confidence must be represented explicitly.

### Field aliases are brittle

FXA location mapping is exact-string based. Renames, punctuation changes and new subfields are silently ignored. Unmapped venues need to be stored in the output and surfaced as a health warning.

### Event durations are inferred

School sources expose start times but not always end times. The current overlap calculation is deliberately conservative. A future model should store `start`, `end`, `endEstimated`, and `confidence`.

### No independent validation

There is no automated comparison against known scheduled games. A daily canary test should assert that selected sources return plausible row counts and should stop publication if counts collapse unexpectedly.

### The generated snapshot is committed to the application repository

This causes multiple commits and deployments each day and couples data freshness to a frontend deployment. For ROYALS, schedules should live in a database or object store with a small API, while the frontend remains independently deployable.

## Recommended production architecture for ROYALS

### Ingestion layer

Create one adapter per provider. Every adapter returns:

```text
provider
fetchedAt
status: healthy | degraded | failed
coverageStart / coverageEnd
events[]
unmappedVenues[]
diagnostics
```

Adapters must never translate an error into an empty, healthy schedule.

### Normalized model

Use stable entities:

- `venues`
- `fields`
- `provider_venues`
- `schedule_sources`
- `source_runs`
- `field_events`
- `field_status_reports`

Each event should include provider, provider event ID, venue confidence, start/end time, cancellation status, source URL and last verification time.

### Confidence-based availability

Derive a field-time result as:

- `conflict_confirmed`: at least one overlapping event.
- `no_conflict_found`: required sources are healthy and no event overlaps.
- `unknown`: one or more required sources are missing/degraded.
- `closed`: authoritative closure or facility status.

Store and display the contributing evidence.

### ROYALS integration

Pitch Scout should become a reusable “Field Intelligence” service rather than being embedded directly into the mobile UI.

ROYALS can use it for:

- Coach/admin field search when relocating practices.
- “Known field conflict” warnings while creating events.
- Suggested backup fields.
- Field-status notifications.
- Schedule-change workflows.
- A public pickup-field discovery page.

The ROYALS app should clearly separate club-booked sessions from external/public-source observations.

## Priority plan

1. Ship the fail-closed safety repair.
2. Replace the FXA legacy adapter with a current supported feed or an approved export/integration.
3. Add Fairfax County permit/closure sources where technically and legally available.
4. Add provider canaries, anomaly thresholds and notifications.
5. Normalize venue aliases and subfield confidence.
6. Move snapshots out of Git commits into a database/object store.
7. Expose a small Field Intelligence API for ROYALS.
8. Add admin corrections and community reports with moderation/audit history.

## Group-chat explanation

Pitch Scout is a tool we built to reduce the problem of arriving at a soccer field and discovering that another league, school team or permitted group is already using it. It checks several public schedules and combines known conflicts into one mobile-friendly place.

The old version had an important reliability problem: when a source stopped working, it treated “no data received” as “field open.” FXA changed systems and the school feeds were still pointed at last school year, so the page could look current while showing incorrect availability.

We have identified the failures and changed the logic so missing data is now shown as “not verified,” never automatically “open.” The school feeds are working again and current conflicts are being detected. The remaining major task is reconnecting the current FXA schedule source and adding stronger county/closure coverage.

The larger goal is to use this as the Field Intelligence part of the Nova Royals app: helping coaches and players see known conflicts, find backup fields and avoid wasted trips. It will remain an advisory tool—not a guarantee or reservation system—unless the official facility operator confirms availability.
