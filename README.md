# Swing Advisor MVP

AI-Powered Swing Trading Intelligence Platform built with Next.js, TypeScript, and Prisma.

## 🎯 Overview

Swing Advisor helps traders find the best swing trading setups through:
- **Market Scanner**: Scan markets for optimal setups based on technical patterns
- **Deep Analysis**: Get comprehensive, evidence-backed reports for any ticker
- **AI Explanations**: Facts-only AI insights powered by deterministic calculations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - Other required variables

3. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   ```

4. **Create your first user**
   
   **Option A: Quick setup with default credentials**
   ```bash
   npm run create-user:quick
   ```
   This creates an admin user with:
   - Email: `galzaless@gmail.com`
   - Password: `password`
   
   **Option B: Interactive setup with custom credentials**
   ```bash
   npm run create-user
   ```
   Follow the prompts to create a user with your own email and password.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - You'll be redirected to the login page
   - Use the credentials from step 4

## 🔐 Authentication

The app uses NextAuth.js with secure credential-based authentication:
- **Password Security**: Bcrypt hashing with salt rounds of 12
- **Session Management**: JWT-based sessions with 30-day expiry
- **Protected Routes**: Middleware-based route protection
- **No Registration**: Users are created via scripts for controlled access

### Security Features

- ✅ Secure password hashing with bcrypt
- ✅ JWT-based session management
- ✅ HTTP-only cookies
- ✅ CSRF protection via NextAuth
- ✅ Protected API routes
- ✅ Environment variable security
- ✅ Database connection pooling

## 📁 Project Structure

```
swing-advisor-app/
├── app/                      # Next.js 13+ App Router
│   ├── api/                  # API routes
│   │   ├── auth/            # NextAuth authentication
│   │   ├── scan/            # Market scanner endpoints
│   │   └── analyze/         # Deep analysis endpoints
│   ├── login/               # Login page
│   ├── dashboard-client.tsx # Dashboard UI component
│   └── page.tsx             # Home page (protected)
├── lib/                      # Shared utilities
│   ├── auth.ts              # NextAuth configuration
│   ├── cohorts/             # Cohort analysis logic
│   ├── indicators/          # Technical indicators
│   ├── patterns/            # Pattern detection
│   ├── scoring/             # Setup scoring
│   └── risk/                # Risk management
├── prisma/                   # Database schema and migrations
│   └── schema.prisma        # Prisma schema
├── scripts/                  # Utility scripts
│   ├── create-user.ts       # Interactive user creation
│   └── create-user-simple.ts # Quick default user setup
├── types/                    # TypeScript type definitions
│   └── next-auth.d.ts       # NextAuth type extensions
└── docs/                     # Documentation
    └── PRODUCT_OVERVIEW.md  # Product vision and roadmap
```

## 🗄️ Database Schema

### Core Models

- **User**: Authentication and user profile
- **Account**: NextAuth adapter for OAuth (future)
- **Session**: User sessions
- **ScanPreset**: Saved scanner configurations
- **ScanRun**: Scanner execution history

## 🎨 Design System

### Colors
- **Primary**: Deep navy (#0f172a, #1e3a8a)
- **Accent**: Teal (#14b8a6, #06b6d4)
- **Background**: Gradient from slate-900 to blue-900
- **Glass Morphism**: Backdrop blur with transparency

### Components
- Card-based layout for trade setups
- Clean data visualization
- Subtle gradients and animations
- Professional dashboard interface

## 📝 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run linter

# Database
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open Prisma Studio GUI

# User Management
npm run create-user        # Interactive user creation
npm run create-user:quick  # Create default admin user
```

## 🛣️ Roadmap

### v1.0 (Current)
- ✅ Secure authentication system
- ✅ Modern dashboard UI
- ✅ Database schema and migrations
- 🚧 Market scanner implementation
- 🚧 Deep analysis reports
- 🚧 Technical indicators library

### v1.1
- Paper trading functionality
- Favorites and watchlists
- Simple price alerts
- Saved presets

### v1.2
- Sector/industry filters
- Broader universe coverage
- Advanced filtering

### v2.0
- Background workers for heavy processing
- Interactive charts
- Advanced risk analytics
- Real-time data streaming

## 🔒 Environment Variables

Required environment variables (see `.env.example`):

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth JWT signing | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |

## 🤝 Contributing

This is an MVP project. Key principles:
- **Transparency over hype**: Show the rules that fired
- **Facts-only AI**: AI explains deterministic calculations
- **Security first**: Modern authentication and data protection
- **User experience**: Clean, professional interface

## 📄 License

Private project - All rights reserved

## 🆘 Support

For issues or questions, refer to the documentation in the `/docs` folder.

---

Built with ❤️ for swing traders who value transparency and data-driven decisions.
