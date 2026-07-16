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

    const res = await query('SELECT * FROM hotels_registry ORDER BY name ASC');
    return NextResponse.json({
      success: true,
      hotels: res.rows
    });
  } catch (error) {
    console.error('Admin fetch hotels API error:', error);
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

    const { name, location, contact } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Hotel name is required.' },
        { status: 400 }
      );
    }

    const res = await query(
      `INSERT INTO hotels_registry (name, location, contact)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, location || null, contact || null]
    );

    return NextResponse.json({
      success: true,
      hotel: res.rows[0]
    });
  } catch (error) {
    console.error('Admin add hotel API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
