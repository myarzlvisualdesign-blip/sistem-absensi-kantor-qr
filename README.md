# Sistem Absensi Kantor QR

Aplikasi absensi kantor berbasis web dengan login pegawai, scan QR/barcode, dashboard admin, import/export spreadsheet, dan role-based access control.

## Fitur Utama

- Login/logout dengan custom JWT cookie.
- Role `ADMIN` dan `USER`.
- Pegawai hanya dapat absen untuk data employee miliknya sendiri.
- Validasi QR token unik, aktif, dan cocok dengan pegawai yang login.
- Satu kali absen masuk per pegawai per tanggal.
- Status absensi otomatis: `HADIR` atau `TERLAMBAT`.
- Pengaturan jam masuk dan batas telat, default `08:00` dan `08:15`.
- CRUD pegawai, nonaktif pegawai, regenerate QR.
- Import pegawai dari CSV/XLSX.
- Export absensi ke CSV/XLSX.
- Audit log untuk update/delete/import data penting.
- UI responsive untuk admin dan mobile-first untuk pegawai.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Custom JWT auth
- QR generator: `qrcode`
- QR/barcode scanner kamera: `@zxing/browser`
- Spreadsheet import/export: `xlsx`
- Cloudflare runtime: `@opennextjs/cloudflare`

## Setup Lokal

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
NEXTAUTH_SECRET="minimum-32-karakter"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="minimum-32-karakter"
ADMIN_EMAIL="admin.lapas@gmail.com"
ADMIN_PASSWORD="admin123"
APP_TIMEZONE="Asia/Jakarta"
```

Generate Prisma client, jalankan migration, lalu seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Jalankan development server:

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Akun Seed

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin.lapas@gmail.com` | `admin123` |
| User | `budi.santoso@gmail.com` | `user123` |
| User | `siti.rahayu@gmail.com` | `user123` |
| User | `andi.wijaya@gmail.com` | `user123` |

## Format Import Pegawai

CSV/XLSX harus memiliki header:

```csv
nip,name,email,password,position,phone
123456789,Dewi Lestari,dewi.lestari@gmail.com,user123,Staff,081234567893
,Pegawai Kontrak,pegawai.kontrak@gmail.com,,Staff,081234567894
```

Kolom `name` dan `email` wajib. Email harus memakai domain `@gmail.com`. Kolom `nip` boleh kosong untuk pegawai kontrak, tetapi jika diisi hanya boleh angka. Jika `password` kosong, sistem memakai password default `user123`. Jika `nip` sudah ada, data pegawai diperbarui. Jika email sudah digunakan pegawai lain, baris akan ditolak.

## Route Penting

- `/login`
- `/user/absen`
- `/admin/dashboard`
- `/admin/employees`
- `/admin/employees/create`
- `/admin/employees/[id]`
- `/admin/employees/[id]/edit`
- `/admin/employees/import`
- `/admin/employees/qr`
- `/admin/attendance`
- `/admin/attendance/[id]`
- `/admin/attendance/[id]/edit`
- `/admin/reports`
- `/admin/settings`

## Script

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run pages:build
npm run pages:deploy
```

## GitHub

```bash
git init
git add .
git commit -m "Initial commit: QR attendance system"
gh repo create sistem-absensi-kantor-qr --private --source=. --remote=origin --push
```

Gunakan `--public` jika repository ingin dibuat publik.

## Deployment Cloudflare

Project ini menggunakan `@opennextjs/cloudflare`, adapter resmi/kompatibel untuk aplikasi Next.js full-stack di Cloudflare Workers runtime. Di dashboard Cloudflare, resource ini berada di area **Workers & Pages**. Untuk aplikasi Next.js full-stack dengan API route, gunakan OpenNext/Workers runtime, bukan static Pages export.

Build dan deploy manual:

```bash
npm run pages:build
npm run pages:deploy
```

Konfigurasi utama:

- `wrangler.jsonc`
- `open-next.config.ts`
- `next.config.ts`
- `public/_headers`

Environment variables yang harus diisi di Cloudflare:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
JWT_SECRET=
APP_TIMEZONE=Asia/Jakarta
```

Untuk PostgreSQL eksternal di Cloudflare Workers, gunakan salah satu:

- Prisma Accelerate URL pada `DATABASE_URL` (`prisma://...`) yang terhubung ke Neon/Supabase/Railway PostgreSQL.
- Provider PostgreSQL yang expose driver/connection mode kompatibel Workers.

Untuk migration dan seed, jalankan dari lokal/CI dengan `DATABASE_URL` direct PostgreSQL:

```bash
npm run db:deploy
npm run db:seed
```

Setelah deploy, isi `NEXTAUTH_URL` dengan URL production Cloudflare, misalnya:

```env
NEXTAUTH_URL=https://sistem-absensi-kantor-qr.<subdomain>.workers.dev
```

## Deployment Otomatis dari GitHub

1. Push repo ke GitHub branch `main`.
2. Di Cloudflare dashboard buka **Workers & Pages**.
3. Buat aplikasi dari GitHub repository.
4. Gunakan build command:

```bash
npm install && npm run pages:build
```

5. Set environment variables Cloudflare.
6. Jalankan migration database dari lokal/CI.
7. Deploy branch `main`.

## Catatan Keamanan

- QR hanya berisi token UUID, bukan password atau data sensitif.
- Password selalu di-hash dengan bcrypt.
- Semua API memeriksa session dan role.
- User hanya bisa membaca/membuat absensi untuk employee miliknya.
- Admin dapat melihat/mengubah semua pegawai dan absensi.
- File `.env` tidak boleh di-commit.
