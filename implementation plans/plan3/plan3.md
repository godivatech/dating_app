# Final Implementation Plan — Phase 3: Profile & Onboarding Foundation

Build a clean, domain-separated, and resumable **Profile & Onboarding Foundation** for the dating app across backend (NestJS + Prisma + PostgreSQL) and mobile (Expo SDK 57 + React Native + Zustand + React Query).

---

## Architectural Principles & User Corrections

> [!IMPORTANT]
> **Key Architecture Decisions & Final Corrections Applied**:
> 1. **No Persisted `completionScore` (Data is Single Source of Truth)**:
>    - `completionScore` is **NOT** stored in the database.
>    - `ProfileCompletionService` calculates `completionScore` (0-100%), `status` (`NOT_STARTED` | `IN_PROGRESS` | `READY`), `missingFields`, and `isReady` on-the-fly from the underlying profile data.
> 2. **Fail-Closed Default Visibility (`HIDDEN`)**:
>    - Default `visibility` is **`HIDDEN`**.
>    - New profiles start as `IN_PROGRESS` + `HIDDEN` → `READY` + `HIDDEN` upon completion.
>    - Profile only becomes `VISIBLE` when the user explicitly toggles it on.
>    - Future discovery engine will strictly require `READY` + `VISIBLE`.
> 3. **Explicit Leap-Day (February 29) Birthday Convention**:
>    - In non-leap reference years, a person born on February 29 legally/calendar-wise reaches their new age on **March 1** (on February 28, they have not yet completed the full 365/366 days).
>    - In leap reference years, their birthday is February 29.
>    - Comprehensive unit tests cover: Feb 29 DOB against Feb 28 ref date (age not incremented), Mar 1 ref date (age incremented), and Feb 29 leap-year ref date.
> 4. **Explicit Preferred Gender Representation (`PreferredGenderMode`)**:
>    - `PreferredGenderMode`: `ANY` | `SELECTED`.
>    - When `SELECTED`, `preferredGenders` contains the specific `Gender` enum values (`MAN`, `WOMAN`, `NON_BINARY`, `OTHER`).
>    - When `ANY`, `preferredGenders` can be empty or ignored, keeping identity (`Gender`) cleanly decoupled from preference modes.
> 5. **Normalized Location & Reference Interests**:
>    - Simple `locationCity`, `locationRegion` (State), and `locationCountry` without GPS or tracking.
>    - `InterestStatus` enum (`ACTIVE`, `INACTIVE`) with `@@unique([profileId, interestId])`.

---

## Proposed Database Schema (`backend/prisma/schema.prisma`)

```prisma
enum Gender {
  MAN
  WOMAN
  NON_BINARY
  OTHER
}

enum PreferredGenderMode {
  ANY
  SELECTED
}

enum RelationshipIntent {
  LONG_TERM
  MARRIAGE
  SERIOUS_DATING
  OPEN_TO_EXPLORE
  CASUAL
}

enum ProfileVisibility {
  VISIBLE
  HIDDEN
}

enum ProfileStatus {
  NOT_STARTED
  IN_PROGRESS
  READY
}

enum InterestStatus {
  ACTIVE
  INACTIVE
}

model DatingProfile {
  id              String             @id @default(uuid())
  userId          String             @unique
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName     String
  dateOfBirth     DateTime           // Normalized UTC calendar date (00:00:00.000Z)
  gender          Gender
  bio             String?            // Plain text, max 500 chars
  locationCity    String?
  locationRegion  String?
  locationCountry String             @default("IN")
  visibility      ProfileVisibility  @default(HIDDEN) // Fail-closed default
  status          ProfileStatus      @default(NOT_STARTED)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  preferences     DatingPreferences?
  interests       ProfileInterest[]

  @@index([userId])
  @@index([status, visibility])
}

model DatingPreferences {
  id                  String              @id @default(uuid())
  profileId           String              @unique
  profile             DatingProfile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  preferredGenderMode PreferredGenderMode @default(SELECTED)
  preferredGenders    Gender[]            // Populated when mode is SELECTED
  minAge              Int                 @default(18)
  maxAge              Int                 @default(35)
  relationshipIntent  RelationshipIntent
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@index([profileId])
}

model Interest {
  id        String            @id // e.g. "outdoors-hiking", "music-indie"
  name      String            // e.g. "Hiking", "Indie Music"
  category  String            // e.g. "Outdoors", "Music", "Food & Drink", "Arts", "Fitness"
  status    InterestStatus    @default(ACTIVE)
  createdAt DateTime          @default(now())

  profiles  ProfileInterest[]
}

model ProfileInterest {
  id         String        @id @default(uuid())
  profileId  String
  profile    DatingProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  interestId String
  interest   Interest      @relation(fields: [interestId], references: [id], onDelete: Restrict)
  createdAt  DateTime      @default(now())

  @@unique([profileId, interestId])
  @@index([profileId])
  @@index([interestId])
}
```

---

## Domain Logic & Utilities

### 1. Age Calculation & Leap-Day Convention (`backend/src/profile/utils/age.util.ts`)

