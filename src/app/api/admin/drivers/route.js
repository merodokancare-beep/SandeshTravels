import { DriverController } from '@/controllers/DriverController';

export async function GET(request) {
  return DriverController.getAllDrivers(request);
}

export async function POST(request) {
  return DriverController.addDriver(request);
}
