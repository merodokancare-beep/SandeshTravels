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

    const res = await query('SELECT id, hotel_name, commission_rate FROM partners ORDER BY hotel_name ASC');
    
    return NextResponse.json({
      success: true,
      partners: res.rows
    });
  } catch (error) {
    console.error('Fetch partners API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
