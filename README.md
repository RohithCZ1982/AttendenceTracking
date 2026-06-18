# Attendance Tracker

A web-based attendance tracking application with photo compression, GPS location capture, and admin dashboard.

## Features

- **Employee Check-In/Check-Out** with selfie capture and GPS location
- **Photo Compression** — selfies are compressed client-side (640x480, JPEG ~60% quality, <200KB) before upload
- **Admin Dashboard** — view all employees, daily/monthly attendance, photos, and hours
- **Multiple Sessions** — supports multiple check-in/check-out pairs per day
- **Auto Hour Calculation** — calculates hours worked per session, per day, and per month
- **Mobile-First** — responsive design optimized for phones

## Tech Stack

- **Frontend:** HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** Neon (PostgreSQL)
- **Auth:** Mobile number + 6-digit PIN with server-side sessions
- **Security:** Helmet, rate limiting, input sanitization

## Project Structure

```
├── public/
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js           # Main application logic
│   │   └── compression.js   # Client-side photo compression
│   └── views/index.html     # Single-page app
├── src/
│   ├── server.js             # Express server setup
│   ├── db.js                 # Database init and connection
│   └── routes.js             # API routes
├── .env.example
├── package.json
└── README.md
```

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database

### 2. Clone and Install

```bash
git clone <repo-url>
cd AttendenceTracking
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Neon database URL and admin credentials:

```
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/attendance?sslmode=require
SESSION_SECRET=your-random-secret-key
PORT=3000
ADMIN_MOBILE=9999999999
ADMIN_PIN=123456
```

### 4. Run

```bash
npm start
```

The app will automatically create database tables and insert 6 sample employees on first run.

### 5. Access

- Open `http://localhost:3000`
- **Admin login:** Mobile `9999999999`, PIN `123456`
- **Sample employee:** Mobile `9876543210`, PIN `111111`

## Sample Employees

| Name          | Mobile       | PIN    |
|---------------|-------------|--------|
| Rahul Sharma  | 9876543210  | 111111 |
| Priya Patel   | 9876543211  | 222222 |
| Amit Kumar    | 9876543212  | 333333 |
| Sneha Reddy   | 9876543213  | 444444 |
| Vikram Singh  | 9876543214  | 555555 |
| Anjali Gupta  | 9876543215  | 666666 |

## Photo Compression

Photos are compressed client-side before upload:

- **Max dimensions:** 640 x 480 pixels
- **Format:** JPEG
- **Initial quality:** 60%
- **Target size:** < 200KB
- **Iterative:** If still too large, quality is reduced in 10% steps down to 10%
- **Server limit:** Rejects photos larger than 500KB

## Deploy to Render

1. Push code to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_MOBILE`, `ADMIN_PIN`)
6. Deploy

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/login | None | Employee/admin login |
| POST | /api/logout | Any | End session |
| GET | /api/session | Any | Check auth status |
| POST | /api/attendance | Employee | Record check-in/check-out |
| GET | /api/attendance/today | Employee | Today's summary |
| GET | /api/admin/employees | Admin | List all employees |
| GET | /api/admin/employee/:id | Admin | Employee monthly detail |
| POST | /api/admin/employee | Admin | Add new employee |
