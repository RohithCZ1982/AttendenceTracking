const express = require('express');
const { pool } = require('./db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.employeeId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Employee login
router.post('/api/login', async (req, res) => {
  const { mobile, pin } = req.body;

  if (!mobile || !pin || !/^\d{10}$/.test(mobile) || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'Valid 10-digit mobile and 6-digit PIN required' });
  }

  // Check admin
  if (mobile === process.env.ADMIN_MOBILE && pin === process.env.ADMIN_PIN) {
    req.session.isAdmin = true;
    req.session.employeeId = null;
    return res.json({ success: true, isAdmin: true, name: 'Admin' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, name, mobile FROM employees WHERE mobile = $1 AND pin = $2',
      [mobile, pin]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid mobile number or PIN' });
    }

    req.session.employeeId = rows[0].id;
    req.session.isAdmin = false;
    res.json({ success: true, isAdmin: false, name: rows[0].name, id: rows[0].id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check session
router.get('/api/session', (req, res) => {
  if (req.session.isAdmin) {
    return res.json({ authenticated: true, isAdmin: true, name: 'Admin' });
  }
  if (req.session.employeeId) {
    return res.json({ authenticated: true, isAdmin: false, employeeId: req.session.employeeId });
  }
  res.json({ authenticated: false });
});

// Record attendance (check-in or check-out)
router.post('/api/attendance', requireAuth, async (req, res) => {
  const { type, latitude, longitude, accuracy, photo } = req.body;
  const employeeId = req.session.employeeId;

  if (!['checkin', 'checkout'].includes(type)) {
    return res.status(400).json({ error: 'Invalid attendance type' });
  }

  // Limit photo size to 500KB after compression
  if (photo && photo.length > 500 * 1024) {
    return res.status(400).json({ error: 'Photo too large. Please try again.' });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { rows: todayRecords } = await pool.query(
      `SELECT type, timestamp FROM attendance
       WHERE employee_id = $1 AND timestamp >= $2 AND timestamp < $3
       ORDER BY timestamp ASC`,
      [employeeId, today.toISOString(), tomorrow.toISOString()]
    );

    if (type === 'checkout') {
      const lastRecord = todayRecords[todayRecords.length - 1];
      if (!lastRecord || lastRecord.type !== 'checkin') {
        return res.status(400).json({ error: 'You must check in before checking out' });
      }
    }

    if (type === 'checkin') {
      const lastRecord = todayRecords[todayRecords.length - 1];
      if (lastRecord && lastRecord.type === 'checkin') {
        return res.status(400).json({ error: 'You are already checked in. Please check out first.' });
      }
    }

    await pool.query(
      `INSERT INTO attendance (employee_id, type, timestamp, latitude, longitude, accuracy, photo)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6)`,
      [employeeId, type, latitude || null, longitude || null, accuracy || null, photo || null]
    );

    res.json({ success: true, message: type === 'checkin' ? 'Checked in successfully' : 'Checked out successfully' });
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get employee's today summary
router.get('/api/attendance/today', requireAuth, async (req, res) => {
  const employeeId = req.session.employeeId;

  try {
    const { rows: emp } = await pool.query('SELECT name FROM employees WHERE id = $1', [employeeId]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { rows: records } = await pool.query(
      `SELECT type, timestamp, latitude, longitude FROM attendance
       WHERE employee_id = $1 AND timestamp >= $2 AND timestamp < $3
       ORDER BY timestamp ASC`,
      [employeeId, today.toISOString(), tomorrow.toISOString()]
    );

    const totalHours = calculateHours(records);
    const lastRecord = records[records.length - 1];
    const currentStatus = lastRecord ? lastRecord.type : null;
    const lastTime = lastRecord ? lastRecord.timestamp : null;

    res.json({
      name: emp[0]?.name,
      records,
      totalHours,
      currentStatus,
      lastTime
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all employees with today's hours
router.get('/api/admin/employees', requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { rows: employees } = await pool.query(
      'SELECT id, name, mobile FROM employees ORDER BY name'
    );

    const result = [];
    for (const emp of employees) {
      const { rows: records } = await pool.query(
        `SELECT type, timestamp FROM attendance
         WHERE employee_id = $1 AND timestamp >= $2 AND timestamp < $3
         ORDER BY timestamp ASC`,
        [emp.id, today.toISOString(), tomorrow.toISOString()]
      );

      const totalHours = calculateHours(records);
      const lastRecord = records[records.length - 1];

      result.push({
        id: emp.id,
        name: emp.name,
        mobile: emp.mobile,
        totalHoursToday: totalHours,
        currentStatus: lastRecord ? lastRecord.type : 'none',
        lastTime: lastRecord ? lastRecord.timestamp : null
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Admin employees error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: get employee detail with monthly attendance
router.get('/api/admin/employee/:id', requireAdmin, async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: 'Invalid employee ID' });

  try {
    const { rows: emp } = await pool.query('SELECT id, name, mobile FROM employees WHERE id = $1', [empId]);
    if (emp.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const { rows: records } = await pool.query(
      `SELECT id, type, timestamp, latitude, longitude, accuracy, photo FROM attendance
       WHERE employee_id = $1 AND timestamp >= $2 AND timestamp < $3
       ORDER BY timestamp ASC`,
      [empId, startDate.toISOString(), endDate.toISOString()]
    );

    // Group by date
    const dailyRecords = {};
    let monthlyTotalMinutes = 0;

    for (const record of records) {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!dailyRecords[date]) {
        dailyRecords[date] = [];
      }
      dailyRecords[date].push(record);
    }

    const attendance = [];
    for (const [date, dayRecords] of Object.entries(dailyRecords)) {
      const hours = calculateHours(dayRecords);
      monthlyTotalMinutes += hours * 60;
      attendance.push({
        date,
        records: dayRecords,
        hoursWorked: hours
      });
    }

    attendance.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      employee: emp[0],
      month,
      year,
      attendance,
      monthlyTotalHours: Math.round(monthlyTotalMinutes / 60 * 100) / 100
    });
  } catch (err) {
    console.error('Employee detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: add employee
router.post('/api/admin/employee', requireAdmin, async (req, res) => {
  const { name, mobile, pin } = req.body;

  if (!name || !mobile || !pin) {
    return res.status(400).json({ error: 'Name, mobile, and PIN are required' });
  }
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Mobile must be 10 digits' });
  }
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 6 digits' });
  }
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Name must be 2-100 characters' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM employees WHERE mobile = $1', [mobile]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An employee with this mobile number already exists' });
    }

    await pool.query(
      'INSERT INTO employees (name, mobile, pin) VALUES ($1, $2, $3)',
      [name.trim(), mobile, pin]
    );

    res.json({ success: true, message: 'Employee added successfully' });
  } catch (err) {
    console.error('Add employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function calculateHours(records) {
  let totalMinutes = 0;

  for (let i = 0; i < records.length; i++) {
    if (records[i].type === 'checkin') {
      const checkinTime = new Date(records[i].timestamp);
      let checkoutTime;

      if (i + 1 < records.length && records[i + 1].type === 'checkout') {
        checkoutTime = new Date(records[i + 1].timestamp);
      } else if (i === records.length - 1) {
        // Open session — calculate up to now or midnight
        const now = new Date();
        const midnight = new Date(checkinTime);
        midnight.setHours(23, 59, 59, 999);
        checkoutTime = now < midnight ? now : midnight;
      } else {
        continue;
      }

      totalMinutes += (checkoutTime - checkinTime) / (1000 * 60);
    }
  }

  return Math.round(totalMinutes / 60 * 100) / 100;
}

module.exports = router;
