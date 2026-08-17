import { ItineraryController } from '@/controllers/ItineraryController';

export async function GET(request) {
  return ItineraryController.getItinerary(request);
}

export async function POST(request) {
  return ItineraryController.saveItinerary(request);
}

export async function PUT(request) {
  return ItineraryController.updateDriverSnapshot(request);
}
