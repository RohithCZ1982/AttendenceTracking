const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        mobile VARCHAR(15) UNIQUE NOT NULL,
        pin VARCHAR(6) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        type VARCHAR(10) NOT NULL CHECK (type IN ('checkin', 'checkout')),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        photo TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp)
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM employees');
    if (parseInt(rows[0].count) === 0) {
      const sampleEmployees = [
        { name: 'Rahul Sharma', mobile: '9876543210', pin: '111111' },
        { name: 'Priya Patel', mobile: '9876543211', pin: '222222' },
        { name: 'Amit Kumar', mobile: '9876543212', pin: '333333' },
        { name: 'Sneha Reddy', mobile: '9876543213', pin: '444444' },
        { name: 'Vikram Singh', mobile: '9876543214', pin: '555555' },
        { name: 'Anjali Gupta', mobile: '9876543215', pin: '666666' }
      ];

      for (const emp of sampleEmployees) {
        await client.query(
          'INSERT INTO employees (name, mobile, pin) VALUES ($1, $2, $3) ON CONFLICT (mobile) DO NOTHING',
          [emp.name, emp.mobile, emp.pin]
        );
      }
      console.log('Sample employees inserted');
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
