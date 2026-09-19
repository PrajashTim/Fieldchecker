/** Approximate park/school coordinates for map pins. Subfields at one park are fanned out. */
const PARK_COORDS = {
  'Chantilly High School': { lat: 38.87972, lng: -77.44747 },
  'Stringfellow Park': { lat: 38.87355, lng: -77.44115 },
  'Poplar Tree Park': { lat: 38.8619, lng: -77.4294 },
  'Westfield High School': { lat: 38.8831, lng: -77.4794 },
  'E.C. Lawrence Park': { lat: 38.8694, lng: -77.4106 },
  'Arrowhead Park': { lat: 38.8436, lng: -77.4289 },
  'Centreville High School': { lat: 38.8405, lng: -77.4378 },
  'Sully Highlands Park': { lat: 38.9248, lng: -77.3991 },
  'Greenbriar Park': { lat: 38.8468, lng: -77.3735 },
  'Cunningham Park': { lat: 38.8593, lng: -77.3147 },
  'Nottoway Park': { lat: 38.8616, lng: -77.2675 },
  'Arrowbrook Park': { lat: 38.9577, lng: -77.3848 },
  'OakMont Park (Oak Marr)': { lat: 38.8802, lng: -77.3074 },
  'Lake Fairfax Park': { lat: 38.9677, lng: -77.3265 },
  'Oakton High School': { lat: 38.8803, lng: -77.2829 },
  'Braddock Park': { lat: 38.8124, lng: -77.3159 },
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
