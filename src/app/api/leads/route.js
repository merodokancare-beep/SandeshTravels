import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { clientName, clientPhone, travelDates, numTravelers } = await request.json();

    if (!clientName || !clientPhone) {
      return NextResponse.json(
        { error: 'Client Name and Client Phone are required.' },
        { status: 400 }
      );
    }

    const travelersCount = parseInt(numTravelers, 10) || 1;

    // Insert public direct lead into database (partner_id is null)
    const res = await query(
      `INSERT INTO leads (partner_id, client_name, client_phone, travel_dates, num_travelers, status)
       VALUES (NULL, $1, $2, $3, $4, 'new')
       RETURNING *`,
      [clientName, clientPhone, travelDates || null, travelersCount]
    );

    return NextResponse.json({
      success: true,
      lead: res.rows[0]
    });
  } catch (error) {
    console.error('Public lead submission API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
