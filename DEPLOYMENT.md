# Deployment Guide - Sistem Absensi Kantor QR

## Prerequisites
- Cloudflare Account (Free or Paid)
- GitHub Repository connected to Cloudflare

## Quick Start (Auto-Deployment)

### Option 1: Cloudflare Pages Dashboard (Recommended)

1. **Create Cloudflare Pages Project**
   - Go to: https://dash.cloudflare.com/
   - Navigate to Pages → Create a project
   - Connect to Git → Select your GitHub repository
   - Project name: `sistem-absensi-kantor-qr`

2. **Build Configuration**
   ```
   Build command: npm run pages:build
   Build output directory: .open-next
   Root directory: (leave empty or use /)
   Node.js version: 20
   ```

3. **Environment Variables** (Set in Cloudflare Dashboard)
   ```
   NODE_ENV = production
   DATABASE_URL = your_supabase_database_url
   JWT_SECRET = your_jwt_secret
   ```

4. **Save and Deploy**
   - Click "Save and Deploy"
   - Cloudflare will automatically deploy on every push to `main` branch

### Option 2: GitHub Actions Workflow

1. **Add Secrets to GitHub Repository**
   - Go to: Repository Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `CLOUDFLARE_API_TOKEN`: Create at https://dash.cloudflare.com/profile/api-tokens
     - `CLOUDFLARE_ACCOUNT_ID`: Found in Cloudflare Dashboard → Workers & Pages

2. **GitHub Actions Workflow**
   - Workflow file: `.github/workflows/cloudflare-pages.yml`
   - Automatically deploys on push to `main` branch

## Manual Deployment

### Using Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build project
npm run pages:build

# Deploy to Cloudflare Pages
npm run deploy
```

## Database Setup (Supabase)

### 1. Create Supabase Project
- Go to: https://supabase.com/
- Create new project
- Get connection string from Settings → Database

### 2. Run Migrations

```bash
# Set DATABASE_URL in .env
DATABASE_URL="postgresql://..."

# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database (optional)
npm run db:seed
```

### 3. Add Environment Variables

In Cloudflare Dashboard → Pages → Settings → Environment variables:

```
DATABASE_URL = postgresql://user:password@host:port/dbname
JWT_SECRET = your_secure_random_string
NEXT_PUBLIC_APP_URL = https://your-app.pages.dev
```

## Testing Deployment

### Local Testing

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Preview Deployment

For pull requests, Cloudflare automatically creates preview deployments at:
```
https://<branch-name>--<project-name>.pages.dev
```

## Troubleshooting

### Build Errors
- Check Node.js version (should be 18+)
- Verify all dependencies are installed: `npm install`
- Check Prisma schema is valid: `npm run db:generate`

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Ensure database migrations are applied

### Deployment Timeout
- Cloudflare Pages has a 10-minute build timeout
- For large builds, consider optimization or upgrade plan

## Monitoring

### Cloudflare Analytics
- Go to: Pages → Select project → Analytics
- Monitor: Requests, Bandwidth, Errors

### GitHub Actions
- Go to: Actions → Deploy to Cloudflare Pages
- View deployment logs and status

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Pages → Select project
2. Scroll to "Deployments" section
3. Find the deployment to rollback to
4. Click "Rollback" (three dots menu)

## Support

For issues or questions:
- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- OpenNext.js Cloudflare: https://opennext.js.org/cloudflare
- Supabase Docs: https://supabase.com/docs
