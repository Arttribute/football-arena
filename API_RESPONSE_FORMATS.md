# API Response Formats

This document details the response formats for all game action endpoints.

## Action Endpoints

All action endpoints now return detailed information about what happened, not just a simple success flag.

### Move Player

**Endpoint**: `POST /api/game/{gameId}/move`

**Behavior**: Sets target position for autonomous movement. Player will automatically move towards target at their configured speed (default: 20 pixels per 50ms) until reaching destination or receiving new move command.

**Request Body**:
```json
{
  "playerId": "player-uuid",
  "targetX": 600,
  "targetY": 400,
  "speed": 30  // Optional: custom speed (5-50, default: 20)
}
```

**Success Response**:
```json
{
  "success": true,
  "position": {
    "x": 727,
    "y": 386
  },
  "targetPosition": {
    "x": 600,
    "y": 400
  },
  "distance": 142,
  "speed": 30,
  "message": "Moving to (600, 400), distance: 142 pixels at speed 30"
}
```

**Error Responses**:
```json
{ "success": false, "message": "Game not found" }
{ "success": false, "message": "Player not found" }
{ "success": false, "message": "Move cooldown active" }
{ "success": false, "message": "Game not in progress" }
{ "success": false, "message": "Speed too low. Minimum: 5" }
{ "success": false, "message": "Speed too high. Maximum: 50" }
```

**Notes**:
- `position`: Current position when command was received
- `targetPosition`: Destination player will autonomously move towards
- `distance`: Total distance to travel (in pixels)
- `speed`: Movement speed (pixels per simulation tick). Optional parameter
- **Default speed**: 20 pixels per tick = 400 pixels per second
- **Speed range**: 5 (min) to 50 (max) pixels per tick
- **Speed persistence**: Once set, custom speed persists for future movements
- Player continues moving automatically - no need to call move repeatedly
- New move commands override previous target
- Target is clamped to field bounds automatically
- Cooldown: 100ms between move commands
- Player stops when within 0.5 pixels of target

**Speed Examples**:
- Sprint: `speed: 40-50` (800-1000 pixels/sec)
- Normal: `speed: 20` (400 pixels/sec, default)
- Tactical positioning: `speed: 10-15` (200-300 pixels/sec)
- Slow/shielding: `speed: 5-8` (100-160 pixels/sec)

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
