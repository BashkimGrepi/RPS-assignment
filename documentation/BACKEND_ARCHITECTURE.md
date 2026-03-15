    qwa# RPS League Backend - System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Sync Subsystem](#sync-subsystem)
4. [HTTP API Subsystem](#http-api-subsystem)
5. [Shared Components](#shared-components)
6. [Database Schema](#database-schema)
7. [Environment Configuration](#environment-configuration)
8. [Getting Started](#getting-started)

---

## Overview

The RPS League Backend is a Node.js/TypeScript application that manages a Rock-Paper-Scissors game league. It follows a **database-first architecture** with two independent subsystems:

1. **Sync Subsystem** - Ingests match data from a legacy API into PostgreSQL
2. **HTTP API Subsystem** - Serves frontend requests with data from PostgreSQL

Both subsystems operate independently but share the same database, ensuring data consistency and scalability.

**Tech Stack:**

- **Runtime:** Node.js v22 with TypeScript 5.9
- **Database:** PostgreSQL with Prisma ORM 7.5
- **Framework:** Express 5.2
- **Real-time:** Server-Sent Events (SSE) via EventSource

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RPS League Backend                    │
│                                                          │
│  ┌──────────────────────┐    ┌─────────────────────┐   │
│  │   Sync Subsystem     │    │  HTTP API Subsystem │   │
│  │  (Data Ingestion)    │    │  (Frontend Service) │   │
│  │                      │    │                     │   │
│  │  - Historical        │    │  - Match Endpoints  │   │
│  │    Backfill          │    │  - Player Endpoints │   │
│  │  - Live SSE Stream   │    │  - Leaderboard API  │   │
│  │  - Reconciliation    │    │  - Health Check     │   │
│  └──────┬───────────────┘    └──────┬──────────────┘   │
│         │                           │                   │
│         └───────────┬───────────────┘                   │
│                     ▼                                   │
│           ┌──────────────────┐                          │
│           │   PostgreSQL DB  │                          │
│           │  (Single Source  │                          │
│           │   of Truth)      │                          │
│           └──────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Key Principles:**

- Database-first: All data flows through PostgreSQL
- Asynchronous: Sync subsystem runs in background
- Idempotent: Duplicate prevention via unique constraints
- Resumable: Checkpointed pagination for crash recovery

---

## Sync Subsystem

The Sync Subsystem is responsible for continuously importing match data from the legacy API into the local PostgreSQL database. It uses three complementary mechanisms to ensure comprehensive data coverage.

### Directory Structure

```
src/sync/
├── backfillOrchestrator.ts    # Manages historical data import
├── historyBackfill.ts         # Fetches paginated historical matches
├── liveStream.ts              # Real-time SSE connection
├── reconciliation.ts          # Gap-filling mechanism
├── reconciliationScheduler.ts # Periodic reconciliation timer
└── syncRunner.ts              # Central orchestrator
```

### Files and Responsibilities

#### 1. `syncRunner.ts` - Central Orchestrator

**Purpose:** Unified control plane for all sync mechanisms.

**Key Functions:**

- `startSyncSubsystem()` - Starts all three sync processes
- `stopSyncSubsystem()` - Graceful shutdown
- `getSyncSubsystemStatus()` - Comprehensive status reporting
- `setupGracefulShutdown()` - SIGINT/SIGTERM handlers

**Flow:**

```typescript
startSyncSubsystem()
  ├─> startBackfillOrchestrator()    // Historical data
  ├─> connectToLiveStream()           // Real-time stream
  └─> startReconciliationScheduler() // Gap filling
```

**Entry Point:** Called from `src/index.ts` on server startup (non-blocking).

---

#### 2. `historyBackfill.ts` - Historical Data Import

**Purpose:** Progressive import of historical match data using cursor-based pagination.

**Key Functions:**

- `runBackfillCycle()` - Fetches one page, transforms, upserts matches
- `runBackfillBatch(maxCycles)` - Runs multiple cycles with delays
- `ensureSyncState()` - Initializes/retrieves sync state

**Algorithm:**

```
1. Get current cursor from SyncState table
2. Fetch next page from /history endpoint
3. Transform each match to database format
4. Upsert matches (deduplication by gameId)
5. Save new cursor to SyncState
6. Repeat until no more pages
```

**Rate Limiting:** 100ms delay between pages

**Resumability:** If server crashes, resumes from saved cursor

**Data Source Tag:** `SyncSource.HISTORY_BACKFILL`

---

#### 3. `backfillOrchestrator.ts` - Backfill Manager

**Purpose:** Background loop that continuously runs backfill cycles until complete.

**Key Functions:**

- `startBackfillOrchestrator()` - Starts background timer
- `stopBackfillOrchestrator()` - Stops the timer
- `runBackfillIfNeeded()` - Checks state and runs cycle if needed
- `getBackfillStatus()` - Returns current progress

**Behavior:**

- Checks every 5 seconds if backfill is needed
- Skips if already running or completed
- Detects stuck processes (>5 min timeout) and resets
- Auto-stops when backfill completes

**State Tracking:**

```typescript
{
  completed: boolean,      // All historical data imported
  isRunning: boolean,      // Currently fetching data
  cursor: string | null,   // Next page to fetch
  lastRun: Date | null     // Last execution time
}
```

---

#### 4. `liveStream.ts` - Real-Time SSE Connection

**Purpose:** Maintains persistent Server-Sent Events connection to receive live match updates.

**Key Functions:**
- Returns connection state

**Connection Details:**

- **URL:** `https://assignments.reaktor.com/live`
- **Auth:** Bearer token in Authorization header
- **Event Types:** `message` and `game` events

**Auto-Reconnection:**

- Exponential backoff: 1s → 2s → 4s → 8s → 16s → max 30s
- Resets delay on successful connection
- Updates `SyncState.sseConnected` status

**Data Source Tag:** `SyncSource.LIVE_SSE`

**Error Handling:** Logs errors, closes bad connections, schedules reconnect

---

#### 5. `reconciliation.ts` - Gap Filling

**Purpose:** Periodically fetches newest matches to catch any gaps from missed SSE events.

**Key Functions:**

- `runReconciliationCycle()` - Fetches first page of history and upserts

**Strategy:**

- Only fetches the **first page** (newest ~100 matches)
- Runs every 10 minutes
- Deduplication handles overlaps automatically

**Why Needed:**

- SSE connections can drop temporarily
- Network issues might cause missed events
- Ensures no data loss during connection interruptions

**Data Source Tag:** `SyncSource.HISTORY_RECONCILIATION`

**Performance:** Single page fetch (fast, minimal API load)

---

#### 6. `reconciliationScheduler.ts` - Reconciliation Timer

**Purpose:** Manages the periodic execution of reconciliation.

**Key Functions:**

- `startReconciliationScheduler()` - Starts 10-minute interval
- `stopReconciliationScheduler()` - Stops the timer
- `getReconciliationStatus()` - Returns scheduler state

**Scheduling:**

- Runs immediately on startup
- Then every 10 minutes via `setInterval`
- Overlap prevention (skips if previous cycle still running)

**State Tracking:**

```typescript
{
  isSchedulerActive: boolean,    // Timer is running
  isCurrentlyRunning: boolean    // Currently fetching data
}
```

---

### Sync Subsystem Data Flow

```
Legacy API
    │
    ├─> /history (paginated)
    │   └─> historyBackfill.ts
    │       └─> backfillOrchestrator.ts
    │           └─> [HISTORY_BACKFILL] → Database
    │
    ├─> /live (SSE stream)
    │   └─> liveStream.ts
    │       └─> [LIVE_SSE] → Database
    │
    └─> /history (first page)
        └─> reconciliation.ts
            └─> reconciliationScheduler.ts
                └─> [HISTORY_RECONCILIATION] → Database
```

---

## HTTP API Subsystem

The HTTP API Subsystem serves frontend requests by querying the PostgreSQL database. All data is pre-synced by the Sync Subsystem.

### Directory Structure

```
src/
├── app.ts                          # Express app configuration
├── index.ts                        # Server entry point
├── routes/
│   ├── matches.routes.ts           # Match endpoints routing
│   ├── players.routes.ts           # Player endpoints routing
│   └── leaderboard.routes.ts       # Leaderboard endpoints routing
├── controllers/
│   ├── matches.controller.ts       # Match request handlers
│   ├── players.controller.ts       # Player request handlers
│   ├── leaderboard.controller.ts   # Leaderboard request handlers
│   └── health.controller.ts        # System health endpoint
└── services/
    ├── matches.service.ts          # Match business logic & queries
    ├── leaderboard.service.ts      # Leaderboard aggregation logic
    └── legacy-api.service.ts       # Legacy API client (used by sync)
```

### Files and Responsibilities

#### Routes (`src/routes/`)

##### 1. `matches.routes.ts` - Match Endpoints

**Routes:**

```typescript
GET /api/matches/latest?limit=N      // Latest N matches (1-1000, default 100)
GET /api/matches?date=YYYY-MM-DD     // Matches by date or latest
GET /api/matches/day?date=YYYY-MM-DD // Legacy route
GET /api/matches/player/:playerName  // Legacy route
```

**Purpose:** Route matching and delegation to controllers.

---

##### 2. `players.routes.ts` - Player Endpoints

**Routes:**

```typescript
GET /api/players                  // All players with match counts
GET /api/players/:name/matches    // Player's matches + stats
GET /api/players/:name/stats      // Player statistics only
```

**Purpose:** Player data access routing.

---

##### 3. `leaderboard.routes.ts` - Leaderboard Endpoints

**Routes:**

```typescript
GET /api/leaderboard                       // Today's leaderboard
GET /api/leaderboard/today                 // Explicit today
GET /api/leaderboard?from=DATE&to=DATE     // Date range
GET /api/leaderboard/history?from=X&to=Y   // Legacy route
```

**Purpose:** Leaderboard routing with date range support.

---

#### Controllers (`src/controllers/`)

Controllers handle HTTP request/response logic, validation, and error handling.

##### 1. `matches.controller.ts` - Match Request Handlers

**Functions:**

- `getLatestMatch(req, res)` - Latest N matches with limit validation
- `getMatchesByDayController(req, res)` - Matches for specific date
- `getAllMatchesController(req, res)` - Main endpoint with optional date filter
- `getMatchesByPlayerController(req, res)` - Player's match history

**Validation:**

- Date format: YYYY-MM-DD (regex check)
- Limit: 1-1000 integer
- Player name: non-empty string

**Error Responses:**

- 400: Invalid parameters
- 500: Server errors

---

##### 2. `players.controller.ts` - Player Request Handlers

**Functions:**

- `getAllPlayersController(req, res)` - List all players
- `getPlayerMatchesController(req, res)` - Player matches + stats
- `getPlayerStatsController(req, res)` - Player statistics only

**Response Format:**

```typescript
{
  data: [...],           // Matches array
  count: number,         // Total matches
  playerStats: {         // Included in matches endpoint
    player: string,
    totalMatches: number,
    wins: number,
    losses: number,
    ties: number
  }
}
```

---

##### 3. `leaderboard.controller.ts` - Leaderboard Handlers

**Functions:**

- `getTodayLeaderboardController(req, res)` - Today's standings
- `getHistoricalLeaderboard(req, res)` - Date range leaderboard
- `getLeaderboardController(req, res)` - Smart router (today or range)

**Validation:**

- Both `from` and `to` required for date range
- Date format validation
- Chronological order check (from <= to)

---

##### 4. `health.controller.ts` - System Health

**Function:**

- `getHealthStatus(req, res)` - Comprehensive system status

**Response:**

```typescript
{
  status: "healthy" | "degraded",
  timestamp: string,
  database: {
    connected: boolean,
    error: string | null,
    totalMatches: number
  },
  syncSubsystem: {
    running: boolean,
    backfill: { completed, isRunning, cursor, lastRun },
    sseStream: { connected, readyState },
    reconciliation: { schedulerActive, currentlyRunning },
    latestKnownMatch: { time, gameId }
  }
}
```

**Status Codes:**

- 200: Healthy (DB connected, sync running)
- 503: Degraded (DB down or sync not running)

---

#### Services (`src/services/`)

Services contain business logic and database queries.

##### 1. `matches.service.ts` - Match Business Logic

**Key Functions:**

| Function                   | Purpose                       | Returns                                    |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `getLatestMatches(limit)`  | Fetch N most recent matches   | `NormalizedGame[]`                         |
| `getLatestHistoryMatch()`  | Single most recent match      | `NormalizedGame \| null`                   |
| `getMatchesByDay(date)`    | All matches for specific date | `NormalizedGame[]`                         |
| `getMatchesByPlayer(name)` | All matches for player        | `NormalizedGame[]`                         |
| `getPlayerStats(name)`     | Player statistics             | `{ totalMatches, wins, losses, ties }`     |
| `getAllPlayers()`          | All players with match counts | `Array<{ name, totalMatches, createdAt }>` |

**Query Strategy:**

- Uses Prisma ORM with joins (`include`)
- Indexes on `playedAt`, `playedDate`, `playerAId`, `playerBId`
- Converts DB format to API format via `matchToNormalizedGame()`

**Performance:**

- All queries use indexed fields
- Response time target: <100ms

---

##### 2. `leaderboard.service.ts` - Leaderboard Aggregation

**Key Functions:**

| Function                              | Purpose            | Query Type                   |
| ------------------------------------- | ------------------ | ---------------------------- |
| `getTodayLeaderboard()`               | Today's win counts | Aggregation for current date |
| `getLeaderboardByDateRange(from, to)` | Custom date range  | Aggregation with date filter |

**Algorithm:**

```typescript
buildLeaderboardFromDatabase(startDate, endDate):
  1. Get all unique players
  2. For each player, count wins in date range using Promise.all
  3. Sort by wins (descending), then by name (ascending)
  4. Return { playerName, wins }[]
```

**Optimization:**

- Parallel queries via `Promise.all`
- Direct SQL counts via Prisma
- Indexed date lookups

---

##### 3. `legacy-api.service.ts` - Legacy API Client

**Purpose:** HTTP client for legacy API communication (used by Sync Subsystem).

**Key Functions:**

- `fetchHistoryPage(cursor?)` - Fetch paginated history

**Configuration:**

- Base URL: `https://assignments.reaktor.com`
- Auth: Bearer token from environment
- Timeout: Handled by fetch defaults

**Response Format:**

```typescript
{
  data: LegacyGame[],
  cursor?: string | null
}
```

---

## Shared Components

### Directory Structure

```
src/
├── lib/
│   └── prisma.ts              # Prisma client singleton
├── transformers/
│   └── matchTransformer.ts    # Legacy → DB format
├── db/
│   └── upsertHelpers.ts       # Database operations
├── utils/
│   ├── rpsLogic.ts            # Game logic utilities
│   ├── fetchWithToken.ts      # Authenticated HTTP client
│   └── paginations.ts         # Pagination helpers
├── types/
│   ├── rps-dto.ts             # API data types
│   ├── leaderboard.ts         # Leaderboard types
│   └── transformedMatch.ts    # Transformed match type
└── config/
    ├── constants.ts           # Application constants
    └── env.ts                 # Environment configuration
```

### Key Shared Files

#### 1. `lib/prisma.ts` - Database Client

**Purpose:** Singleton Prisma client with PostgreSQL adapter.

```typescript
const connectionString = process.env.DATABASE_URL || "fallback";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
```

**Usage:** Imported everywhere database access is needed.

---

#### 2. `transformers/matchTransformer.ts` - Data Transformation

**Purpose:** Convert legacy API format to database format.

**Key Function:**

```typescript
transformLegacyMatch(legacyGame, source: SyncSource): TransformedMatch
```

**Transformation:**

- Converts string moves to `Move` enum (ROCK/PAPER/SCISSORS)
- Determines winner using RPS logic
- Calculates `MatchResultType` (PLAYER_A_WIN/PLAYER_B_WIN/DRAW)
- Normalizes dates (playedAt + playedDate)
- Tags with source (HISTORY_BACKFILL/LIVE_SSE/HISTORY_RECONCILIATION)

---

#### 3. `db/upsertHelpers.ts` - Database Operations

**Purpose:** Reusable database operations with deduplication.

**Key Functions:**

| Function                   | Purpose               | Deduplication              |
| -------------------------- | --------------------- | -------------------------- |
| `upsertPlayer(name)`       | Find or create player | Unique `name` constraint   |
| `upsertMatch(transformed)` | Insert/update match   | Unique `gameId` constraint |
| `upsertMatches(array)`     | Batch upsert          | Sequential processing      |

**Pattern:**

```typescript
prisma.model.upsert({
  where: { uniqueField },
  update: {
    /* partial updates */
  },
  create: {
    /* full creation */
  },
});
```

**Idempotency:** Multiple calls with same data have no effect (safe for retries).

---

#### 4. `utils/rpsLogic.ts` - Game Logic

**Purpose:** Rock-Paper-Scissors game rules and calculations.

**Key Functions:**

| Function                            | Purpose            | Returns                             |
| ----------------------------------- | ------------------ | ----------------------------------- |
| `determineWinner(choiceA, choiceB)` | Calculate outcome  | `"PLAYER_A" \| "PLAYER_B" \| "TIE"` |
| `getResultType(outcome)`            | Convert to DB enum | `MatchResultType`                   |
| `stringToMove(str)`                 | Parse move string  | `Move` enum                         |

**Game Rules:**

- ROCK beats SCISSORS
- SCISSORS beats PAPER
- PAPER beats ROCK
- Same choices = TIE

---

## Database Schema

### Models

#### Player

```prisma
model Player {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  matchesAsA Match[] @relation("PlayerA")
  matchesAsB Match[] @relation("PlayerB")
  wins       Match[] @relation("WinnerPlayer")
  losses     Match[] @relation("LoserPlayer")

  @@index([name])
}
```

#### Match

```prisma
model Match {
  id             Int             @id @default(autoincrement())
  gameId         String          @unique
  playedAt       DateTime
  playedDate     DateTime
  playerAId      Int
  playerBId      Int
  playerAChoice  Move
  playerBChoice  Move
  resultType     MatchResultType
  winnerPlayerId Int?
  loserPlayerId  Int?
  ingestedFrom   SyncSource
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  playerA      Player  @relation("PlayerA", fields: [playerAId])
  playerB      Player  @relation("PlayerB", fields: [playerBId])
  winnerPlayer Player? @relation("WinnerPlayer", fields: [winnerPlayerId])
  loserPlayer  Player? @relation("LoserPlayer", fields: [loserPlayerId])

  @@index([playedAt])
  @@index([playedDate])
  @@index([playerAId])
  @@index([playerBId])
  @@index([winnerPlayerId])
  @@index([playedDate, winnerPlayerId])
}
```

#### SyncState

```prisma
model SyncState {
  id                   Int      @id @default(autoincrement())
  key                  String   @unique
  backfillCursor       String?
  backfillCompleted    Boolean  @default(false)
  lastBackfillRunAt    DateTime?
  lastReconcileRunAt   DateTime?
  lastSseEventAt       DateTime?
  latestKnownMatchTime DateTime?
  latestKnownGameId    String?
  sseConnected         Boolean  @default(false)
  isBackfillRunning    Boolean  @default(false)
  isReconcileRunning   Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

### Enums

```prisma
enum Move {
  ROCK
  PAPER
  SCISSORS
}

enum MatchResultType {
  PLAYER_A_WIN
  PLAYER_B_WIN
  DRAW
}

enum SyncSource {
  HISTORY_BACKFILL
  HISTORY_RECONCILIATION
  LIVE_SSE
}
```

---

## Environment Configuration

### Required Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/rps_league?schema=public"

# Server Configuration
PORT=3000

# Legacy API Configuration
BEARER_TOKEN="your_bearer_token_here"
LEGACY_API_BASE_URL="https://assignments.reaktor.com"
```

### Configuration Files

- `.env` - Active environment variables (gitignored)
- `.env.example` - Template for new developers
- `src/config/env.ts` - Environment variable validation

---

## Getting Started

### Prerequisites

- Node.js v22+
- PostgreSQL 12+
- npm or yarn

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd reaktor

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your database credentials and API token

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run dev
```

### Verify Installation

1. **Check server:** Navigate to `http://localhost:3000`
2. **Check health:** `GET http://localhost:3000/health`
3. **Check API:** `GET http://localhost:3000/api/matches/latest`

### Development Workflow

```bash
# Start with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Run production build
npm start
```

### Testing

```bash
# Phase verification tests
npx tsx src/tests/phase1-verify.ts  # Game logic & transformations
npx tsx src/tests/phase2-verify.ts  # Historical backfill
npx tsx src/tests/phase3-verify.ts  # Live SSE stream
npx tsx src/tests/phase4-verify.ts  # Reconciliation
npx tsx src/tests/phase5-verify.ts  # Integration & startup
npx tsx src/tests/phase6-verify.ts  # API endpoints (requires running server)
```

---

## API Reference Summary

### Matches

- `GET /api/matches/latest?limit=N` - Latest N matches
- `GET /api/matches?date=YYYY-MM-DD` - Matches by date or latest

### Players

- `GET /api/players` - All players with match counts
- `GET /api/players/:name/matches` - Player's matches + stats
- `GET /api/players/:name/stats` - Player statistics only

### Leaderboard

- `GET /api/leaderboard` - Today's leaderboard
- `GET /api/leaderboard?from=DATE&to=DATE` - Date range leaderboard

### System

- `GET /health` - System health and sync status

---

## Architecture Decisions

### Why Database-First?

- **Scalability:** Multiple frontend instances can query same DB
- **Reliability:** Data persists across server restarts
- **Performance:** PostgreSQL indexes faster than in-memory lookups at scale
- **Simplicity:** Single source of truth

### Why Three Sync Mechanisms?

1. **Historical Backfill:** Complete historical data import (one-time)
2. **Live SSE Stream:** Real-time updates (ongoing)
3. **Periodic Reconciliation:** Safety net for missed events (gap filling)

Together they ensure **zero data loss** and **eventual consistency**.

### Why Prisma ORM?

- Type-safe database queries
- Automatic migrations
- Built-in connection pooling
- PostgreSQL adapter for Node.js

---

## Troubleshooting

### Database Connection Issues

**Error:** `Can't reach database server`

**Solution:**

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Test connection: `npx prisma db push`

### Environment Variables Not Loading

**Error:** `undefined` environment variables

**Solution:**

1. Ensure `.env` exists in project root
2. Check file format (no extra quotes)
3. Restart development server

### SSE Connection Fails

**Error:** `Live SSE stream error`

**Solution:**

1. Verify `BEARER_TOKEN` is correct
2. Check network connectivity to legacy API
3. Review logs for specific error details

---

**Last Updated:** March 12, 2026  
**Version:** 1.0.0  
**Maintainer:** RPS League Team
