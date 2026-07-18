# Indian Stock Analysis - Deployment Guide
# url - https://indianstockanalysis-production.up.railway.app/

## Quick Deploy Options

### **Option 1: Vercel (Recommended - Easiest)**

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Your app will be live at:**
   - `https://indianstockanalysis.vercel.app` (automatic)
   - You can add a custom domain in Vercel dashboard

4. **Add Custom Domain:**
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add your custom domain (e.g., `indianstockanalysis.com`)
   - Follow DNS instructions

---

### **Option 2: Railway (Very Simple)**

1. **Push to GitHub** (already done ✓)

2. **Go to:** https://railway.app

3. **Create New Project → Deploy from GitHub**

4. **Select:** `jastibharath/IndianStockAnalysis`

5. **Railway auto-detects everything!**

6. **Your app URL:** `https://indianstockanalysis.up.railway.app` (auto-generated)

7. **Add Custom Domain in Railway Dashboard:**
   - Project Settings → Domains
   - Add your domain
   - Update DNS records

---

### **Option 3: Docker + Any Cloud (AWS, GCP, Azure, etc.)**

```bash
# Build Docker image
docker build -t indianstockanalysis:latest .

# Run locally to test
docker run -p 3001:3001 indianstockanalysis:latest

# Push to Docker Hub (or your container registry)
docker tag indianstockanalysis:latest YOUR_USERNAME/indianstockanalysis:latest
docker push YOUR_USERNAME/indianstockanalysis:latest

# Then deploy to any cloud platform that supports Docker
```

---

### **Option 4: Heroku (Classic)**

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app with your name
heroku create indianstockanalysis

# Deploy
git push heroku main

# Open
heroku open
```

Your app will be at: `https://indianstockanalysis.herokuapp.com`

---

## Domain Setup (For Custom Domain)

After deploying to any platform above, you can add a custom domain:

### **Buy a Domain:**
- GoDaddy, Namecheap, Route53, CloudFlare, etc.

### **Point Domain to Your App:**

**For Vercel:**
```
Add domain in Vercel Dashboard → Settings → Domains
Use the provided DNS records
```

**For Railway:**
```
Add domain in Railway → Project Settings → Domains
Update DNS CNAME/A records
```

**Generic DNS Setup (CNAME):**
```
Type: CNAME
Name: @ or subdomain (depends on your registrar)
Value: Your app's host (e.g., indianstockanalysis.vercel.app)
```

---

## Environment Variables

Your app works out of the box with no special config needed. Optional:

```bash
PORT=3001                    # Deployment platform sets this automatically
NODE_ENV=production          # Already handled by most platforms
```

---

## Monitoring & Logs

**Vercel:**
- Dashboard → Your Project → Deployments → View Logs

**Railway:**
- Dashboard → Your Project → View Logs

**Heroku:**
```bash
heroku logs --tail
```

---

## API Endpoints (After Deployment)

Once deployed, your APIs will be live:

```
GET  /                              → Serves index.html
GET  /api/history/:symbol           → 3-month stock history
GET  /api/profile/:symbol           → Company profile & details
```

Example calls:
```
https://indianstockanalysis.vercel.app/api/history/RELIANCE?exchange=NSE
https://indianstockanalysis.vercel.app/api/profile/TCS?exchange=NSE
```

---

## Troubleshooting

**App won't start?**
- Check `npm start` runs locally: `node server.js`
- Check `package.json` has correct `"main"` and `"start"` script

**API calls failing?**
- CORS is enabled in `server.js`
- Check external APIs (Yahoo Finance, Wikipedia) aren't rate-limited

**Custom domain not working?**
- Wait 24-48 hours for DNS propagation
- Check DNS records are correct in your registrar

---

## Recommended Setup

1. **Deploy with Vercel** (5 minutes)
2. **Buy domain** `indianstockanalysis.com` or similar
3. **Add domain to Vercel** (automatic SSL/HTTPS)
4. **Done!** Your app is live globally

---

## Next Steps

Choose one platform above and let me know if you need help with the specific deployment!
