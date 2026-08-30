import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { PartnerModel } from '@/models/Partner';

export class PartnerController {
  static async adminGetAllPartners() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const partners = await PartnerModel.getAll();
      return NextResponse.json({ success: true, partners });
    } catch (error) {
      console.error('PartnerController adminGetAllPartners error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  static async adminCreatePartner(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }

      const { hotelName, contact, commissionRate, username, password } = await request.json();

      if (!hotelName || !username || !password) {
        return NextResponse.json(
          { error: 'Hotel/Agency name, username, and password are required.' },
          { status: 400 }
        );
      }

      // Check if username already exists
      const existing = await PartnerModel.getByUsername(username);
      if (existing) {
        return NextResponse.json(
          { error: `Username "${username}" is already taken.` },
          { status: 409 }
        );
      }

      const partner = await PartnerModel.create({ hotelName, contact, commissionRate, username, password });
      return NextResponse.json({ success: true, partner });
    } catch (error) {
      console.error('PartnerController adminCreatePartner error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  static async adminUpdatePartner(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }

      const { id, hotelName, contact, commissionRate } = await request.json();

      if (!id || !hotelName) {
        return NextResponse.json(
          { error: 'Partner ID and hotel name are required.' },
          { status: 400 }
        );
      }

      const partner = await PartnerModel.update(id, { hotelName, contact, commissionRate });
      if (!partner) {
        return NextResponse.json({ error: 'Partner not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, partner });
    } catch (error) {
      console.error('PartnerController adminUpdatePartner error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  static async adminDeletePartner(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'Partner ID is required.' }, { status: 400 });
      }

      const deleted = await PartnerModel.delete(id);
      if (!deleted) {
        return NextResponse.json({ error: 'Partner not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('PartnerController adminDeletePartner error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}

