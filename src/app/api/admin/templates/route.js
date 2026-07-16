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

    const res = await query('SELECT * FROM itinerary_templates ORDER BY id ASC');
    return NextResponse.json({
      success: true,
      templates: res.rows
    });
  } catch (error) {
    console.error('Fetch templates API error:', error);
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

    const { name, region, totalDays, estimatedPrice, days } = await request.json();

    if (!name || !region || !totalDays || !days) {
      return NextResponse.json(
        { error: 'Template name, region, total days, and days are required.' },
        { status: 400 }
      );
    }

    const cleanPrice = String(estimatedPrice || '').replace(/[^0-9.]/g, '');
    const priceVal = parseFloat(cleanPrice) || 0.00;
    const daysJson = typeof days === 'string' ? days : JSON.stringify(days);

    const res = await query(
      `INSERT INTO itinerary_templates (name, region, total_days, estimated_price, days)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, region, parseInt(totalDays, 10), priceVal, daysJson]
    );

    return NextResponse.json({
      success: true,
      template: res.rows[0]
    });
  } catch (error) {
    console.error('Create template API error:', error);
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'A template with this name already exists.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const { id, name, region, totalDays, estimatedPrice, days } = await request.json();

    if (!id || !name || !region || !totalDays || !days) {
      return NextResponse.json(
        { error: 'Template ID, name, region, total days, and days are required.' },
        { status: 400 }
      );
    }

    const cleanPrice = String(estimatedPrice || '').replace(/[^0-9.]/g, '');
    const priceVal = parseFloat(cleanPrice) || 0.00;
    const daysJson = typeof days === 'string' ? days : JSON.stringify(days);

    const res = await query(
      `UPDATE itinerary_templates 
       SET name = $1, region = $2, total_days = $3, estimated_price = $4, days = $5
       WHERE id = $6
       RETURNING *`,
      [name, region, parseInt(totalDays, 10), priceVal, daysJson, parseInt(id, 10)]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: res.rows[0]
    });
  } catch (error) {
    console.error('Update template API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
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
        { error: 'Template ID is required.' },
        { status: 400 }
      );
    }

    const res = await query(
      'DELETE FROM itinerary_templates WHERE id = $1 RETURNING *',
      [parseInt(id, 10)]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully.'
    });
  } catch (error) {
    console.error('Delete template API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
