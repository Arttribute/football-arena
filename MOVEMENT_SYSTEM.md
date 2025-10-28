# Movement System Documentation

## Overview

The Football Arena uses an **autonomous navigation system** where players move continuously towards set target positions. This document explains how it works and how to use it.

## System Architecture

### Components

1. **Move Action Endpoint** (`/api/game/{gameId}/move`)
   - Sets player's target position
   - Validates target is within bounds
   - Returns current position, target, and distance

2. **Simulation Loop** (`lib/gameLogic.ts`)
   - Runs every 50ms (20 ticks per second)
   - Moves all players towards their targets
   - Handles ball possession during movement
   - Clears target when reached

3. **Player State**
   - `position`: Current x, y coordinates
   - `targetPosition`: Where player is moving to (optional)
   - `hasBall`: Whether player has ball possession

## How It Works

### Setting a Target

When you call the move endpoint:

```json
POST /api/game/{gameId}/move
{
  "playerId": "uuid",
  "targetX": 600,
  "targetY": 400,
  "speed": 25  // Optional: custom speed (5-50, default: 20)
}
```

**What Happens:**
1. Validates player exists and game is playing
2. Validates custom speed is within limits (if provided)
3. Sets player's custom speed (persists for future movements)
4. Clamps target to field bounds (prevents out-of-bounds)
5. Calculates distance to target
6. Sets `player.targetPosition = { x: 600, y: 400 }`
7. Returns confirmation with journey details

**Response:**
```json
{
  "success": true,
  "position": { "x": 727, "y": 386 },
  "targetPosition": { "x": 600, "y": 400 },
  "distance": 142,
  "speed": 25,
  "message": "Moving to (600, 400), distance: 142 pixels at speed 25"
}
```

### Automatic Movement

Every 50ms, the simulation loop:

1. **For each player with a targetPosition:**
   ```javascript
   // Calculate vector to target
   dx = targetPosition.x - position.x
   dy = targetPosition.y - position.y
   distance = sqrt(dx² + dy²)

   // Move at player's configured speed (or default 20 pixels per tick)
   if (distance > 0.5) {
     playerSpeed = player.speed || GAME_CONFIG.PLAYER_SPEED  // Use custom or default
     moveAmount = min(playerSpeed, distance)
     position.x += (dx / distance) * moveAmount
     position.y += (dy / distance) * moveAmount

     // Ball moves with player if they have possession
     if (player.hasBall) {
       ball.position = player.position
     }
   } else {
     // Reached target - clear it
     player.targetPosition = undefined
   }
   ```

2. **Updates via SSE stream** (every 250ms)
   - UI receives new positions
   - Canvas renders smooth movement
   - Agents can poll perception to check progress

### Reaching the Target

When player gets within 0.5 pixels of target:
- `targetPosition` is cleared (set to `undefined`)
- Player stops moving
- Stays at final position until new move command

### Changing Direction

Call move endpoint again with new target:
- Previous target is **immediately replaced**
- Player starts moving towards new destination
- No need to wait for previous target to be reached

Example:
```bash
# Start moving to (600, 400)
POST /move {"targetX": 600, "targetY": 400}

# Change mind - go to (800, 200) instead
POST /move {"targetX": 800, "targetY": 200}
# Player immediately pivots towards new target
```

## Configuration

### Speed

**v1.2.0+ - Configurable Speed:**
```typescript
GAME_CONFIG.PLAYER_SPEED = 20       // Default speed: pixels per simulation step (50ms)
GAME_CONFIG.MIN_PLAYER_SPEED = 5    // Minimum allowed speed
GAME_CONFIG.MAX_PLAYER_SPEED = 50   // Maximum allowed speed
```

**Speed Characteristics:**
- **Default**: 20 pixels per 50ms = 400 pixels per second
- **Minimum**: 5 pixels per 50ms = 100 pixels per second
- **Maximum**: 50 pixels per 50ms = 1000 pixels per second
- To travel 800 pixels at default speed: ~2 seconds
- To travel 800 pixels at max speed: ~0.8 seconds
- To travel 800 pixels at min speed: ~8 seconds
- Speed is constant during movement - no acceleration/deceleration
- Custom speed persists across movement commands until changed

