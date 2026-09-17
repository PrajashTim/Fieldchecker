# Pitch Scout source coverage register

Last audited: 2026-09-17

This register answers two different questions:

1. Which organizations can occupy the configured fields?
2. Which of those organizations publish enough exact date/time/subfield data to automate safely?

`Connected` never means complete real-world availability. It means the named provider's public schedule is being checked.

## Connected sources

| Provider | Sports/signals | Coverage | Method |
|---|---|---|---|
| FXA Sports / LeagueLab | Soccer, flag football, ultimate, softball and kickball | All current leagues exposed by FXA's public schedule finder; only exact configured-field matches are imported | Automatic discovery and full schedule parsing three times daily |
| Chantilly HS athletics | Football, soccer, lacrosse, field hockey, rugby and track events at the home turf venue | Public interscholastic schedule | Automatic 2026–2027 school-year parsing |
| Westfield HS athletics | Same turf sports | Public interscholastic schedule; venue-to-subfield can be ambiguous | Automatic school-year parsing |
| Centreville HS athletics | Same turf sports | Public interscholastic schedule; venue-to-subfield can be ambiguous | Automatic school-year parsing |
| FC Dulles | Published Fall 2026 REC Academy Friday sessions | Poplar Tree Park #2, 6–7 PM, Sept. 11–Oct. 30 excluding the published holiday weekend | Automatic page validation and recurring-event generation |

## Confirmed users not yet connectable to exact public schedules

| Organization/source family | Why it matters locally | Public-data finding | Status |
|---|---|---|---|
| Fairfax NCS / FCPS CommunityUse / AFAR | Controls community permits across park and school fields | Permit calendars are provided to permit holders; no comprehensive anonymous occupancy feed was found | Authoritative blind spot; partnership/export needed |
| Chantilly Youth Association (CYA) | Uses Arrowhead, Greenbriar, Poplar Tree, Stringfellow, Sully Highlands and other nearby fields | Team/practice schedules are generally distributed inside team systems | Inventory confirmed; exact public feed not found |
| Southwestern Youth Association (SYA) | Soccer, football, cricket and other sports around Centreville/Clifton | Public pages confirm seasons and field use, but exact assignments are sent by app/email after permits arrive | Inventory confirmed; exact public feed not found |
| FC Dulles travel and NCSL REC | Practices and home games around Chantilly; public program pages name some fields | TeamSnap/private team schedules hold much of the exact schedule | One public recurring program connected; broader feed missing |
| Virginia Valor FC / USL Youth | Publicly names Sully Highlands, Poplar Tree, Greenbriar, Arrowhead, Centreville HS and E.C. Lawrence as training/game locations | Team-specific schedules are shared through PlayMetrics | Inventory confirmed; exact public feed not found |
| NVASA | Adult soccer; historical public results show Poplar Tree #2 use | Current Fall 2026 schedule was not exposed in the public results selector during the audit | Candidate adapter when current schedule appears |
| Fairfax Soccer League | Year-round adult 50+/60+ soccer on Fairfax turf | Public site confirms activity but did not expose a field-by-field current schedule | Candidate/partnership |
| Fairfax Women's Soccer Association, NVSL, WAWSL, ZogSports | County-listed adult soccer providers | Separate platforms and incomplete public field detail | Provider-by-provider research needed |
| Washington Cricket League / Fairfax Cricket Club | Cricket activity includes Lake Fairfax and other regional grounds | Public fixtures exist across several sites, but no current fixture was found on the configured Lake Fairfax soccer subfields | Monitor; do not map a cricket ground to a soccer field without exact subfield evidence |
| SYA youth cricket | Active spring/fall program around Centreville | Public description says Kincheloe and nearby locations; exact weekly assignments are private | Does not currently prove conflicts on configured fields |
| Informal pickup/walk-on groups | Can occupy any otherwise vacant field | Usually no authoritative online record | Unobservable online; future moderated community reports |

## Known additional FXA venues

FXA's current schedule includes fields the app does not yet model, including Grove Point, Hutchison, Jackson Middle School, Ken Lawrence, Lake Braddock Secondary, Pine Ridge, Rolling Valley West and South County Middle School. They remain in source diagnostics as unmapped venues so expansion is deliberate rather than silent.

## Automation contract

- GitHub Actions runs at 12:00, 17:00 and 22:00 UTC every day.
- Each successful run rebuilds a rolling 30-day window from that run's local date, thereby dropping elapsed dates and appending a new final date.
- FXA leagues are discovered each run; league IDs and seasons are not hard-coded.
- School academic years are computed dynamically.
- Critical connected-source failures stop publication and preserve the last known-good snapshot.
- The workflow retries transient failures three times, serializes runs to prevent bot races, and rebases before push.
- Provider-specific missing coverage remains `unknown`; it is never translated into `open`.

## Next connector order

1. Fairfax Park Authority same-day closure status as an authoritative `closed` signal.
2. Current NVASA schedule when Fall data becomes public.
3. CYA/SYA/FC Dulles/Valor approved calendar exports or team-platform integrations.
4. Cricket connector only where the fixture identifies an exact configured field, not merely the same park.
5. Normalized Field Intelligence API for Nova Royals after event storage moves out of the Git-committed snapshot.
