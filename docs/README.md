# CamperAnker24 - Wohnmobil-Ankaufsplattform

[![CI/CD Pipeline](https://github.com/your-username/camperanker24/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/your-username/camperanker24/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-80%2B-green)](https://codecov.io)

## 🚀 Project Description

CamperAnker24 is Germany's most modern motorhome acquisition platform built with enterprise-grade architecture and best practices. We offer three convenient ways to sell your motorhome:

- **Instant Price Purchase** - Direct sale with immediate pricing
- **Online Auctions** - Competitive bidding with real-time updates
- **Station Handover** - Physical pickup at purchase stations

## 🛠 Technology Stack

### Frontend
- **React 18** with TypeScript (strict mode)
- **Vite** for blazing-fast development and builds
- **Tailwind CSS** + **shadcn/ui** for consistent design system
- **TanStack React Query** for server state management
- **React Hook Form** + **Zod** for type-safe form validation

### Backend & Database
- **Supabase** (PostgreSQL) with Row Level Security
- **Supabase Edge Functions** (Deno) for serverless logic
- **Real-time subscriptions** for live auction updates
- **Automated cron jobs** for auction management

### Quality & Performance
- **Comprehensive testing** with Vitest + Playwright
- **Image optimization** with client-side compression
- **Service Worker** for offline support and caching
- **Performance monitoring** with Core Web Vitals tracking
- **Error boundaries** with centralized logging

### Security & DevOps
- **Rate limiting** on all critical endpoints
- **Content Security Policy** and security headers
- **Docker containerization** for consistent deployments
- **CI/CD pipeline** with automated testing and security scanning

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ ([install with nvm](https://github.com/nvm-sh/nvm))
- npm or yarn package manager

### Development Setup

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd camperanker24

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp env.example .env.local

# 4. Configure environment variables
# Edit .env.local with your Supabase credentials

# 5. Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Required Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional Analytics & Monitoring
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_SENTRY_DSN=https://your-sentry-dsn

# Development Features
VITE_ENABLE_DEVELOPMENT_FEATURES=true
```

## 🧪 Testing

### Unit & Integration Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### End-to-End Tests
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests
npm run test:all
```

## 🏗 Architecture

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui base components
│   ├── wizard/         # Multi-step form components
│   └── ...
├── contexts/           # React contexts (Auth, Settings)
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── analytics.ts    # Performance monitoring
│   ├── errorLogger.ts  # Error tracking
│   ├── imageOptimization.ts # Image processing
│   ├── security.ts     # Security utilities
│   └── validation.ts   # Zod schemas
├── pages/              # Route components
└── integrations/       # External service integrations

supabase/
├── functions/          # Edge Functions (Deno)
├── migrations/         # Database migrations
└── config.toml         # Supabase configuration

tests/
├── e2e/               # Playwright E2E tests
└── __mocks__/         # Test mocks
```

### Key Features

#### 🔐 **Security**
- JWT-based authentication with Supabase Auth
- Row Level Security (RLS) on all database tables
- Rate limiting on API endpoints
- Content Security Policy (CSP)
- File upload validation and virus scanning
- CSRF protection for sensitive operations

#### ⚡ **Performance**
- Image optimization with client-side compression
- Service Worker for offline support
- React Query with optimized caching strategies
- Database indexes for common query patterns
- Lazy loading and code splitting
- CDN-ready static asset optimization

#### 🧪 **Testing**
- 80%+ test coverage requirement
- Unit tests with Vitest + React Testing Library
- E2E tests with Playwright
- Visual regression testing
- Performance testing with Lighthouse CI

#### 📊 **Monitoring**
- Real-time error tracking with structured logging
- Performance metrics (Core Web Vitals)
- User behavior analytics
- Database query performance monitoring
- Automated health checks

## 🚢 Deployment

### Docker Deployment (Recommended)

```bash
# Build production image
docker build --target production \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
  -t camperanker24 .

# Run container
docker run -d \
  --name camperanker24 \
  --restart unless-stopped \
  -p 80:80 \
  camperanker24
```

### Coolify/Dokploy Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for Coolify and Dokploy platforms.

### Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Run migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking

# Testing
npm run test            # Run unit tests
npm run test:e2e        # Run E2E tests
npm run test:all        # Run all tests

# Database
supabase start          # Start local Supabase
supabase db push        # Apply migrations
supabase functions serve # Serve Edge Functions locally
```

## 🏆 Best Practices Implemented

### Code Quality
- ✅ Strict TypeScript configuration
- ✅ Comprehensive ESLint rules
- ✅ Automated code formatting
- ✅ Pre-commit hooks for quality checks

### Security
- ✅ Environment-based configuration
- ✅ Rate limiting on all endpoints
- ✅ Input validation and sanitization
- ✅ Security headers and CSP
- ✅ File upload restrictions

### Performance
- ✅ Image optimization pipeline
- ✅ Multi-layer caching strategy
- ✅ Database query optimization
- ✅ Bundle size optimization
- ✅ Core Web Vitals monitoring

### Testing
- ✅ Unit test coverage >80%
- ✅ Integration tests for critical flows
- ✅ E2E tests for user journeys
- ✅ Performance testing with Lighthouse
- ✅ Security testing in CI/CD

### DevOps
- ✅ Docker containerization
- ✅ Multi-environment support
- ✅ Automated CI/CD pipeline
- ✅ Health checks and monitoring
- ✅ Rollback procedures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our coding standards
4. Run tests (`npm run test:all`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- All code must pass TypeScript strict mode
- Minimum 80% test coverage for new features
- Follow conventional commit messages
- Update documentation for new features

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guides
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Security**: Report security issues to security@camperanker24.de

---

**Built with ❤️ for the German motorhome community**
