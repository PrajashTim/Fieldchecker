import { coordsForField } from '../data/fieldCoords';

export function mapsDirectionsUrl(field) {
  const coords = field ? coordsForField(field) : null;
  if (coords?.lat != null && coords?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  }
  const query = [field?.name, field?.location].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function DirectionsLink({ field, className = 'directions-link' }) {
  return (
    <a
      className={className}
      href={mapsDirectionsUrl(field)}
      target="_blank"
      rel="noopener noreferrer"
    >
      Directions
    </a>
  );
}
