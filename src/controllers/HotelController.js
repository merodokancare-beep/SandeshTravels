import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { HotelModel } from '@/models/Hotel';

export class HotelController {
  static async getAllHotels() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const hotels = await HotelModel.getAll();
      return NextResponse.json({
        success: true,
        hotels
      });
    } catch (error) {
      console.error('HotelController getAllHotels error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async addHotel(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { name, location, contact } = await request.json();

      if (!name) {
        return NextResponse.json(
          { error: 'Hotel name is required.' },
          { status: 400 }
        );
      }

      const hotel = await HotelModel.create({ name, location, contact });

      return NextResponse.json({
        success: true,
        hotel
      });
    } catch (error) {
      console.error('HotelController addHotel error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
