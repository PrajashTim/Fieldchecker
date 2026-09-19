/** Park/school coordinates for map pins, verified 2026-09-19 against FCPA,
 * school, and league venue records. Pins sit on the athletic field complex
 * (not the park HQ/entrance) where the app's fields are. Subfields at one
 * park are fanned out. Removed venues are not restored. */
const PARK_COORDS = {
  'Chantilly High School': { lat: 38.88036, lng: -77.40665 },
  'Stringfellow Park': { lat: 38.84563, lng: -77.40159 },
  'Poplar Tree Park': { lat: 38.86062, lng: -77.40923 },
  'Westfield High School': { lat: 38.88549, lng: -77.46474 },
  'E.C. Lawrence Park': { lat: 38.85810, lng: -77.43731 },
  'Arrowhead Park': { lat: 38.84758, lng: -77.40488 },
  'Centreville High School': { lat: 38.82525, lng: -77.41064 },
  'Sully Highlands Park': { lat: 38.92030, lng: -77.42560 },
  'Greenbriar Park': { lat: 38.86624, lng: -77.40549 },
  'Cunningham Park': { lat: 38.89223, lng: -77.24996 },
  'Nottoway Park': { lat: 38.88648, lng: -77.27406 },
  'Arrowbrook Park': { lat: 38.95453, lng: -77.41055 },
  'OakMont Park (Oak Marr)': { lat: 38.8802, lng: -77.3074 },
  'Lake Fairfax Park': { lat: 38.9677, lng: -77.3265 },
  'Oakton High School': { lat: 38.8803, lng: -77.2829 },
  'Braddock Park': { lat: 38.82736, lng: -77.40924 },
  'Freedom High School': { lat: 38.9139, lng: -77.5350 },
  "Byrne's Ridge Park": { lat: 38.9282, lng: -77.5524 },
  'Hal and Berni Hanson Regional Park': { lat: 38.9714, lng: -77.5510 },
  'John Champe High School': { lat: 38.9323, lng: -77.5659 },
};

const CHANTILLY = PARK_COORDS['Chantilly High School'];

export function coordsForField(field, siblings = []) {
  const base = PARK_COORDS[field.name] || CHANTILLY;
  const group = siblings.filter(item => item.name === field.name);
  const index = Math.max(0, group.findIndex(item => item.id === field.id));
  if (group.length <= 1) return { lat: base.lat, lng: base.lng };
  const angle = (index / group.length) * 2 * Math.PI;
  const radius = 0.00042;
  return {
    lat: base.lat + Math.cos(angle) * radius,
    lng: base.lng + Math.sin(angle) * radius,
  };
}

export { PARK_COORDS, CHANTILLY };
