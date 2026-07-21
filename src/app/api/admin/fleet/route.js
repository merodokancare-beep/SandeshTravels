import { FleetController } from '@/controllers/FleetController';

export async function GET(request) {
  return FleetController.getFleetStatus(request);
}
