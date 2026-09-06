import { Pool, types } from 'pg';
import bcrypt from 'bcryptjs';

// Parse DATE (OID 1082) as a raw string directly to prevent timezone-shifting offsets
types.setTypeParser(types.builtins.DATE, val => val);

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString,
    ssl: connectionString && connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}
pool = global.pgPool;

let isInitialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = initDb().then(() => {
      isInitialized = true;
    }).catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function query(text, params) {
  await ensureInitialized();
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  await ensureInitialized();
  return await pool.connect();
}

// Function to initialize tables if they don't exist
export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Admins (Travel Owner / Staff Accounts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Partners (B2B Hotel Referrers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        hotel_name VARCHAR(100) NOT NULL,
        contact VARCHAR(50),
        commission_rate NUMERIC(5,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Leads (Traveler Leads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
        client_name VARCHAR(100) NOT NULL,
        client_phone VARCHAR(50) NOT NULL,
        travel_dates VARCHAR(100),
        num_travelers INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'new', -- 'new', 'quoted', 'converted', 'completed', 'cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Hotels Registry (Inventory of partner/registered hotels for booking stays)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotels_registry (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100),
        contact VARCHAR(50)
      );
    `);

    // 4. Drivers Registry (Inventory of drivers/vehicles)
    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers_registry (
        id SERIAL PRIMARY KEY,
        driver_name VARCHAR(100) NOT NULL,
        driver_phone VARCHAR(50) NOT NULL,
        vehicle_number VARCHAR(50),
        vehicle_model VARCHAR(50),
        vehicle_owner VARCHAR(100)
      );
      ALTER TABLE drivers_registry ADD COLUMN IF NOT EXISTS vehicle_owner VARCHAR(100);
    `);

    // 5. Itineraries
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        total_days INT DEFAULT 1,
        price NUMERIC(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'accepted'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Itinerary Days (Details for each day)
    await client.query(`
      CREATE TABLE IF NOT EXISTS itinerary_days (
        id SERIAL PRIMARY KEY,
        itinerary_id INT REFERENCES itineraries(id) ON DELETE CASCADE,
        day_number INT NOT NULL,
        hotel_id INT REFERENCES hotels_registry(id) ON DELETE SET NULL,
        driver_id INT REFERENCES drivers_registry(id) ON DELETE SET NULL,
        description TEXT,
        activities TEXT
      );
    `);

    // 7. Active Stays (Tracking checking in and out stages)
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_stays (
        id SERIAL PRIMARY KEY,
        lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
        hotel_id INT REFERENCES hotels_registry(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'staying', 'checked_out'
        check_in_date DATE,
        check_out_date DATE
      );
    `);

    // Safe Alterations for existing schema
    await client.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS start_date DATE,
      ADD COLUMN IF NOT EXISTS converted_at DATE,
      ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct',
      ADD COLUMN IF NOT EXISTS package_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS attended_by INT REFERENCES admins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS attended_by_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
      ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100),
      ADD COLUMN IF NOT EXISTS advance_submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS advance_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS advance_verified_by INT REFERENCES admins(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(10) DEFAULT 'T',
      ADD COLUMN IF NOT EXISTS vehicle_count INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS vehicle_preference_details VARCHAR(255),
      ALTER COLUMN travel_dates TYPE TEXT,
      ALTER COLUMN client_phone TYPE VARCHAR(100),
      ALTER COLUMN client_name TYPE VARCHAR(255);

      -- Drivers registry vehicle category and seating capacity
      ALTER TABLE drivers_registry 
      ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(10) DEFAULT 'T',
      ADD COLUMN IF NOT EXISTS seating_capacity INT DEFAULT 4;

      UPDATE drivers_registry SET vehicle_category = 'T' WHERE vehicle_category IS NULL;
      UPDATE drivers_registry SET seating_capacity = 4 WHERE seating_capacity IS NULL;

      -- Itineraries vehicle configuration
      ALTER TABLE itineraries
      ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(10) DEFAULT 'T',
      ADD COLUMN IF NOT EXISTS vehicle_count INT DEFAULT 1;

      -- Admin user enhancements for role-based permissions
      ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin',
      ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '["crm","itinerary","fleet","dispatch","tracking","hotels","drivers","templates","partners","reports","users"]'::jsonb,
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      UPDATE admins 
      SET role = 'admin' 
      WHERE role IS NULL;

      UPDATE admins 
      SET modules = '["crm","itinerary","fleet","dispatch","tracking","hotels","drivers","templates","partners","reports","users"]'::jsonb 
      WHERE modules IS NULL;

      UPDATE admins 
      SET is_active = TRUE 
      WHERE is_active IS NULL;

      -- Backfill source column for website and partner leads
      UPDATE leads 
      SET source = 'website' 
      WHERE (source IS NULL OR source = 'direct') 
        AND (travel_dates LIKE '%Website%' OR travel_dates LIKE '%[Website%' OR travel_dates LIKE '%🌐%');

      UPDATE leads 
      SET source = 'partner' 
      WHERE (source IS NULL OR source = 'direct') 
        AND partner_id IS NOT NULL;

      ALTER TABLE itinerary_days 
      ADD COLUMN IF NOT EXISTS driver_name_snapshot VARCHAR(100),
      ADD COLUMN IF NOT EXISTS driver_phone_snapshot VARCHAR(50),
      ADD COLUMN IF NOT EXISTS vehicle_number_snapshot VARCHAR(50),
      ADD COLUMN IF NOT EXISTS vehicle_model_snapshot VARCHAR(50),
      ADD COLUMN IF NOT EXISTS day_price NUMERIC(10,2) DEFAULT 0.00;

      UPDATE itinerary_days id_day
      SET 
        driver_name_snapshot = d.driver_name,
        driver_phone_snapshot = d.driver_phone,
        vehicle_number_snapshot = d.vehicle_number,
        vehicle_model_snapshot = d.vehicle_model
      FROM drivers_registry d
      WHERE id_day.driver_id = d.id
        AND id_day.driver_name_snapshot IS NULL;

      -- Migration: Upgrade existing leads with driver assignments to 'assigned' status
      UPDATE leads 
      SET status = 'assigned' 
      WHERE status IN ('new', 'quoted', 'converted') 
        AND id IN (
          SELECT DISTINCT i.lead_id 
          FROM itinerary_days id_day 
          JOIN itineraries i ON id_day.itinerary_id = i.id 
          WHERE id_day.driver_id IS NOT NULL
        );
    `);

    // 8. Itinerary Preset Templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS itinerary_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) UNIQUE NOT NULL,
        region VARCHAR(50) NOT NULL,
        total_days INT NOT NULL,
        estimated_price NUMERIC(10,2) DEFAULT 0.00,
        days JSONB NOT NULL
      );
    `);

    // Seed default regional templates only if table is completely empty
    const templatesCount = await client.query('SELECT COUNT(*) FROM itinerary_templates');
    if (parseInt(templatesCount.rows[0].count, 10) === 0) {
      const templates = [
        {
          name: '3N-4D Gangtok & Tsomgo Lake / Baba Mandir (4 Days)',
          region: 'East',
          total_days: 4,
          estimated_price: 0.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Pick up from NJP Railway Station / Bagdogra Airport (IXB) and transfer to Gangtok (125 KMS / 4 HRS). En-route option for Melli River Rafting. Check-in to hotel, rest of the day free to explore M.G. Marg on your own.', activities: 'Airport/NJP Pickup, Melli River Rafting, M.G. Marg Evening Walk' },
            { dayNumber: 2, description: 'Gangtok Full Day Local Sightseeing (9:30 AM to 4:30 PM). Visits include Tashi Viewpoint, Ganesh Tok, Hanuman Tok, Bakthang Waterfalls, Ban Jhackri Waterfalls, Gonjang Monastery, Gangtok Ropeway, Flower Show, Handloom & Handicrafts, and Namgyal Institute of Tibetology.', activities: 'Tashi Viewpoint, Waterfalls, Monasteries, Gangtok Ropeway, Flower Show' },
            { dayNumber: 3, description: 'Excursion to Tsomgo / Changu Lake (12,400 ft) & Baba Harbhajan Singh Mandir via Mandakini Waterfalls. Return to Gangtok by 4:00 PM. Optional tour to Nathula Pass (Indo-China Border) subject to permit availability.', activities: 'Tsomgo High Altitude Lake, Baba Harbhajan Mandir, Mandakini Waterfalls, Optional Nathula Pass' },
            { dayNumber: 4, description: 'After breakfast, check out from Gangtok hotel and transfer back to NJP Railway Station or Bagdogra Airport (125 KMS / 4 HRS) for onward journey.', activities: 'Hotel Checkout, Departure Transfer to NJP/IXB' }
          ])
        },
        {
          name: 'North Sikkim Jeep Adventure - Lachen, Gurudongmar & Lachung (3 Days)',
          region: 'North',
          total_days: 3,
          estimated_price: 0.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Pickup from Gangtok hotel (9:30–10:00 AM after permit creation). Transfer to Lachen (128 KMS / 6–8 HRS) via Tashi View Point, Seven Sister/Butterfly Waterfalls, Mangan Valley (Lunch), Singhik & Naga Waterfalls, Toong Check Post, Chumthang Valley. Arrive Lachen by 5 PM. Night halt at Lachen.', activities: 'Tashi View Point, Waterfalls, Mangan Valley, Singhik, Naga Waterfalls, Chumthang Valley, Lachen Halt' },
            { dayNumber: 2, description: 'Early 4:30 AM pickup from Lachen for Gurudongmar Lake (15,900 ft) via Thangu Valley (Breakfast). Reach lake by 9 AM. Return to Lachen for Lunch (2 PM), then transfer to Lachung via Bhim Nala Waterfalls. Night halt at Lachung.', activities: 'Gurudongmar High Altitude Lake, Thangu Valley, Bhim Nala Waterfalls, Lachung Halt' },
            { dayNumber: 3, description: '7:00 AM pickup from Lachung for Yumthang Valley. Visit Singhba Rhododendron Sanctuary and Natural Hot Springs. Optional Zero Point tour available. Return to Lachung for Lunch, then transfer to Gangtok hotel (6–7 PM arrival). Evening free at Gangtok Market.', activities: 'Yumthang Valley, Singhba Rhododendron Sanctuary, Hot Springs, Gangtok Return' }
          ])
        },
        {
          name: 'Pelling & Kalimpong Heritage Circuit (5 Days)',
          region: 'West',
          total_days: 5,
          estimated_price: 0.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Pickup from Bagdogra Airport (IXB) / NJP Railway Station and transfer to Pelling (138 KMS / 6 HRS, 5,480 ft), the ancient capital of Sikkim. Check-in to hotel & rest of the day free to explore Pelling market.', activities: 'Airport/NJP Pickup, Drive to Pelling, Pelling Market Evening' },
            { dayNumber: 2, description: 'Pelling Full Day Sightseeing (9:00 AM to 5:00 PM). Visit Pelling Helipad, Khecheopalri Sacred Lake, Khangchendzonga Waterfalls, Pemayangtse Monastery, Rabdentse Palace Ruins, Rimbi Waterfalls, Darap Cherry Village, Sewaro Rock Garden, and Glass Skywalk.', activities: 'Khecheopalri Lake, Khangchendzonga Waterfalls, Pemayangtse Monastery, Rabdentse Ruins, Glass Skywalk' },
            { dayNumber: 3, description: 'Check out from Pelling hotel and transfer to Kalimpong (120 KMS / 5 HRS) via Melli (Sikkim-West Bengal Border). Check-in at Kalimpong hotel. Evening free to explore Kalimpong market on your own.', activities: 'Pelling to Kalimpong Drive, Melli Border Crossing, Kalimpong Market' },
            { dayNumber: 4, description: 'Kalimpong Full Day Sightseeing (9:00 AM to 5:00 PM). Visit Durpin Dara Hill, Army Golf Club, Pine View Nursery, Shri Mangal Dham, Cactus Garden, Dr. Graham\'s Home, Hanuman Tok, Durga Mandir, Buddha Park, Science City, and Deolo Hill Point.', activities: 'Durpin Dara Hill, Deolo Hill Point, Dr. Grahams Home, Cactus Garden, Mangal Dham' },
            { dayNumber: 5, description: 'Check out from Kalimpong hotel and transfer to NJP Railway Station / Bagdogra Airport (80 KMS / 3 HRS) for onward journey.', activities: 'Hotel Checkout, Departure Transfer to NJP/IXB' }
          ])
        }
      ];

      for (const t of templates) {
        await client.query(`
          INSERT INTO itinerary_templates (name, region, total_days, estimated_price, days)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO NOTHING
        `, [t.name, t.region, t.total_days, t.estimated_price, t.days]);
      }

      console.log('Seeded default regional itinerary templates.');
    }

    // Ensure all template blueprints and unpriced draft itineraries have price = 0.00
    await client.query(`
      UPDATE itinerary_templates SET estimated_price = 0.00;
      UPDATE itineraries 
      SET price = 0.00 
      WHERE status = 'draft' 
        AND id IN (
          SELECT i.id 
          FROM itineraries i 
          LEFT JOIN itinerary_days d ON d.itinerary_id = i.id 
          GROUP BY i.id 
          HAVING COALESCE(SUM(d.day_price), 0) = 0
        );
    `);

    // Seed default admin and hotel partner if none exists
    const partnersCount = await client.query('SELECT COUNT(*) FROM partners');
    if (parseInt(partnersCount.rows[0].count, 10) === 0) {
      const hashedPartnerPassword = await bcrypt.hash('partner123', 10);

      // We'll create an admin partner representation or seed a partner
      await client.query(`
        INSERT INTO partners (username, password, hotel_name, contact, commission_rate)
        VALUES 
        ('vinayak_partner', $1, 'Hotel Vinayak', '+91 9876543210', 10.00)
      `, [hashedPartnerPassword]);
      
      console.log('Seeded default partner hotel.');
    }

    // 9. Company Profile & Banking Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(150) DEFAULT 'M/s Sandesh Travels',
        tagline VARCHAR(150) DEFAULT 'Tours & Travel Company',
        phone VARCHAR(50) DEFAULT '+91 9647878373',
        email VARCHAR(100) DEFAULT 'santeshtravelsgtk@gmail.com',
        website VARCHAR(100) DEFAULT 'www.sandeshtravels.in',
        address TEXT DEFAULT 'Chota Singtam, Near Kishan School, Aho Busty, Aho Yangtam GPU, Pakyong 737135',
        pan VARCHAR(50) DEFAULT 'AXXPR3863J',
        gstin VARCHAR(50) DEFAULT 'AXXPR3863J',
        license TEXT DEFAULT 'TTD:1667/DoT &CAv/Gtk/24/TA | TL: EOG/AHY/0282',
        upi_id VARCHAR(100) DEFAULT '9647878373@upi',
        upi_payee_name VARCHAR(150) DEFAULT 'Sandesh Travels',
        advance_percentage INT DEFAULT 10,
        bank_account_name VARCHAR(150) DEFAULT 'M/s Sandesh Travels',
        bank_name VARCHAR(100) DEFAULT 'State Bank of India',
        bank_branch VARCHAR(100) DEFAULT 'Pakyong / Gangtok Branch',
        bank_account_number VARCHAR(50) DEFAULT '412309876543',
        bank_ifsc VARCHAR(50) DEFAULT 'SBIN0001234',
        bank_account_type VARCHAR(50) DEFAULT 'Current Account',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const settingsCount = await client.query('SELECT COUNT(*) FROM company_settings');
    if (parseInt(settingsCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO company_settings (company_name, tagline, phone, email, website, address, pan, gstin, license, upi_id, upi_payee_name, advance_percentage, bank_account_name, bank_name, bank_branch, bank_account_number, bank_ifsc, bank_account_type)
        VALUES (
          'M/s Sandesh Travels',
          'Tours & Travel Company',
          '+91 9647878373',
          'santeshtravelsgtk@gmail.com',
          'www.sandeshtravels.in',
          'Chota Singtam, Near Kishan School, Aho Busty, Aho Yangtam GPU, Pakyong 737135',
          'AXXPR3863J',
          'AXXPR3863J',
          'TTD:1667/DoT &CAv/Gtk/24/TA | TL: EOG/AHY/0282',
          '9647878373@upi',
          'Sandesh Travels',
          10,
          'M/s Sandesh Travels',
          'State Bank of India',
          'Pakyong / Gangtok Branch',
          '412309876543',
          'SBIN0001234',
          'Current Account'
        );
      `);
      console.log('Seeded default company settings.');
    }

    await client.query('COMMIT');
    console.log('Database tables successfully initialized or verified.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}
