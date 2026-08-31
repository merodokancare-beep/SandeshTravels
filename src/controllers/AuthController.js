import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { AdminModel } from '@/models/Admin';
import { PartnerModel } from '@/models/Partner';
import { setAdminSession, clearAdminSession, setSession, clearSession } from '@/lib/auth';

export class AuthController {
  static async adminLogin(request) {
    try {
      const { username, password } = await request.json();

      if (!username || !password) {
        return NextResponse.json(
          { error: 'Username and password are required' },
          { status: 400 }
        );
      }

      const admin = await AdminModel.getByUsername(username);
      if (!admin) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      if (admin.is_active === false) {
        return NextResponse.json(
          { error: 'Account is deactivated. Please contact the administrator.' },
          { status: 403 }
        );
      }

      const role = admin.role || 'admin';
      let modules = admin.modules;
      if (typeof modules === 'string') {
        try { modules = JSON.parse(modules); } catch (e) { modules = []; }
      }
      if (!Array.isArray(modules)) {
        modules = ['crm', 'itinerary', 'fleet', 'dispatch', 'tracking', 'hotels', 'drivers', 'templates', 'partners', 'reports', 'users'];
      }

      await setAdminSession({
        adminId: admin.id,
        username: admin.username,
        name: admin.name,
        role: role,
        modules: modules
      });

      return NextResponse.json({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: role,
          modules: modules
        }
      });
    } catch (error) {
      console.error('Admin login controller error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async adminLogout() {
    try {
      await clearAdminSession();
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Admin logout controller error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async partnerLogin(request) {
    try {
      const { username, password } = await request.json();

      if (!username || !password) {
        return NextResponse.json(
          { error: 'Username and password are required' },
          { status: 400 }
        );
      }

      const partner = await PartnerModel.getByUsername(username);
      if (!partner) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      const isMatch = await bcrypt.compare(password, partner.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

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
      console.error('Partner login controller error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async partnerLogout() {
    try {
      await clearSession();
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Partner logout controller error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
