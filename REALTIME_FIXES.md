# Real-Time Game State Fixes (v1.2.1)

## Issues Fixed

This document describes three critical issues with real-time game state synchronization and their fixes.

---

## Issue 1: Ball Not Moving After Pass/Shoot (Initial Fix)

### Problem Description

When a player called the pass or shoot endpoint:
1. API returned success: `{"success": true, "message": "Passed to Edison", "ballVelocity": {"vx": 6, "vy": 0}}`
2. The ball velocity was set correctly in the database
3. **BUT** the ball didn't actually move in the UI or game state

### Root Cause

The issue was a timing problem with the simulation loop:

```javascript
// In gameActions.ts - Pass function
game.ball.velocity = { vx: 6, vy: 0 };  // Set velocity
game.lastUpdate = now;                   // Update timestamp ❌ Problem!
await game.save();

// Later, in simulate function
const dt = now - state.lastUpdate;
if (dt < GAME_CONFIG.SIMULATION_STEP) return false;  // ❌ Simulation skipped!
```

**What happened:**
1. Pass action set `ball.velocity = {vx: 6, vy: 0}`
2. Pass action also set `lastUpdate = now` and saved
3. Within milliseconds, SSE/API called `simulate()`
4. But `dt = now - lastUpdate` was < 50ms (simulation step)
5. Simulation returned early without moving the ball!
6. Ball had velocity but position didn't update for up to 50ms

### The Fix

**Removed `game.lastUpdate = now` from all action functions:**

```javascript
// lib/gameActions.ts - All action functions
export async function movePlayer(...) {
  // ... action logic ...

  game.version++;
  // Don't update lastUpdate here - let simulation handle it ✅
  // This ensures ball starts moving immediately on next simulation tick

  await game.save();
}
```

**Why this works:**
- Actions no longer reset the `lastUpdate` timestamp
- The simulation detects enough time has passed (dt >= 50ms)
- Ball position updates immediately on the very next simulation tick
- Players see smooth, immediate ball movement after pass/shoot

### Files Changed

- `lib/gameActions.ts` - Updated 4 functions:
  - `movePlayer()` - line 71
  - `passBall()` - line 155
  - `shoot()` - line 224
  - `tackle()` - line 306

### Before vs After

**Before:**
```bash
# Pass ball
POST /api/game/{id}/pass → {success: true, ballVelocity: {vx: 6, vy: 0}}
# Ball doesn't move for up to 50ms!
# Players see: "Ball should be moving... why isn't it?"
```

**After:**
```bash
# Pass ball
POST /api/game/{id}/pass → {success: true, ballVelocity: {vx: 6, vy: 0}}
# Next simulation tick (within 50ms): Ball position updates!
# Players see: Immediate smooth ball movement ✅
```

---

## Issue 1B: Ball Returning to Passer Immediately

### Problem Description

After fixing Issue 1, a new problem emerged:
1. Player passes or shoots the ball
2. Ball moves slightly in the intended direction (2-3 pixels)
3. **Ball immediately returns to the passer**
4. Ball never reaches the intended target or recipient

### Root Cause

The possession claim logic was too aggressive:

```javascript
// OLD CODE - lib/gameLogic.ts
for (const player of allPlayers) {
  const dist = distance(player.position, state.ball.position);
  if (dist <= GAME_CONFIG.POSSESSION_DISTANCE) {  // 25 pixels
    state.ball.possessionPlayerId = player.id;   // ❌ Passer immediately reclaims!
    state.ball.velocity = { vx: 0, vy: 0 };     // ❌ Ball stops moving!
    player.hasBall = true;
    break;
  }
}
```

**What happened:**
1. Player passes ball with velocity `{vx: 6, vy: 0}`
2. Ball moves 6 pixels away from passer
3. Passer is still within 25 pixels (POSSESSION_DISTANCE)
4. Next simulation tick: Passer reclaims possession!
5. Ball velocity set to zero, ball stops
6. Ball never reaches recipient

### The Fix

**Added smart possession claim logic:**

