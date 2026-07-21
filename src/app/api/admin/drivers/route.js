import { DriverController } from '@/controllers/DriverController';

export async function GET(request) {
  return DriverController.getAllDrivers(request);
}

export async function POST(request) {
  return DriverController.addDriver(request);
}

export async function PUT(request) {
  return DriverController.updateDriver(request);
}

export async function DELETE(request) {
  return DriverController.deleteDriver(request);
}
