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

      await setAdminSession({
        adminId: admin.id,
        username: admin.username,
        name: admin.name,
      });

      return NextResponse.json({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          name: admin.name
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