### Simulation Rate
```typescript
GAME_CONFIG.SIMULATION_STEP = 50  // milliseconds
```

- Game physics update every 50ms
- 20 simulation ticks per second
- Independent of frame rate or network latency

### Field Bounds
```typescript
GAME_CONFIG.FIELD_WIDTH = 1200
GAME_CONFIG.FIELD_HEIGHT = 800
GAME_CONFIG.PLAYER_RADIUS = 15
```

- Target positions are automatically clamped to valid area
- Min X: 15, Max X: 1185
- Min Y: 15, Max Y: 785

## Configurable Speed (v1.2.0+)

### Setting Custom Speed

Players can move at different speeds based on tactical needs:

```javascript
// Slow positioning move (conserving stamina conceptually)
await move(gameId, playerId, 600, 400, 8);  // Slow walk

// Normal move (default speed if not specified)
await move(gameId, playerId, 600, 400);     // 20 pixels/tick

// Fast sprint to intercept
await move(gameId, playerId, 600, 400, 40); // Sprint!

// Maximum speed chase
await move(gameId, playerId, 600, 400, 50); // Full sprint!
```

### Speed Persistence

Once set, a player's custom speed persists:

```javascript
// Set speed on first move
await move(gameId, playerId, 300, 200, 35);  // Fast

// Subsequent moves use same speed if not specified
await move(gameId, playerId, 700, 600);      // Still moving at 35

// Change speed explicitly
await move(gameId, playerId, 500, 400, 15);  // Now slower

// Back to default
await move(gameId, playerId, 600, 300, 20);  // Default speed
```

### Tactical Uses

**Fast Sprint:**
- Chase loose ball: `speed: 45-50`
- Counter-attack runs: `speed: 40`
- Defensive recovery: `speed: 45`

**Normal Pace:**
- Positioning: `speed: 20` (default)
- Buildup play: `speed: 15-25`
- Formation adjustments: `speed: 20`

**Slow Movement:**
- Ball shielding: `speed: 8-10`
- Waiting for support: `speed: 5-8`
- Controlling tempo: `speed: 10-15`

### Speed Validation

```json
// Too slow
{
  "speed": 3,
  "success": false,
  "message": "Speed too low. Minimum: 5"
}

// Too fast
{
  "speed": 60,
  "success": false,
  "message": "Speed too high. Maximum: 50"
}

// Just right
{
  "speed": 30,
  "success": true,
  ...
}
```

## AI Agent Usage

### Basic Pattern

```javascript
// 1. Decide where to go
const target = { x: 600, y: 400 };

// 2. Set the destination
await move(gameId, playerId, target.x, target.y);

// 3. Do other things while moving
// Check perception, decide on pass/shoot, etc.

// 4. Check if reached destination (optional)
const perception = await getPerception(gameId, playerId);
const arrived = !perception.yourPlayer.targetPosition;

if (arrived) {
  // Now at destination, make next decision
}
```

### Strategic Movement

```javascript
// Move to ball
const ballPos = perception.ball.position;
await move(gameId, playerId, ballPos.x, ballPos.y);

// Move to open space
const openSpace = findOpenSpace(perception);
await move(gameId, playerId, openSpace.x, openSpace.y);

// Move towards goal
const goalX = yourTeam === 'A' ? 1200 : 0;
await move(gameId, playerId, goalX, 400);

// Change direction mid-movement
if (ballPossessionChanged) {
  await move(gameId, playerId, newTarget.x, newTarget.y);
}
```

### Checking Progress

The perception endpoint tells you if player is still moving:

```json
{
  "yourPlayer": {
    "position": { "x": 650, "y": 390 },
    "targetPosition": { "x": 600, "y": 400 },  // Still moving
    ...
  }
}
```

If `targetPosition` is `null` or `undefined`, player has reached destination.

## Ball Possession During Movement

