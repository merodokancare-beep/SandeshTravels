import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(request) {
  try {
    const session = await getAdminSession();
    if (!session || !session.username) {
      return NextResponse.json({ error: 'Unauthorized: Admin session required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // 'json' or 'sql'

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);

    if (format === 'json') {
      // Export all application tables to JSON
      const tables = [
        'admins',
        'partners',
        'leads',
        'hotels_registry',
        'drivers_registry',
        'itineraries',
        'itinerary_days',
        'active_stays',
        'invoices',
        'activity_logs',
        'app_settings',
        'message_templates'
      ];

      const backupData = {
        meta: {
          app: 'Sandesh Travels CRM',
          exportedAt: new Date().toISOString(),
          exportedBy: session.username,
          version: '1.0'
        },
        data: {}
      };

      for (const table of tables) {
        try {
          const res = await query(`SELECT * FROM ${table} ORDER BY id ASC`);
          // Scrub sensitive password hashes from export if desired, or keep as full DB mirror
          backupData.data[table] = res.rows;
        } catch (err) {
          console.warn(`Backup: skipped or table not found: ${table}`, err.message);
          backupData.data[table] = [];
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      return new Response(jsonString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="sandesh_travels_backup_${timestamp}.json"`
        }
      });
    }

    // Default to error if unknown format
    return NextResponse.json({ error: 'Invalid format. Use ?format=json' }, { status: 400 });
  } catch (error) {
    console.error('Backup export error:', error);
    return NextResponse.json({ error: 'Failed to generate backup: ' + error.message }, { status: 500 });
  }
}