```javascript
// NEW CODE - lib/gameLogic.ts
const ballSpeed = Math.sqrt(state.ball.velocity.vx ** 2 + state.ball.velocity.vy ** 2);
const ballNearlyStoppedThreshold = 0.5;

for (const player of allPlayers) {
  const dist = distance(player.position, state.ball.position);

  // Can claim possession ONLY if:
  // 1. Ball is close enough, AND
  // 2. Either ball has nearly stopped OR this is a different player (interception)
  const canClaim = dist <= GAME_CONFIG.POSSESSION_DISTANCE &&
                  (ballSpeed <= ballNearlyStoppedThreshold ||
                   player.id !== state.ball.lastTouchPlayerId);

  if (canClaim) {
    state.ball.possessionPlayerId = player.id;
    state.ball.velocity = { vx: 0, vy: 0 };
    player.hasBall = true;
    console.log(`Ball claimed by ${player.name}, was moving at speed ${ballSpeed.toFixed(2)}`);
    break;
  }
}
```

**Why this works:**
- **Passer can't reclaim**: If `player.id === state.ball.lastTouchPlayerId` AND ball is moving fast, can't claim
- **Recipients can intercept**: Different players CAN claim even while ball is moving (interceptions!)
- **Natural stops work**: When ball slows down (friction), anyone nearby can claim it
- **Pass completes**: Ball travels full distance to recipient without passer reclaiming

### Files Changed

- `lib/gameLogic.ts` - Lines 154-184: Smart possession claim logic

### Before vs After

**Before:**
```bash
# Pass to teammate 300 pixels away
POST /api/game/{id}/pass → {success: true, ballVelocity: {vx: 6, vy: 0}}

# What happens:
Tick 1: Ball moves 6px → Position: (player.x + 6, player.y)
Tick 2: Passer reclaims! → Ball velocity: {vx: 0, vy: 0} ❌
# Ball traveled only 6 pixels out of 300! ❌
```

**After:**
```bash
# Pass to teammate 300 pixels away
POST /api/game/{id}/pass → {success: true, ballVelocity: {vx: 6, vy: 0}}

# What happens:
Tick 1: Ball moves 6px → Moving fast, passer can't reclaim ✅
Tick 2: Ball moves 6px more → Still moving, passer can't reclaim ✅
Tick 3-50: Ball continues moving...
Tick 50: Ball near recipient → Recipient claims! ✅
# Ball successfully traveled 300 pixels! ✅
```

### Interception Still Works

```bash
# Opponent intercepts a pass
Tick 1-20: Ball flying toward teammate
Tick 21: Opponent moves into ball path
        → Ball within POSSESSION_DISTANCE of opponent
        → Opponent is DIFFERENT player than lastTouch
        → Opponent can claim! → Interception! ✅
```

---

## Issue 2: UI Flashing "Internal Server Error"

### Problem Description

The game page UI would:
1. Show the game normally
2. Flash with "Internal Server Error" message
3. Go back to normal
4. Flash again with error
5. Repeat continuously, making the game unplayable

### Root Cause

**Poor error handling with no resilience:**

```javascript
// OLD CODE - app/game/[gameId]/page.tsx
const fetchGameState = async () => {
  try {
    const res = await fetch(`/api/game/${gameId}/state`);
    const data = await res.json();
    setGameState(data.gameState);
  } catch (err) {
    setError("Failed to connect");  // ❌ Immediately breaks UI!
  }
};

// ... in render ...
if (error) {
  return <FullScreenError>{error}</FullScreenError>;  // ❌ Game disappears!
}
```

**Problems:**
1. **Any single error** → Full screen error page
2. **No retry logic** → One transient error kills the UI
3. **Last known state discarded** → User loses context
4. **SSE errors** → Immediately falls back but shows error
5. **MongoDB connection issues** → Instant failure

Common causes of transient errors:
- MongoDB connection pool exhaustion (temporary)
- SSE stream timeout/reconnect (normal behavior)
- Network blips
- Server momentary load spikes

### The Fix

**Implemented graceful degradation with retry logic:**