```typescript
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function calculateAge(dob: Date, referenceDate: Date = new Date()): number {
  const birthYear = dob.getUTCFullYear();
  const birthMonth = dob.getUTCMonth(); // 0-indexed (1 = Feb)
  const birthDay = dob.getUTCDate();

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  let effectiveBirthMonth = birthMonth;
  let effectiveBirthDay = birthDay;

  // Feb 29 leap-day convention: In non-leap reference years, birthday occurs on March 1
  if (birthMonth === 1 && birthDay === 29 && !isLeapYear(refYear)) {
    effectiveBirthMonth = 2; // March
    effectiveBirthDay = 1;   // 1st
  }

  let age = refYear - birthYear;
  if (refMonth < effectiveBirthMonth || (refMonth === effectiveBirthMonth && refDay < effectiveBirthDay)) {
    age--;
  }
  return age;
}
```

### 2. Profile Completion Engine (`backend/src/profile/services/profile-completion.service.ts`)
* Evaluates real-time state:
  - **Identity (25%)**: `displayName` valid, `dateOfBirth` valid & 18+, `gender` set.
  - **Preferences (25%)**: `(preferredGenderMode === 'ANY' || preferredGenders.length >= 1)`, `18 <= minAge <= maxAge <= 99`, `relationshipIntent` set.
  - **Interests (25%)**: `interests.length >= 3` active interests.
  - **About & Location (25%)**: `bio` (10-500 chars), `locationCity` present.
* Returns `{ completionScore: number; status: ProfileStatus; missingFields: string[]; isReady: boolean }`.
* Updates `DatingProfile.status` (`IN_PROGRESS` or `READY`) accordingly.

### 3. REST API Design (`backend/src/profile/`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/profile/me` | Fetch authenticated user's profile, preferences, and interests with derived `age` and `completionScore` |
| `PUT` | `/api/v1/profile/identity` | Upsert basic identity (`displayName`, `dateOfBirth`, `gender`) |
| `PUT` | `/api/v1/profile/preferences` | Upsert dating preferences (`preferredGenderMode`, `preferredGenders`, `minAge`, `maxAge`, `relationshipIntent`) |
| `PUT` | `/api/v1/profile/interests` | Set selected interest IDs (validates active items, prevents duplicates) |
| `PUT` | `/api/v1/profile/about-location`| Upsert `bio`, `locationCity`, `locationRegion` |
| `GET` | `/api/v1/profile/completion` | Fetch dynamic completion breakdown & missing fields |
| `PATCH` | `/api/v1/profile/visibility` | Update visibility (`VISIBLE` / `HIDDEN`) — requires `READY` to enable `VISIBLE` |
| `GET` | `/api/v1/interests` | Get reference catalog of active interests grouped by category |

---

## Mobile Architecture & Onboarding Flow (`mobile/`)

1. **Profile Store (`mobile/src/stores/profile-store.ts`)**:
   - Manages state: `profile`, `preferences`, `interests`, `completion`, `isLoading`, `error`.
   - Dynamic resume mechanism based on `missingFields`.
2. **Onboarding UI Flow (`mobile/app/(onboarding)/`)**:
   - `_layout.tsx`: Onboarding stack navigator with animated progress indicator.
   - `identity.tsx`: Display name, DOB input with live 18+ verification, and gender picker.
   - `preferences.tsx`: Preferred gender mode (`ANY` vs `SELECTED`), age range slider/inputs, relationship intent picker.
   - `interests.tsx`: Categorized interest chip selector (requiring min 3 selections).
   - `about-location.tsx`: Bio input with 500-char counter, city, and state inputs.
   - `ready.tsx`: Profile summary card, celebration, and explicit "Make Profile Discoverable" switch.
3. **Root Routing Guard (`mobile/app/index.tsx`)**:
   - Routes user to incomplete onboarding step if status is not `READY`.
   - Once `READY`, renders Dashboard showing profile card, `VISIBLE`/`HIDDEN` status toggle, edit actions, and logout.

---

## Verification Plan

### Backend Automated Tests
- **Unit Tests**:
  - `age.util.spec.ts`: Exact 18th birthday today, birthday tomorrow (17), Feb 29 DOB on non-leap Feb 28 (17), Feb 29 DOB on non-leap Mar 1 (18), Feb 29 DOB on leap year Feb 29 (18), future dates, invalid dates.
  - `profile.service.spec.ts`: Identity upsert, preferences upsert (`ANY` vs `SELECTED`), interest validation (active vs inactive, duplicates), dynamic completion derivation, visibility toggle rules.
  - `interests.service.spec.ts`: Reference interest catalog querying and category grouping.
- **E2E Tests (`backend/test/profile.e2e-spec.ts`)**:
  - Complete lifecycle: Login -> `NOT_STARTED` + `HIDDEN` -> Step-by-step updates -> `READY` + `HIDDEN` -> Explicit toggle to `READY` + `VISIBLE`.
  - Fail-closed visibility validation.
  - Rejection of under-18 DOB and invalid preferences.

### Mobile Verification
- `npm run type-check`: 0 TypeScript errors.
