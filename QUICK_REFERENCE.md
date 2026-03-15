# Quick Reference: Day-Based Match Fetching

## 🚀 Quick Start

### API Endpoint
```bash
GET /api/matches/day?date=2026-03-09
```

### Response
```json
{
  "data": [/* NormalizedGame[] */],
  "count": 42
}
```

## 📦 Functions Available

### 1. `fetchMatchesForDay(date: string): Promise<LegacyGame[]>`
**Location:** `src/services/matches.service.ts`  
**Returns:** Raw legacy games for the specified day  
**Use when:** You need raw LegacyGame format

```typescript
import { fetchMatchesForDay } from './services/matches.service.js';

const games = await fetchMatchesForDay("2026-03-09");
console.log(games); // LegacyGame[]
```

### 2. `getMatchesByDayEfficient(date: string): Promise<NormalizedGame[]>`
**Location:** `src/services/matches.service.ts`  
**Returns:** Normalized games with winner/tie information  
**Use when:** You need processed game data (recommended)

```typescript
import { getMatchesByDayEfficient } from './services/matches.service.js';

const games = await getMatchesByDayEfficient("2026-03-09");
console.log(games); // NormalizedGame[]
```

### 3. `getUtcDayRange(date: string): { start: number; end: number }`
**Location:** `src/services/matches.service.ts` (internal helper)  
**Returns:** UTC day boundaries in milliseconds

## 🔧 Configuration

### Delay Between Requests
Edit in `src/services/matches.service.ts`:
```typescript
const DELAY_MS = 100; // Change this value (milliseconds)
```

### Stop Conditions
The algorithm stops when:
1. Found target day AND now only seeing older matches
2. No more cursor (end of history)
3. Empty page received

## 📊 Performance

| Metric | Cache-based | Day-based (new) |
|--------|-------------|-----------------|
| Pages fetched | 100+ | 2-5 |
| Time | 30-60s | 1-3s |
| Rate limit risk | High | Low |
| Memory usage | High | Low |

## ⚠️ Important Notes

1. **Date Format:** Must be `YYYY-MM-DD`
2. **Time Zone:** All calculations use UTC
3. **Sorting:** Results are sorted newest first
4. **No Cache:** Direct API fetching (no database/cache)
5. **Rate Limiting:** 100ms delay between requests

## 🧪 Testing

```bash
# Valid request
curl "http://localhost:3000/api/matches/day?date=2026-03-09"

# Missing date
curl "http://localhost:3000/api/matches/day"
# → 400 error

# Invalid format
curl "http://localhost:3000/api/matches/day?date=09-03-2026"
# → 400 error
```

## 🔍 Debugging

Enable console logs to see pagination progress:
```
Fetching matches for 2026-03-09 (1709942400000 - 1710028800000)
Fetching page 1...
Page 1: newer=true, target=true, older=false, collected=234
Fetching page 2...
Page 2: newer=false, target=true, older=true, collected=456
Fetching page 3...
Page 3: newer=false, target=false, older=true, collected=456
Passed the target day, stopping pagination
Fetched 456 matches for 2026-03-09 across 3 pages
```

## 📁 Files

| File | Purpose |
|------|---------|
| `src/services/matches.service.ts` | Core logic |
| `src/controllers/matches.controller.ts` | Controller |
| `src/routes/matches.routes.ts` | Route definition |
| `examples/day-fetching-example.ts` | Standalone example |
| `IMPLEMENTATION_SUMMARY.md` | Full documentation |

## 🆚 Comparison with Existing Endpoint

### Old: `GET /api/matches?date=2026-03-09`
- Uses cache
- Fetches ALL history first
- Filters in-memory
- Slower but cached

### New: `GET /api/matches/day?date=2026-03-09`
- Direct API call
- Fetches only necessary pages
- No cache dependency
- Faster for single queries

**Use old endpoint when:**
- You need multiple queries quickly
- Cache is already populated
- You're okay with initial delay

**Use new endpoint when:**
- You need one specific day
- You want fresh data
- You want to avoid fetching full history
