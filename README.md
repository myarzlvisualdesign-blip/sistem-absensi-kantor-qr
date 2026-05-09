# Sistem Absensi Kantor QR

Aplikasi web absensi kantor berbasis QR Code dengan Next.js, TypeScript, dan Tailwind CSS.

## Fitur

### Untuk Pegawai (User)
- Login/Logout
- Absen dengan scan QR Code
- Lihat status absen hari ini
- Simple dan mobile-friendly

### Untuk Administrator
- Dashboard dengan statistik
- Kelola data pegawai (CRUD)
- Import data pegawai dari CSV/XLSX
- Generate dan download QR Code
- Kelola data absensi
- Edit dan hapus data absensi
- Export laporan ke CSV
- Atur jam masuk dan batas telat
- Audit log untuk semua perubahan

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (via Prisma) - bisa换成 D1 untuk Cloudflare
- **Authentication**: Custom JWT
- **QR Generation**: qrcode
- **Excel/CSV**: xlsx

## Prerequisites

- Node.js 18+
- npm atau pnpm

## Installation

### 1. Clone Repository

```bash
git clone <repo-url>
cd sistem-absensi-kantor-qr
```

### 2. Install Dependencies

```bash
npm install
# atau
pnpm install
```

### 3. Setup Environment

Copy file `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit file `.env` sesuai kebutuhan:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
NEXTAUTH_SECRET="your-nextauth-secret-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Setup Database

Generate Prisma client dan push schema ke database:

```bash
npm run db:generate
npm run db:push
```

### 5. Seed Data (Optional)

Jalankan seed untuk membuat data awal:

```bash
npm run db:seed
```

Akan dibuat:
- 1 admin: `admin@example.com` / `admin123`
- 3 pegawai: `user1@example.com`, `user2@example.com`, `user3@example.com` / `user123`
- Pengaturan kantor default

### 6. Run Development Server

```bash
npm run dev
```

Buka http://localhost:3000

## Deployment ke Cloudflare

### Menggunakan D1 (SQLite)

Cloudflare D1 adalah database SQLite yang berjalan di edge.

#### 1. Setup Wrangler

Login ke Cloudflare:

```bash
wrangler login
```

#### 2. Create D1 Database

```bash
wrangler d1 create absensi-db
```

Copy output ke `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"
```

#### 3. Setup Environment untuk Cloudflare

Di Cloudflare Pages, set environment variables:
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL` (format: `sqlite://your-d1-database`)

#### 4. Build dan Deploy

```bash
npm run pages:build
npm run pages:deploy
```

### Menggunakan PostgreSQL Eksternal

Jika menggunakan PostgreSQL (Neon, Supabase, Railway):

1. Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set `DATABASE_URL` ke connection string PostgreSQL

3. Run migration:

```bash
npx prisma migrate deploy
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Employees (Admin)
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee detail
- `PUT /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Delete employee
- `POST /api/employees/import` - Import from CSV/XLSX

### Attendance
- `GET /api/attendance` - List attendances (Admin)
- `GET /api/attendance/today` - Get today's attendance (User)
- `POST /api/attendance/scan` - Scan QR and create attendance
- `PUT /api/attendance/[id]` - Update attendance (Admin)
- `DELETE /api/attendance/[id]` - Delete attendance (Admin)
- `GET /api/attendance/export` - Export to CSV (Admin)

### Settings (Admin)
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

## Role-Based Access

| Route | Admin | User |
|-------|-------|------|
| /admin/* | ✓ | ✗ |
| /user/absen | ✗ | ✓ |
| /login | ✓ | ✓ |

## Import CSV Format

File CSV harus memiliki header:

```csv
employee_id,name,email,password,department,position,phone
EMP-2024-0001,Budi Santoso,budi@example.com,password123,IT,Engineer,081234567890
EMP-2024-0002,Siti Rahayu,siti@example.com,,HRD,Manager,081234567891
```

Kolom `employee_id` dan `password` optional.

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| User | user1@example.com | user123 |
| User | user2@example.com | user123 |
| User | user3@example.com | user123 |

## Troubleshooting

### Database Issues

```bash
# Reset database
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules/.cache

# Reinstall
npm install
```

## License

MIT
