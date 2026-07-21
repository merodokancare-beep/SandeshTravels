import { TrackingController } from '@/controllers/TrackingController';

export async function GET(request) {
  return TrackingController.getTrackingData(request);
}
