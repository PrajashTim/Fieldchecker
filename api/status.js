import { apiStatus, asVercelHandler } from '../src/lib/fieldApi.js';

export default asVercelHandler(() => apiStatus());
