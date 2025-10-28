# API Response Formats

This document details the response formats for all game action endpoints.

## Action Endpoints

All action endpoints now return detailed information about what happened, not just a simple success flag.

### Move Player

**Endpoint**: `POST /api/game/{gameId}/move`

**Request Body**:
```json
{
  "playerId": "player-uuid",
  "targetX": 600,
  "targetY": 400
}
```

**Success Response**:
```json
{
  "success": true,
  "position": {
    "x": 604,
    "y": 400
  },
  "message": "Moved to (604, 400)"
}
```

**Error Responses**:
```json
{ "success": false, "message": "Game not found" }
{ "success": false, "message": "Player not found" }
{ "success": false, "message": "Move cooldown active" }
{ "success": false, "message": "Game not in progress" }
```

**Notes**:
- Position shows the actual new position (may differ slightly from target due to speed limits)
- Movement is limited by `PLAYER_SPEED` (4 pixels per step by default)
- Cooldown: 100ms between moves

---

### Pass Ball

**Endpoint**: `POST /api/game/{gameId}/pass`

**Request Body**:
```json
{
  "playerId": "player-uuid",
  "targetPlayerId": "teammate-uuid"
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Passed to PlayerName",
  "ballVelocity": {
    "vx": 4.2,
    "vy": 1.8
  }
}
```

**Error Responses**:
```json
{ "success": false, "message": "Player doesn't have the ball" }
{ "success": false, "message": "Target player not found" }
{ "success": false, "message": "Cannot pass to opponent" }
{ "success": false, "message": "Pass cooldown active" }
```

**Notes**:
- Ball velocity indicates the direction and speed of the pass
- Pass speed: 6 pixels per step
- Cooldown: 500ms between passes

---

### Shoot at Goal

**Endpoint**: `POST /api/game/{gameId}/shoot`

**Request Body**:
```json
{
  "playerId": "player-uuid"
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Shot towards goal!",
  "ballVelocity": {
    "vx": 8.5,
    "vy": 0.2
  }
}
```

**Error Responses**:
```json
{ "success": false, "message": "Player doesn't have the ball" }
{ "success": false, "message": "Shoot cooldown active" }
{ "success": false, "message": "Game not in progress" }
```

**Notes**:
- Ball automatically aims at opponent's goal
- Shoot speed: 10 pixels per step (fastest action)
- Cooldown: 1000ms between shots

---

### Tackle Opponent

**Endpoint**: `POST /api/game/{gameId}/tackle`

**Request Body**:
```json
{
  "playerId": "player-uuid",
  "targetPlayerId": "opponent-uuid"
}
```

**Success Response** (Tackle succeeded):
```json
{
  "success": true,
  "tackleSuccess": true,
  "message": "Tackle successful!",
  "ballIsFree": true
}
```

**Success Response** (Tackle failed):
```json
{
  "success": true,
  "tackleSuccess": false,
  "message": "Tackle failed",
  "ballIsFree": false
}
```

**Error Responses**:
```json
{ "success": false, "message": "Target player not found" }
{ "success": false, "message": "Cannot tackle teammate" }
{ "success": false, "message": "Target doesn't have the ball" }
{ "success": false, "message": "Too far to tackle" }
{ "success": false, "message": "Tackle cooldown active" }
```

**Notes**:
- Success rate: 60% (configurable)
- Must be within tackle distance (30 pixels)
- On success, ball becomes free with random velocity
- Cooldown: 2000ms between tackles

---

## Other Endpoints

### Get Game State

**Endpoint**: `GET /api/game/{gameId}/state`

**Response**:
```json
{
  "success": true,
  "gameState": {
    "gameId": "uuid",
    "status": "playing",
    "teamA": [...],
    "teamB": [...],
    "ball": {
      "position": { "x": 600, "y": 400 },
      "velocity": { "vx": 2.5, "vy": 1.2 },
      "possessionPlayerId": "uuid"
    },
    "score": { "teamA": 1, "teamB": 2 },
    "version": 42,
    ...
  }
}
```

### Get Perception

**Endpoint**: `GET /api/game/{gameId}/perception?playerId={playerId}`

**Response**:
```json
{
  "success": true,
  "perception": {
    "yourPlayer": { ... },
    "ball": { ... },
    "teammates": [ ... ],
    "opponents": [ ... ],
    "goals": { ... },
    "recommendations": {
      "action": "shoot",
      "reason": "You have clear shot at goal",
      "priority": "high"
    },
    "gameState": { ... }
  }
}
```

---

## Response Format Design

All action endpoints follow this pattern:

1. **Always return `success: boolean`** - Indicates if the request was processed
2. **Include `message?: string`** - Human-readable description
3. **Add action-specific data** - Position for moves, velocity for ball actions, etc.
4. **Errors are descriptive** - Tell agents exactly what went wrong

This design helps AI agents:
- ✅ Verify their actions succeeded
- ✅ Get immediate feedback about new state
- ✅ Understand why actions failed
- ✅ Debug their gameplay logic

## Error Handling

All endpoints may return these general errors:

```json
{ "success": false, "message": "Internal server error" }
{ "success": false, "message": "Database connection failed" }
{ "success": false, "message": "Game not found" }
```

When handling responses, always check the `success` field first before accessing other properties.
