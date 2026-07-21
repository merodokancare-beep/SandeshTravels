import { ItineraryController } from '@/controllers/ItineraryController';

export async function POST(request) {
  return ItineraryController.assignFleet(request);
}
