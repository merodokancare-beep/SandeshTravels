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
      ADD COLUMN IF NOT EXISTS converted_at DATE;
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

    // Seed default regional templates if empty
    const templatesCount = await client.query('SELECT COUNT(*) FROM itinerary_templates');
    if (parseInt(templatesCount.rows[0].count, 10) === 0) {
      const templates = [
        {
          name: 'North Tour - Muktinath & Jomsom Jeep Adventure (5 Days)',
          region: 'North',
          total_days: 5,
          estimated_price: 650.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Drive from Pokhara to Tatopani. Relax in natural hot springs.', activities: 'Hot Springs, Scenic Drive' },
            { dayNumber: 2, description: 'Drive from Tatopani to Jomsom via Kaligandaki gorge. Amazing mountain views of Dhaulagiri.', activities: 'Kaligandaki Gorge, Mountain Views' },
            { dayNumber: 3, description: 'Drive Jomsom to Muktinath (Sacred Temple). Perform pilgrimage, drive back to Kagbeni.', activities: 'Muktinath Temple, Pilgrimage, Kagbeni' },
            { dayNumber: 4, description: 'Drive Kagbeni back to Marpha (Apple Orchard village) and down to Tatopani/Beni.', activities: 'Apple Orchards, Village Walk' },
            { dayNumber: 5, description: 'Return drive to Pokhara. Wrap up the journey.', activities: 'Return Drive, Pokhara Arrival' }
          ])
        },
        {
          name: 'Ghandruk Trek & Village Tour (3 Days)',
          region: 'North',
          total_days: 3,
          estimated_price: 300.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Drive Pokhara to Nayapul, start short trek to Ghandruk Gurung village.', activities: 'Scenic Drive, Trek Initiation, Ghandruk Village' },
            { dayNumber: 2, description: 'Explore Ghandruk village, mountain views of Annapurna South and Machhapuchhre.', activities: 'Village Exploration, Culture, Sunrise Views' },
            { dayNumber: 3, description: 'Trek down to Nayapul and drive back to Pokhara.', activities: 'Trek Return, Drive to Pokhara' }
          ])
        },
        {
          name: 'South Route - Chitwan Jungle Safari (3 Days)',
          region: 'South',
          total_days: 3,
          estimated_price: 400.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Drive from Pokhara/Kathmandu to Chitwan. Tharu village walk and cultural dance show.', activities: 'Drive to Chitwan, Cultural Dance, Tharu Village' },
            { dayNumber: 2, description: 'Full day jungle activities: Canoe ride, Elephant breeding center visit, and Jeep Safari.', activities: 'Canoe Ride, Jeep Safari, Wildlife Spotting' },
            { dayNumber: 3, description: 'Morning bird watching and drive back to Kathmandu/Pokhara.', activities: 'Bird Watching, Return Drive' }
          ])
        },
        {
          name: 'East Route - Tea Gardens of Ilam (4 Days)',
          region: 'East',
          total_days: 4,
          estimated_price: 500.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Fly/Drive to Bhadrapur, drive up to Ilam Tea Gardens. Walk in the lush green fields.', activities: 'Travel to Ilam, Tea Garden Walk' },
            { dayNumber: 2, description: 'Full day sightseeing of Kanyam tea estate and pristine Maipokhari lake.', activities: 'Kanyam Sightseeing, Maipokhari Lake' },
            { dayNumber: 3, description: 'Explore local cheese factories and view spectacular sunrise from Antu Danda.', activities: 'Cheese Tasting, Antu Danda Sunrise' },
            { dayNumber: 4, description: 'Drive down to Bhadrapur for return flight/drive.', activities: 'Return Drive, Departure' }
          ])
        },
        {
          name: 'Kathmandu Valley Heritage Tour (3 Days)',
          region: 'Central',
          total_days: 3,
          estimated_price: 250.00,
          days: JSON.stringify([
            { dayNumber: 1, description: 'Airport pickup and transfer to hotel. Evening walk around Thamel.', activities: 'Airport Pickup, Thamel Exploration' },
            { dayNumber: 2, description: 'Full day sightseeing: Swayambhunath, Boudhanath, Pashupatinath, and Patan Durbar Square.', activities: 'Temple Sightseeing, Heritage Tour' },
            { dayNumber: 3, description: 'Drive to Nagarkot for sunrise view, transfer to airport for departure.', activities: 'Nagarkot Sunrise, Departure Transfer' }
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
      console.log('Seeded default regional templates.');
    }

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

    const adminsCount = await client.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminsCount.rows[0].count, 10) === 0) {
      const hashedAdminPassword = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO admins (username, password, name)
        VALUES ('admin', $1, 'Sandesh Travels Owner')
      `, [hashedAdminPassword]);
      console.log('Seeded default admin owner.');
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
