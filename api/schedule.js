import { apiSchedule, asVercelHandler } from '../src/lib/fieldApi.js';

export default asVercelHandler(query => apiSchedule(query));
