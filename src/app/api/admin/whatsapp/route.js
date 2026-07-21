import { WhatsAppController } from '@/controllers/WhatsAppController';

export async function POST(request) {
  return WhatsAppController.sendItineraryNotification(request);
}
