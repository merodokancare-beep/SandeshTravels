import { LeadController } from '@/controllers/LeadController';

export async function POST(request) {
  return LeadController.guestAcceptItinerary(request);
}