```javascript
// NEW CODE - app/game/[gameId]/page.tsx
const errorCountRef = useRef<number>(0);
const successCountRef = useRef<number>(0);
const MAX_CONSECUTIVE_ERRORS = 5;

const fetchGameState = async () => {
  try {
    const res = await fetch(`/api/game/${gameId}/state`);
    const data = await res.json();

    if (data.success && data.gameState) {
      setGameState(data.gameState);
      errorCountRef.current = 0;  // ✅ Reset error count
      successCountRef.current++;
      setIsConnected(true);

      if (successCountRef.current >= 2) {
        setError(null);  // ✅ Clear transient errors
      }
    }
  } catch (err) {
    errorCountRef.current++;  // ✅ Track consecutive failures
    setIsConnected(false);    // ✅ Show warning, not full error

    // ✅ Only show error after 5 consecutive failures
    if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
      setError(err.message);
    }
  }
};

// ... SSE with automatic reconnection ...
eventSource.addEventListener("error", () => {
  eventSource?.close();
  setIsConnected(false);  // ✅ Show warning banner

  // ✅ Fall back to polling
  fallbackInterval = setInterval(fetchGameState, 1000);

  // ✅ Try to reconnect SSE after 5 seconds
  setTimeout(() => {
    clearInterval(fallbackInterval);
    setupSSE();  // Retry SSE connection
  }, 5000);
});

// ... in render ...
if (error && !gameState) {  // ✅ Only show error if NO state at all
  return <FullScreenError />;
}

// ✅ Show warning banner but keep playing
{!isConnected && (
  <Banner>Connection interrupted, reconnecting...</Banner>
)}

// ✅ Continue showing last known game state
<GameCanvas gameState={gameState} />
```

### Key Improvements

1. **Error Counting**: Only show full error after 5 consecutive failures
2. **Last Known State**: Keep displaying game even during reconnection
3. **Visual Feedback**: Yellow banner instead of full-screen error
4. **Auto Recovery**: SSE auto-reconnects after 5 seconds
5. **Graceful Fallback**: SSE error → Polling → Retry SSE
6. **Success Tracking**: 2 successful fetches clear any error state

### Files Changed

- `app/game/[gameId]/page.tsx` - Complete rewrite with resilience:
  - Error counting with `useRef` hooks
  - Connection status indicator
  - SSE reconnection logic
  - Fallback polling with retry
  - Conditional error display

### User Experience

**Before:**
```
Normal game → Single error → FULL SCREEN ERROR → User frustrated
```

**After:**
```
Normal game → Transient error → Small warning banner → Auto-recovery → Normal game
                                  ↓
                          Game continues playing!
```

---

## Technical Details

### Simulation Timing

The game uses fixed timestep simulation:
- **Simulation Step**: 50ms (20 ticks per second)
- **Physics Update**: Every 50ms when `dt >= SIMULATION_STEP`
- **SSE Updates**: Every 250ms (4 per second)
- **Polling Fallback**: Every 1000ms (1 per second)

### Error Recovery Flow

```
[SSE Connected] ─error→ [Polling Fallback]
                          │
                          ├─ Show warning banner
                          ├─ Keep showing last state
                          └─ Retry SSE after 5s
                                │
                                ├─ Success → [SSE Connected]
                                └─ Failure → Continue polling
```

### MongoDB Connection Pool

The "Internal server error" was often caused by:
1. MongoDB connection pool exhaustion
2. Connections not being released properly
3. Concurrent SSE streams holding connections

The error handling ensures:
- Connection errors don't crash the UI
- Failed connections retry automatically
- User sees continuous experience despite backend issues

---

## Testing

### Test Ball Movement
```bash
# Create game and get player IDs
curl -X POST http://localhost:3000/api/games/create \
  -H "Content-Type: application/json" \
  -d '{"playerName": "TestPlayer"}'

# Move player
curl -X POST http://localhost:3000/api/game/{gameId}/move \
  -H "Content-Type: application/json" \
  -d '{"playerId": "...", "targetX": 600, "targetY": 400}'

# Pass ball (requires teammate)
curl -X POST http://localhost:3000/api/game/{gameId}/pass \
  -H "Content-Type: application/json" \
  -d '{"playerId": "...", "targetPlayerId": "..."}'

# Watch in UI - ball should move immediately! ✅
```

