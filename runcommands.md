# Application Run & Development Commands

## 1. Backend (NestJS + Prisma + Neon PostgreSQL + Redis)

### Initial Setup & Database
```bash
cd backend

# 1. Install dependencies
npm install

# 2. Push Prisma schema changes to Neon PostgreSQL
npx prisma db push

# 3. Generate Prisma Client
npx prisma generate
```

### Start Backend Development Server
```bash
cd backend
npm run start:dev
```
*Backend API will run at `http://localhost:3000` (or configured `PORT`).*

### Run Backend Automated Tests
```bash
cd backend

# Run all 38 unit test suites (223 tests)
npm test

# Run all 12 end-to-end (E2E) domain suites (89 tests)
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

### Build Backend for Production
```bash
cd backend
npm run build
```

---

## 2. Admin Operations & Trust & Safety Portal (`admin/`)

### Start Admin Development Server
```bash
cd admin

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
*Admin Dashboard will run at `http://localhost:3001` with an automated proxy to `http://localhost:3000` for backend API communication.*

### Build Admin Portal for Production
```bash
cd admin
npm run build
```
*Compiles static assets to `admin/dist/` ready for zero-cost deployment on Cloudflare Pages, Vercel, or AWS S3.*

---

## 3. Mobile Application (React Native / Expo 57)

### Start Expo Development Server
```bash
cd mobile

# 1. Install dependencies
npm install

# 2. Start Expo Metro bundler
npm start
# or: npx expo start -c (to clear cache) or npx expo start --tunnel
```

### Run on Specific Targets
```bash
cd mobile

# Run in Web Browser
npm run web

# Run on Android Emulator / Device
npm run android

# Run on iOS Simulator / Device
npm run ios
```

### TypeScript Validation
```bash
cd mobile
npm run type-check
```


# To build the apk using android studio locally
```bash
cd mobile
npx expo prebuild --platform android
```