import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Retrieve partner by username
    const res = await query('SELECT * FROM partners WHERE username = $1', [username]);
    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const partner = res.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, partner.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Set cookie session
    await setSession({
      partnerId: partner.id,
      username: partner.username,
      hotelName: partner.hotel_name,
    });

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        username: partner.username,
        hotelName: partner.hotel_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
