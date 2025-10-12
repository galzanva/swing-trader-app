# 🚀 Quick Start - Get Running in 5 Minutes

## What You Need

1. **PostgreSQL running** on your machine
2. **Node.js 18+** installed
3. **5 minutes** of your time

## Commands to Run (Copy & Paste)

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Edit .env - Update these TWO critical values:
#    - DATABASE_URL (your PostgreSQL connection)
#    - NEXTAUTH_SECRET (run: openssl rand -base64 32)

# 4. Set up database
npm run prisma:generate
npm run prisma:migrate

# 5. Create admin user (quick setup)
npm run create-user:quick

# 6. Start the app
npm run dev
```

## Default Login Credentials

After running `create-user:quick`:

```
Email:    galzaless@gmail.com
Password: password
```

**⚠️ Change the password after first login!**

## Access Your App

Open: **http://localhost:3000**

You'll be automatically redirected to login. Use the credentials above.

## What You'll See

✅ **Modern Login Page** - Navy/teal theme with glass morphism  
✅ **Dashboard** - Two modes: Market Scanner & Deep Analysis  
✅ **Secure Authentication** - NextAuth with bcrypt password hashing  
✅ **Protected Routes** - Automatic redirect for unauthenticated users  
✅ **Session Management** - JWT-based with 30-day expiry  

## Next Steps After Login

The dashboard shows two main features (currently in "Coming Soon" state):

1. **📊 Market Scanner** - Will scan markets for swing trading setups
2. **🔍 Deep Analysis** - Will provide comprehensive ticker analysis

You can now start implementing:
- Scanner logic in `app/api/scan/route.ts`
- Analysis logic in `app/api/analyze/route.ts`
- Technical indicators in `lib/indicators/`
- Pattern detection in `lib/patterns/`

## Troubleshooting

### Can't connect to database?
```bash
# Make sure PostgreSQL is running
# Create the database manually if needed
psql -U postgres -c "CREATE DATABASE swing_advisor;"
```

### TypeScript errors in IDE?
- Restart TypeScript server
- Or reload IDE window
- Or delete `.next` and restart: `rm -rf .next && npm run dev`

### Port 3000 already in use?
```bash
# Kill the process
lsof -ti:3000 | xargs kill
```

## File Structure Overview

```
swing-advisor-app/
├── app/
│   ├── api/auth/          ✅ NextAuth endpoints
│   ├── login/             ✅ Login page
│   ├── page.tsx           ✅ Dashboard (protected)
│   └── dashboard-client.tsx ✅ Dashboard UI
├── lib/
│   └── auth.ts            ✅ NextAuth config
├── middleware.ts          ✅ Route protection
├── prisma/
│   └── schema.prisma      ✅ Database models
├── scripts/
│   ├── create-user.ts     ✅ Interactive user creation
│   └── create-user-simple.ts ✅ Quick admin user
└── .env.example           ✅ Environment template
```

## Security Features Implemented

✅ Bcrypt password hashing (12 rounds)  
✅ JWT session tokens  
✅ HTTP-only cookies  
✅ CSRF protection  
✅ Protected routes via middleware  
✅ Secure environment variables  
✅ Database indexing for performance  

## Available Commands

```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run prisma:studio   # View database in GUI
npm run create-user     # Create user (interactive)
```

---

**Need more details?** Check `SETUP.md` for comprehensive setup guide or `README.md` for full documentation.

**Ready to code!** 🎉

