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

      const { driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner } = await request.json();

      if (!driverName || !driverPhone) {
        return NextResponse.json(
          { error: 'Driver name and phone number are required.' },
          { status: 400 }
        );
      }

      // Check for vehicle registration uniqueness
      if (vehicleNumber) {
        const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
        const existing = await DriverModel.getByVehicleNumber(cleanVehicleNumber);
        if (existing) {
          return NextResponse.json(
            { error: `Vehicle registration "${cleanVehicleNumber}" is already registered to driver "${existing.driver_name}".` },
            { status: 400 }
          );
        }
      }

      const driver = await DriverModel.create({ driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner });

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

  static async updateDriver(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { id, driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner } = await request.json();

      if (!id || !driverName || !driverPhone) {
        return NextResponse.json(
          { error: 'ID, driver name and phone number are required.' },
          { status: 400 }
        );
      }

      // Check for vehicle registration uniqueness
      if (vehicleNumber) {
        const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
        const existing = await DriverModel.getByVehicleNumber(cleanVehicleNumber);
        if (existing && String(existing.id) !== String(id)) {
          return NextResponse.json(
            { error: `Vehicle registration "${cleanVehicleNumber}" is already registered to driver "${existing.driver_name}".` },
            { status: 400 }
          );
        }
      }

      const driver = await DriverModel.update(parseInt(id, 10), { driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner });

      return NextResponse.json({
        success: true,
        driver
      });
    } catch (error) {
      console.error('DriverController updateDriver error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async deleteDriver(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(
          { error: 'Driver ID is required for deletion.' },
          { status: 400 }
        );
      }

      await DriverModel.delete(parseInt(id, 10));

      return NextResponse.json({
        success: true,
        message: 'Driver deleted successfully.'
      });
    } catch (error) {
      console.error('DriverController deleteDriver error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
