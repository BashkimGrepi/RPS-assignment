# GET /api/matches Endpoint Documentation

## Overview

The `/api/matches` endpoint provides flexible access to Rock-Paper-Scissors match data with support for multiple filtering options.

**Base URL:** `GET /api/matches`

---

## Query Parameters

All parameters are **optional**. Omit them to get default behavior (latest 100 matches).

### `date` (string)

- **Format:** `YYYY-MM-DD` (required format)
- **Description:** Filter matches by specific date (UTC)
- **Example:** `date=2026-03-15`
- **Returns:** All matches played on that date
- **Notes:**
  - Must be valid date format or 400 error returned
  - Returns empty array if no matches on that date

### `playerName` (string)

- **Format:** Player name (case-sensitive)
- **Description:** Filter matches for a specific player across all time
- **Example:** `playerName=Alice`
- **Returns:** All matches where player participated (as playerA or playerB)
- **Notes:**
  - Returns empty array if player doesn't exist
  - Includes matches from all dates
  - Use `encodeURIComponent()` for names with spaces: `playerName=Alice%20Smith`

---

## Usage Scenarios

### 1. Get Latest Matches (Default)

```
GET /api/matches
```

**Returns:** Latest 100 matches from database (most recent first)

### 2. Get All Matches on a Date

```
GET /api/matches?date=2026-03-15
```

**Returns:** All matches played on March 15, 2026

### 3. Get All Matches for a Player

```
GET /api/matches?playerName=Alice
```

**Returns:** All matches Alice played (career history, all dates)

### 4. Get Player's Matches on a Specific Date

```
GET /api/matches?date=2026-03-15&playerName=Alice
```

**Returns:** Only Alice's matches on March 15, 2026

---

## Response Format

### Success (200 OK)

```json
{
  "data": [
    {
      "gameId": "match-abc123",
      "time": 1710518400000,
      "date": "2026-03-15",
      "playerA": {
        "name": "Alice",
        "played": "ROCK"
      },
      "playerB": {
        "name": "Bob",
        "played": "SCISSORS"
      },
      "winner": "Alice",
      "isTie": false
    },
    {
      "gameId": "match-def456",
      "time": 1710522000000,
      "date": "2026-03-15",
      "playerA": {
        "name": "Charlie",
        "played": "PAPER"
      },
      "playerB": {
        "name": "Diana",
        "played": "PAPER"
      },
      "winner": null,
      "isTie": true
    }
  ],
  "count": 2
}
```

### Response Fields

| Field            | Type           | Description                                    |
| ---------------- | -------------- | ---------------------------------------------- |
| `data`           | array          | Array of match objects                         |
| `count`          | number         | Number of matches returned                     |
| `gameId`         | string         | Unique match identifier                        |
| `time`           | number         | Unix timestamp when match ended (milliseconds) |
| `date`           | string         | Match date in YYYY-MM-DD format                |
| `playerA.name`   | string         | First player name                              |
| `playerA.played` | string         | Choice: "ROCK", "PAPER", or "SCISSORS"         |
| `playerB.name`   | string         | Second player name                             |
| `playerB.played` | string         | Choice: "ROCK", "PAPER", or "SCISSORS"         |
| `winner`         | string \| null | Winner's name (null if tie)                    |
| `isTie`          | boolean        | True if match was a draw                       |

---

## Error Responses

### 400 Bad Request - Invalid Date Format

```json
{
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

**Cause:** Date parameter doesn't match `YYYY-MM-DD` format

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

**Cause:** Server-side issue

---

## Frontend Implementation Examples

### Fetch API

```javascript
// Latest matches
const response = await fetch("/api/matches");

// With date filter
const response = await fetch("/api/matches?date=2026-03-15");

// With player filter
const playerName = "Alice";
const response = await fetch(
  `/api/matches?playerName=${encodeURIComponent(playerName)}`,
);

// With both filters
const response = await fetch(
  `/api/matches?date=2026-03-15&playerName=${encodeURIComponent("Alice")}`,
);

const data = await response.json();
console.log(data.data); // Array of matches
console.log(data.count); // Number of results
```

### Query String Builder

```javascript
function buildMatchesQuery(filters) {
  const params = new URLSearchParams();

  if (filters.date) {
    params.append("date", filters.date);
  }

  if (filters.playerName) {
    params.append("playerName", filters.playerName);
  }

  return `/api/matches${params.toString() ? "?" + params : ""}`;
}

// Usage
const url = buildMatchesQuery({
  date: "2026-03-15",
  playerName: "Alice",
});
// Result: /api/matches?date=2026-03-15&playerName=Alice
```

### React Hook

```typescript
import { useState, useEffect } from "react";

function useMatches(filters) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (filters.date) params.append("date", filters.date);
    if (filters.playerName) params.append("playerName", filters.playerName);

    const url = `/api/matches${params.toString() ? "?" + params : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMatches(data.data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setMatches([]);
      })
      .finally(() => setLoading(false));
  }, [filters.date, filters.playerName]);

  return { matches, loading, error };
}
```

---

## Important Notes

1. **Case Sensitivity:** Player names are case-sensitive
2. **URL Encoding:** Encode special characters in player names (e.g., spaces as `%20`)
3. **Timezone:** All dates are in UTC
4. **Empty Results:** Returns `data: []` and `count: 0` if no matches found
5. **Performance:** Player filters across all time may take longer for active players

---

## Related Endpoints

- `GET /api/players` - List all players
- `GET /api/players/:name/stats` - Get specific player stats
- `GET /api/matches/latest?limit=N` - Get latest N matches (legacy)
