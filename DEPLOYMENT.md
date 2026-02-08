# Deployment Guide

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Supabase database (or other PostgreSQL database)
3. (Optional) YouTube API key for engagement metrics

## Environment Variables

Before deploying, you need to configure these environment variables in your Vercel project:

### Required:
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://user:password@host:6543/postgres`
  - For Supabase: Use the **Transaction pooler** connection string (port 6543)
  - Find it in: Supabase Dashboard → Settings → Database → Connection Pooling

### Optional:
- `YOUTUBE_API_KEY`: YouTube Data API v3 key
  - Get from: https://console.cloud.google.com/apis/credentials
  - Without this, YouTube videos will still appear but won't show view/like counts

## Deployment Steps

### 1. Push your code to GitHub
```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push
```

### 2. Connect to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Vercel will auto-detect it as a Next.js project

### 3. Configure Environment Variables
1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add the following variables:
   - Name: `DATABASE_URL`, Value: `your-database-connection-string`
   - Name: `YOUTUBE_API_KEY`, Value: `your-youtube-api-key`
3. Make sure to set them for **Production**, **Preview**, and **Development** environments

### 4. Deploy
1. Click **Deploy** or trigger a deployment from the dashboard
2. Wait for the build to complete
3. Your app will be live at `your-project.vercel.app`

## Troubleshooting

### Build fails with "DATABASE_URL is not set"
- Ensure you've added the environment variable in Vercel settings
- Redeploy after adding variables

### Database connection errors
- Verify your DATABASE_URL is correct
- For Supabase, use the **Transaction mode** pooler (port 6543, not 5432)
- Check that your database allows connections from Vercel IPs

### API routes return errors
- Check the **Runtime Logs** in your Vercel dashboard
- Verify environment variables are set correctly

## Local Development

To run locally:
1. Copy `.env.example` to `.env.local`
2. Fill in your actual values
3. Run `npm run dev`

## CI/CD

Once connected, Vercel will automatically:
- Deploy to production when you push to `main`/`master`
- Create preview deployments for pull requests
- Run builds for each commit
