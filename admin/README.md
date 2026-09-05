# Spark Operations & Trust & Safety Portal (`admin/`)

A high-performance, single-page operations and trust & safety web application engineered with **React 18, TypeScript, and Vite**, adhering to vanilla CSS design tokens with rich dark-mode glassmorphism aesthetics.

---

## 🌟 Key Capabilities

1. **Executive Telemetry & KPIs**:
   - Real-time active member count, DAU/MAU stickiness, and mutual matches generated.
   - Monthly Recurring Revenue (MRR) tracker in ₹ INR (Spark Plus ₹299/mo, Spark Gold ₹499/mo, and Direct Note Packs ₹99 / ₹199 / ₹349).
2. **Member Directory & 360° Profile Dossier**:
   - Live search across member IDs, names, and E.164 phone numbers.
   - Deep inspection drawer revealing verified photos, lifestyle interests, match counts, and strike timelines.
3. **Progressive Discipline & Sanction Controls**:
   - Authoritative manual actions: **Formal Warning**, **24h Chat Mute**, **7d Discovery Shadowban**, **Permanent Account Ban**, and **Strike Resets**.
   - Immediate session revocation upon ban execution to neutralize threats in real time.
4. **Photo Verification & Moderation Queue**:
   - Masonry layout of user uploads awaiting moderation with 1-click **Approve** and **Reject** capabilities.
5. **Trust & Safety Abuse Resolution**:
   - Direct inspection of user-reported harassment cases with in-chat evidence snippets.
6. **Financial Ledger & Idempotency Audit**:
   - Live transaction tracking verifying platform (iOS/Android) and payment provider statuses.
7. **Dual Mode Architecture**:
   - Seamless toggle between **Live NestJS API Gateway** (`/admin/...`) and **High-Fidelity Offline Simulation** for zero-friction demonstrations.

---

## 🚀 Running Locally

```bash
cd admin
npm install
npm run dev
```
The application will launch on `http://localhost:3001` with an automated proxy to `http://localhost:3000` for backend API communication.

---

## 🏗️ Production Build & Zero-Cost Hosting

```bash
cd admin
npm run build
```

This compiles optimized, compressed static assets to `admin/dist/` (HTML, CSS, JS chunks) ready for instantaneous zero-cost deployment to:
- **Cloudflare Pages**: Connect repo, set build command `npm run build`, and root directory `admin`, output folder `dist`.
- **Vercel**: Framework preset `Vite`, root directory `admin`, output directory `dist`.
- **AWS S3 + CloudFront**: Sync `dist/` directly to your S3 bucket.

---

## 🛡️ Security & Authorization

- Guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.ADMIN, UserRole.MODERATOR)`.
- All administrative mutations are stamped into `ModerationAuditLog` in PostgreSQL Neon with admin IDs, timestamps, and justification reasons.
