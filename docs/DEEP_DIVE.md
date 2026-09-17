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

### 3. FXA migrated away from the legacy integration (reconnected)

The app discovers FXA leagues through the old LeagueApps-oriented endpoint. It now returns zero `LIVE` or `UPCOMING` leagues. FXA's own help content describes LeagueApps as its legacy system as of May 1, 2026.

The endpoint still contains historical records, including Spring/Summer 2026, but it does not provide the current Fall 2026 inventory needed by Pitch Scout. This is a provider migration, not an empty season.

FXA's new public LeagueLab site exposes a schedule finder and full league schedule pages. The replacement adapter now discovers active soccer leagues through that schedule finder, parses stable game IDs/date/time/venue/team data, attaches source URLs, and records unmapped venue names instead of silently discarding them.

### 4. GitHub Actions reported success during a total data outage

The workflow only checked whether the Node process exited successfully. All adapters swallowed provider errors and the engine still wrote a JSON file, committed it and exited with code 0. The timestamp therefore looked fresh while the underlying information was unusable.

### 5. Time filtering used string fragments instead of overlap logic

The 6:30 PM filter looked for literal strings such as `6:30`, `7:00` and `8:00 PM`. It missed times such as 7:15 PM and ignored event duration. A user could therefore see “open at 6:30” shortly before a scheduled game.

The local repair uses a conservative two-hour pickup window, a 30-minute event setup buffer and a 150-minute assumed event duration.

## Repairs implemented

- Dynamic academic-year selection for all school schedule sources.
- Explicit source-health metadata in the generated dataset.
- Replaced the dead LeagueApps connector with the current FXA LeagueLab schedule finder.
- Current run: 22 active FXA soccer schedules checked and 806 mapped game rows found in the 30-day window.
- FXA games now carry their public source URL; unmapped venues are included in source diagnostics.
- Fail-closed field status:
  - Known event -> `occupied`.
  - No event and all required sources healthy -> `open`.
  - No event but any required source degraded -> `unknown`.
- Global warning banner when source coverage is incomplete.
- Field cards now say “Availability not verified” instead of “Available.”
- Conservative interval-overlap logic for 8:00 AM and 6:30 PM pickup filters.
- ESLint configured correctly for Node-based scraper files.
- Production frontend build verified.

After the FXA reconnection, the current snapshot contains 292 confirmed occupied field/date records. Unoccupied-looking time remains unverified because the authoritative Fairfax County/FCPS permit calendar is not publicly exposed as a complete schedule feed.

## Remaining data and modeling risks

### FXA coverage is restored, but it is not total field coverage

The replacement finds current FXA games, but FXA is only one renter. It does not represent youth clubs, county permits, private rentals, school practices, maintenance, closures, or informal walk-on use.

### 360-degree source matrix

| Signal | Authority | Public detail available | Current state |
|---|---|---|---|
| FXA adult league games | FXA / LeagueLab | Exact date, time, teams and field | Connected |
| School interscholastic games | Individual FCPS athletics sites | Date, time, opponent and venue; exact subfield sometimes ambiguous | Chantilly, Westfield and Centreville connected |
| Community-use permits | Fairfax NCS / FCPS CommunityUse / AFAR | Permit holders receive calendars; a complete public occupancy feed was not found | Missing authoritative source; app fails closed |
| Park field closures | Fairfax County Park Authority | Weekday status only; updated by 3 PM; signs override the site; weekends are user-determined | Candidate same-day status source, not future availability |
| Youth club games/practices | Individual clubs and platforms | Fragmented across club sites, SportsEngine, TeamSnap and private calendars | Not connected |
| For-profit rentals/camps | FCPA or FCPS property owner | Request systems exist; public schedules are incomplete | Not connected |
| Informal pickup/walk-on use | No authoritative publisher | Usually not knowable online | Fundamentally unobservable; community reports could help |

The county explicitly says a permit is the only way to guarantee a field, while permit calendars are delivered to permit holders. Therefore the product can confidently report known conflicts, but cannot truthfully guarantee open access from public web data alone.

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
2. Obtain a county/FCPS permit-data partnership, approved export, or public-record feed; this is the largest remaining blind spot.
3. Add the weekday FCPA closure/status source as a separate `closed` signal.
4. Add provider canaries, anomaly thresholds and notifications.
5. Normalize venue aliases and subfield confidence.
6. Move snapshots out of Git commits into a database/object store.
7. Expose a small Field Intelligence API for ROYALS.
8. Add admin corrections and community reports with moderation/audit history.

## Group-chat explanation

Pitch Scout is a tool we built to reduce the problem of arriving at a soccer field and discovering that another league, school team or permitted group is already using it. It checks several public schedules and combines known conflicts into one mobile-friendly place.

The old version had an important reliability problem: when a source stopped working, it treated “no data received” as “field open.” FXA changed systems and the school feeds were still pointed at last school year, so the page could look current while showing incorrect availability.

We identified the failures, changed missing data to “not verified,” and reconnected FXA through its new LeagueLab system. The current run checks 22 active FXA soccer leagues and detects hundreds of scheduled game rows, alongside current Chantilly, Westfield and Centreville school schedules. The largest remaining blind spot is the controlling Fairfax County/FCPS permit calendar, which is not published as a complete public occupancy feed. Until we obtain that data, the app can show confirmed conflicts but must not guarantee that an apparently empty field is open.

The larger goal is to use this as the Field Intelligence part of the Nova Royals app: helping coaches and players see known conflicts, find backup fields and avoid wasted trips. It will remain an advisory tool—not a guarantee or reservation system—unless the official facility operator confirms availability.
