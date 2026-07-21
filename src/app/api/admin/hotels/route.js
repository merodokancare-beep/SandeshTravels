import { HotelController } from '@/controllers/HotelController';

export async function GET(request) {
  return HotelController.getAllHotels(request);
}

export async function POST(request) {
  return HotelController.addHotel(request);
}
