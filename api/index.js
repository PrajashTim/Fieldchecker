import { apiIndex, asVercelHandler } from '../src/lib/fieldApi.js';

export default asVercelHandler(() => apiIndex());
