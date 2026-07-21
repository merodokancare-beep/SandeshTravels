import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { DriverModel } from '@/models/Driver';

export class DriverController {
  static async getAllDrivers() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const drivers = await DriverModel.getAll();
      return NextResponse.json({
        success: true,
        drivers
      });
    } catch (error) {
      console.error('DriverController getAllDrivers error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async addDriver(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { driverName, driverPhone, vehicleNumber, vehicleModel } = await request.json();

      if (!driverName || !driverPhone) {
        return NextResponse.json(
          { error: 'Driver name and phone number are required.' },
          { status: 400 }
        );
      }

      const driver = await DriverModel.create({ driverName, driverPhone, vehicleNumber, vehicleModel });

      return NextResponse.json({
        success: true,
        driver
      });
    } catch (error) {
      console.error('DriverController addDriver error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
