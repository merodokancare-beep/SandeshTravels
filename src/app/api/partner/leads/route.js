import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const { clientName, clientPhone, travelDates, numTravelers } = await request.json();

    if (!clientName || !clientPhone) {
      return NextResponse.json(
        { error: 'Client Name and Client Phone are required.' },
        { status: 400 }
      );
    }

    const travelersCount = parseInt(numTravelers, 10) || 1;

    // Insert lead into database
    const res = await query(
      `INSERT INTO leads (partner_id, client_name, client_phone, travel_dates, num_travelers, status)
       VALUES ($1, $2, $3, $4, $5, 'new')
       RETURNING *`,
      [session.partnerId, clientName, clientPhone, travelDates || null, travelersCount]
    );

    return NextResponse.json({
      success: true,
      lead: res.rows[0]
    });
  } catch (error) {
    console.error('Lead submission API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Get leads submitted by this partner
    const res = await query(
      `SELECT * FROM leads 
       WHERE partner_id = $1 
       ORDER BY created_at DESC`,
      [session.partnerId]
    );

    // Get partner info to display name, rate, etc.
    const partnerRes = await query(
      `SELECT username, hotel_name, commission_rate FROM partners WHERE id = $1`,
      [session.partnerId]
    );
    const partnerInfo = partnerRes.rows[0] || null;

    return NextResponse.json({
      success: true,
      leads: res.rows,
      partner: partnerInfo
    });
  } catch (error) {
    console.error('Fetch leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
