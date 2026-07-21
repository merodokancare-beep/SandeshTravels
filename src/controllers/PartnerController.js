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
      return NextResponse.json({
        success: true,
        partners
      });
    } catch (error) {
      console.error('PartnerController adminGetAllPartners error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
