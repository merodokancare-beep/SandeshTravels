import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const res = await query('SELECT * FROM drivers_registry ORDER BY driver_name ASC');
    return NextResponse.json({
      success: true,
      drivers: res.rows
    });
  } catch (error) {
    console.error('Admin fetch drivers API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
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

    const res = await query(
      `INSERT INTO drivers_registry (driver_name, driver_phone, vehicle_number, vehicle_model)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [driverName, driverPhone, vehicleNumber || null, vehicleModel || null]
    );

    return NextResponse.json({
      success: true,
      driver: res.rows[0]
    });
  } catch (error) {
    console.error('Admin add driver API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