When a player with the ball moves:
- Ball position is updated every simulation tick
- Ball moves with the player
- Ball appears "dribbling" in the UI
- No need to separately move the ball

When ball is passed or shot:
- Ball gets its own velocity
- Player's `hasBall` becomes `false`
- Ball moves independently via ball physics
- Player can continue moving to their target

## Edge Cases

### Player Already at Target
```json
{
  "success": false,
  "message": "Already at target position"
}
```
Returns error if distance < 1 pixel

### Move During Cooldown
```json
{
  "success": false,
  "message": "Move cooldown active"
}
```
Cooldown: 100ms between move commands

### Game Not Playing
```json
{
  "success": false,
  "message": "Game not in progress"
}
```
Can only move during "playing" status

### Out of Bounds Target
Target is automatically clamped to field bounds. You never get an error, but target may be adjusted:

```javascript
// Request: targetX = 5000 (way off field)
// Actual target set: x = 1185 (max valid)
```

## Performance Characteristics

### API Calls
- **Old System**: ~150 calls to move 600 pixels
- **New System**: 1 call to move any distance
- **Reduction**: 99.3% fewer API calls for long distances

### Database Updates
- Move endpoint: 1 write (set target)
- Simulation: Writes only when position changes
- ~20 writes per second while player is moving
- 0 writes when player is stationary

### Network Traffic
- SSE stream: Updates every 250ms
- 4 state updates per second regardless of movement
- Agents don't need to poll move status

### UI Smoothness
- Canvas renders at 60 FPS
- Simulation provides new positions at 20 Hz
- Linear interpolation possible for ultra-smooth animation
- No visible "teleporting"

## Comparison: Old vs New

| Aspect | Old System | New System |
|--------|-----------|------------|
| API calls to move 600px | ~150 | 1 |
| Agent complexity | High (polling loop) | Low (set and forget) |
| UI appearance | Stuttery | Smooth |
| Network efficiency | Poor | Excellent |
| Player behavior | Unnatural | Natural |
| Code required | 20+ lines | 1 line |
| Mid-journey changes | Difficult | Easy |
| Ball dribbling | Manual | Automatic |

## Migration Guide

### Old Code (v1.0.0)
```javascript
// Had to call move repeatedly
async function moveToPosition(target) {
  while (true) {
    const perception = await getPerception();
    const dx = target.x - perception.yourPlayer.position.x;
    const dy = target.y - perception.yourPlayer.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 5) break;  // Close enough

    await move(gameId, playerId, target.x, target.y);
    await sleep(100);  // Wait for next move
  }
}
```

### New Code (v1.1.0+)
```javascript
// One call does it all
async function moveToPosition(target) {
  await move(gameId, playerId, target.x, target.y);
  // Done! Player will get there automatically
}
```

## Future Enhancements

Potential improvements to consider:

- **Pathfinding**: Navigate around opponents
- **Acceleration**: Gradual speed up/down
- **Stamina**: Speed decreases with distance
- **Formations**: Players return to formation when idle
- **Smart positioning**: Auto-adjust based on ball location

## Technical Implementation

See source code:
- Player type: `types/game.ts` (targetPosition field)
- Schema: `models/GameState.ts` (targetPosition in PlayerSchema)
- Move action: `lib/gameActions.ts` (movePlayer function)
- Simulation: `lib/gameLogic.ts` (player movement loop)

## Troubleshooting

**Player not moving:**
- Check game status is "playing"
- Verify targetPosition is set (via perception)
- Check SSE stream is connected
- Ensure simulation loop is running

**Player moving wrong direction:**
- Target may have been clamped to bounds
- Check actual targetPosition in response
- Verify field coordinates (0,0 is top-left)

**Movement too slow/fast:**
- Adjust `GAME_CONFIG.PLAYER_SPEED`
- Verify simulation rate is 50ms
- Check server performance (simulation lag)

**Ball not moving with player:**
- Verify `hasBall` is true
- Check `possessionPlayerId` matches
- Ensure ball isn't in flight (has velocity)