### Test Error Recovery
```bash
# Simulate MongoDB downtime
# Stop MongoDB temporarily

# Watch UI:
# - Shows "Connection interrupted" banner ✅
# - Game continues displaying ✅
# - No full-screen error! ✅

# Restart MongoDB

# Watch UI:
# - Connection restored automatically ✅
# - Banner disappears ✅
# - Game updates resume ✅
```

---

## Configuration

### Error Tolerance Settings

```typescript
// In app/game/[gameId]/page.tsx
const MAX_CONSECUTIVE_ERRORS = 5;  // Show error after 5 failures
const MIN_SUCCESS_COUNT = 2;        // Clear error after 2 successes
const SSE_RETRY_DELAY = 5000;       // Retry SSE after 5 seconds
const POLLING_INTERVAL = 1000;      // Poll every 1 second
```

### Simulation Settings

```typescript
// In types/game.ts
GAME_CONFIG.SIMULATION_STEP = 50;   // 50ms between physics updates
```

---

## Common Pitfalls Avoided

### ❌ Don't Do This:
```javascript
// Setting lastUpdate in actions
game.ball.velocity = { vx: 6, vy: 0 };
game.lastUpdate = Date.now();  // ❌ Breaks ball movement!
await game.save();
```

### ✅ Do This Instead:
```javascript
// Let simulation handle lastUpdate
game.ball.velocity = { vx: 6, vy: 0 };
game.version++;  // Increment version for clients
await game.save();  // Simulation will update lastUpdate
```

### ❌ Don't Do This:
```javascript
// Showing error immediately
catch (err) {
  setError(err.message);  // ❌ Breaks UI on any error!
}

if (error) {
  return <FullScreenError />;  // ❌ Game disappears!
}
```

### ✅ Do This Instead:
```javascript
// Count errors and keep showing state
catch (err) {
  errorCount++;
  setIsConnected(false);  // ✅ Show warning

  if (errorCount >= 5) {
    setError(err.message);  // ✅ Only after repeated failures
  }
}

if (error && !gameState) {  // ✅ Only if no state at all
  return <FullScreenError />;
}

// ✅ Otherwise, show warning banner and continue
<WarningBanner />
<GameCanvas gameState={gameState} />
```

---

## Performance Impact

### Before Fixes:
- Ball movement: Delayed 0-50ms
- Error recovery: None (required page reload)
- User experience: Frustrating, broken

### After Fixes:
- Ball movement: Immediate (next tick)
- Error recovery: Automatic, seamless
- User experience: Smooth, professional

### Network Efficiency:
- SSE: 4 updates/second (efficient)
- Polling fallback: 1 update/second (minimal)
- Auto-recovery: Reduces manual interventions
- Connection reuse: SSE preferred over polling

---

## Future Enhancements

Potential improvements:
1. **Exponential backoff** for reconnection attempts
2. **Optimistic UI updates** - Show pass immediately, revert on failure
3. **Client-side prediction** - Estimate ball position between updates
4. **WebSocket upgrade** - More efficient than SSE for bi-directional
5. **Service worker** - Offline game state caching

---

## Related Documentation

- [Movement System](./MOVEMENT_SYSTEM.md) - Autonomous player movement
- [Game Fix Summary](./GAME_FIX_SUMMARY.md) - Mongoose markModified issues
- [API Response Formats](./API_RESPONSE_FORMATS.md) - Endpoint details
- [README](./README.md) - Full project documentation

---

## Version History

- **v1.2.1** (Current)
  - Fixed ball movement after pass/shoot
  - Implemented graceful error handling
  - Added automatic reconnection
  - Added connection status indicators

- **v1.2.0**
  - Added configurable player speed
  - Base speed increased 5x (4 → 20 pixels/tick)

- **v1.1.0**
  - Autonomous movement system
  - Target-based navigation

- **v1.0.0**
  - Initial release
  - Basic game mechanics
