import { apiFields, asVercelHandler } from '../src/lib/fieldApi.js';

export default asVercelHandler(() => apiFields());
