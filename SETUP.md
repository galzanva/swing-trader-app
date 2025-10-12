# Setup Guide for Swing Advisor

Follow these steps to get your Swing Advisor application up and running.

## Prerequisites

- ✅ Node.js 18 or higher
- ✅ PostgreSQL database running
- ✅ npm or yarn package manager

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all necessary packages including:
- Next.js 15
- NextAuth.js for authentication
- Prisma for database ORM
- bcrypt for password hashing
- And other dependencies

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and update these critical values:

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://user:password@localhost:5432/swing_advisor?schema=public"

# NextAuth - Generate a secure secret
# Run this command: openssl rand -base64 32
NEXTAUTH_SECRET="your-generated-secret-here"

# App URLs
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set Up the Database

Generate the Prisma client and run migrations:

```bash
# Generate Prisma Client
npm run prisma:generate

# Create the database schema
npm run prisma:migrate

# (Optional) Open Prisma Studio to view your database
npm run prisma:studio
```

### 4. Create Your First User

You have two options:

**Option A: Quick Setup (Recommended for testing)**

```bash
npm run create-user:quick
```

This creates a default admin user:
- **Email**: `galzaless@gmail.com`
- **Password**: `password`

**Option B: Custom User**

```bash
npm run create-user
```

Follow the interactive prompts to create a user with your own credentials.

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### 6. Log In

1. Open your browser and go to http://localhost:3000
2. You'll be automatically redirected to the login page
3. Enter your credentials from Step 4
4. You're in! 🎉

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors in your IDE, try:

1. Restart your TypeScript server (in VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")
2. Reload your IDE window
3. Delete `.next` folder and restart: `rm -rf .next && npm run dev`

### Database Connection Issues

If you can't connect to the database:

1. Make sure PostgreSQL is running
2. Verify your `DATABASE_URL` in `.env`
3. Check that the database exists: `psql -U postgres -c "CREATE DATABASE swing_advisor;"`
4. Test connection: `npm run prisma:studio`

### Authentication Issues

If login doesn't work:

1. Verify `NEXTAUTH_SECRET` is set in `.env`
2. Check that the user was created: `npm run prisma:studio`
3. Clear browser cookies and try again
4. Check console logs for error messages

### Port Already in Use

If port 3000 is already in use:

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill

# Or use a different port
PORT=3001 npm run dev
```

## Security Checklist

Before deploying to production:

- [ ] Change `NEXTAUTH_SECRET` to a strong, unique value
- [ ] Use a secure database password
- [ ] Update default user credentials
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Set proper CORS policies
- [ ] Review and update all API keys
- [ ] Enable database connection pooling
- [ ] Set up monitoring and logging

## Next Steps

Once logged in, you'll see the dashboard with two main modes:

1. **Market Scanner** - Find the best swing trading setups (Coming Soon)
2. **Deep Analysis** - Get comprehensive reports for any ticker (Coming Soon)

The authentication system is fully functional, and you can now focus on:
- Implementing the scanner logic in `/app/api/scan/route.ts`
- Building the analysis engine in `/app/api/analyze/route.ts`
- Adding technical indicators in `/lib/indicators/`
- Developing pattern detection in `/lib/patterns/`

## Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run migrations
npm run prisma:studio   # Open database GUI

# User Management
npm run create-user        # Interactive user creation
npm run create-user:quick  # Create default admin user

# Code Quality
npm run lint            # Run ESLint
```

## Project Structure

```
swing-advisor-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── scan/         # Scanner endpoints
│   │   └── analyze/      # Analysis endpoints
│   ├── login/            # Login page
│   ├── dashboard-client.tsx
│   └── page.tsx          # Home (dashboard)
├── lib/                   # Business logic
│   ├── auth.ts           # NextAuth config
│   ├── cohorts/          # Cohort analysis
│   ├── indicators/       # Technical indicators
│   ├── patterns/         # Pattern detection
│   └── risk/             # Risk management
├── prisma/               # Database
│   └── schema.prisma     # Database schema
├── scripts/              # Utility scripts
│   ├── create-user.ts
│   └── create-user-simple.ts
└── types/                # TypeScript types
    └── next-auth.d.ts
```

## Support

For detailed information about the product vision and roadmap, see:
- `/docs/PRODUCT_OVERVIEW.md` - Product vision and principles
- `README.md` - Project overview and documentation

## Happy Trading! 📈

Your secure, AI-powered swing trading advisor is ready to go!

