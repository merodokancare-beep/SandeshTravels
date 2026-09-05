import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { CompanySettingsModel } from '@/models/CompanySettings';

export async function GET(request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await CompanySettingsModel.get();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('API /api/admin/settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updated = await CompanySettingsModel.update(body);

    return NextResponse.json({
      success: true,
      message: 'Company profile and payment settings updated successfully!',
      settings: updated
    });
  } catch (error) {
    console.error('API /api/admin/settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
