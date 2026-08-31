import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { AdminModel } from '@/models/Admin';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || !session.adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await AdminModel.getById(session.adminId);
    if (!user || user.is_active === false) {
      return NextResponse.json(
        { error: 'User not found or deactivated' },
        { status: 401 }
      );
    }

    let modules = user.modules;
    if (typeof modules === 'string') {
      try { modules = JSON.parse(modules); } catch (e) { modules = []; }
    }
    if (!Array.isArray(modules)) {
      modules = user.role === 'admin'
        ? ['crm', 'itinerary', 'fleet', 'dispatch', 'tracking', 'hotels', 'drivers', 'templates', 'partners', 'reports', 'users']
        : ['crm', 'itinerary'];
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role || 'employee',
        modules: modules,
        phone: user.phone || ''
      }
    });
  } catch (error) {
    console.error('API /api/admin/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
