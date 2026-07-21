import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { TemplateModel } from '@/models/Template';

export class TemplateController {
  static async getAllTemplates() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const templates = await TemplateModel.getAll();
      return NextResponse.json({
        success: true,
        templates
      });
    } catch (error) {
      console.error('TemplateController getAllTemplates error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async createTemplate(request) {
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

      const template = await TemplateModel.create({
        name,
        region,
        totalDays: parseInt(totalDays, 10),
        estimatedPrice: priceVal,
        days: daysJson
      });

      return NextResponse.json({
        success: true,
        template
      });
    } catch (error) {
      console.error('TemplateController createTemplate error:', error);
      if (error.code === '23505') { // Unique violation in postgres
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

  static async updateTemplate(request) {
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

      const template = await TemplateModel.update(parseInt(id, 10), {
        name,
        region,
        totalDays: parseInt(totalDays, 10),
        estimatedPrice: priceVal,
        days: daysJson
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        template
      });
    } catch (error) {
      console.error('TemplateController updateTemplate error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async deleteTemplate(request) {
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

      const template = await TemplateModel.delete(parseInt(id, 10));

      if (!template) {
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
      console.error('TemplateController deleteTemplate error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
