# Changelog

All notable changes to Football Arena will be documented in this file.

## [1.2.2] - 2025-11-01

### Added - Configurable Ball Velocity

Players can now pass and shoot at different speeds based on tactical needs!

#### Features

- **Pass Speed Increased 2x**: From 6 to 12 pixels per simulation tick (50ms)
- **Shoot Speed Increased 2.5x**: From 10 to 25 pixels per simulation tick (50ms)
- **Custom Speed Per Action**: Optional `speed` parameter for pass and shoot
- **Speed Validation**: Min/max limits ensure reasonable ball physics

#### Speed Ranges

- **Pass Speed**:
  - Default: 12 pixels/tick (240 pixels/second)
  - Min: 5 pixels/tick (100 pixels/second)
  - Max: 20 pixels/tick (400 pixels/second)
- **Shoot Speed**:
  - Default: 25 pixels/tick (500 pixels/second)
  - Min: 10 pixels/tick (200 pixels/second)
  - Max: 40 pixels/tick (800 pixels/second)

#### API Changes

```javascript
// Pass with default speed
POST /api/game/{id}/pass
{"playerId": "...", "targetPlayerId": "..."}

// Pass with custom speed
POST /api/game/{id}/pass
{"playerId": "...", "targetPlayerId": "...", "speed": 15}

// Shoot with default speed
POST /api/game/{id}/shoot
{"playerId": "..."}

// Shoot with custom speed
POST /api/game/{id}/shoot
{"playerId": "...", "speed": 35}

// Response includes speed
{"success": true, "message": "Passed to Edison", "ballVelocity": {...}, "speed": 15}
```

#### Tactical Use Cases

- **Quick Pass**: Speed 15-20 for fast ball movement between nearby teammates
- **Safe Pass**: Speed 8-10 for controlled passes with lower interception risk
- **Power Shot**: Speed 30-40 for long-distance shots with high velocity
- **Placement Shot**: Speed 15-20 for accurate shots with better control

### Changed

- `GAME_CONFIG.PASS_SPEED`: 6 → 12 (2x faster)
- `GAME_CONFIG.SHOOT_SPEED`: 10 → 25 (2.5x faster)
- Added `MIN_PASS_SPEED`: 5 pixels/tick
- Added `MAX_PASS_SPEED`: 20 pixels/tick
- Added `MIN_SHOOT_SPEED`: 10 pixels/tick
- Added `MAX_SHOOT_SPEED`: 40 pixels/tick
- Pass endpoint now accepts optional `speed` parameter
- Shoot endpoint now accepts optional `speed` parameter
- Pass response includes `speed` field
- Shoot response includes `speed` field

### Documentation

- Updated README.md with ball velocity configuration details
- Updated API_RESPONSE_FORMATS.md with speed examples
- Updated agent tools spec with speed parameter documentation
- Added tactical use cases for different speeds

---

## [1.2.1] - 2025-10-29

### Fixed - Real-Time Game State Issues

Critical fixes for ball physics and error handling that were preventing proper gameplay.

#### Issue 1A: Ball Not Moving After Pass/Shoot

**Problem**: Pass and shoot actions returned success with ball velocity, but the ball didn't actually move in the UI or game state.

**Root Cause**: Action functions were setting `game.lastUpdate = now` which prevented the simulation from running for the next 50ms. The ball had velocity but no position updates.

**Fix**: Removed `lastUpdate` assignments from all action functions. Only the simulation loop updates `lastUpdate` now.

**Impact**: Ball now moves immediately after pass/shoot actions.

#### Issue 1B: Ball Returning to Passer Immediately

**Problem**: After fixing 1A, ball would move slightly toward recipient then immediately return to the passer. Ball never reached its target.

**Root Cause**: Passer remained within possession distance (25 pixels) and immediately reclaimed the moving ball on the next simulation tick, stopping its velocity.

**Fix**: Added smart possession claim logic that prevents the original passer from reclaiming while ball is moving fast. Only allows reclaim when ball has nearly stopped OR when a different player intercepts.

**Impact**:
- Passes and shots now complete their full trajectory
- Interceptions still work (different players can claim moving ball)
- Natural ball stops work (anyone can claim when friction stops the ball)

#### Issue 2: UI Flashing "Internal Server Error"

**Problem**: Game page repeatedly showed full-screen error message then went back to normal, making the game unplayable.

**Root Cause**: Any single transient error (MongoDB connection blip, SSE timeout) immediately showed full-screen error and discarded game state.

**Fix**: Implemented tiered error thresholds with graceful degradation:
- **1-2 errors**: Silent retry, game continues normally (invisible to users!)
- **3 consecutive errors**: Show yellow warning banner
- **5 consecutive errors**: Show full error page (genuine connection failure)
- **Success resets**: Any successful fetch resets error counters
- **Smart SSE handling**: SSE errors fall back to polling without showing banner
- **Last known state**: Keep displaying game during all reconnection attempts
- **Auto-recovery**: SSE auto-reconnects after 5 seconds

**Impact**:
- Single/transient errors are completely invisible to users
- Only persistent connection issues show warnings
- Smooth, professional experience even with network/server issues

### Changed

- Removed `game.lastUpdate = now` from `movePlayer()`, `passBall()`, `shoot()`, and `tackle()`
- Smart possession claim logic prevents passer from immediately reclaiming moving ball
- Complete rewrite of game page error handling with resilience
- Added connection status indicator to UI
- Implemented automatic SSE reconnection with fallback polling

### Added

- Ball speed check in possession claim logic (threshold: 0.5 pixels/tick)
- Player ID check to prevent passer reclaim while ball is moving
- Tiered error threshold system:
  - `WARNING_BANNER_THRESHOLD = 3` (show banner after 3 consecutive errors)
  - `MAX_CONSECUTIVE_ERRORS = 5` (show full error page after 5 consecutive errors)
- Connection status banner in game UI (only shown for persistent issues)
- Error counting with `useRef` hooks
- Success counter to clear error states
- SSE reconnection logic with 5-second retry
- Silent error recovery for transient issues
- Comprehensive documentation in `REALTIME_FIXES.md`

### Documentation

- Created `REALTIME_FIXES.md` with detailed problem analysis and solutions
- Updated README.md with critical issue summaries
- Added troubleshooting guides for both issues

---

## [1.2.0] - 2025-10-29

### Added - Configurable Player Speed

Players can now move at different speeds based on tactical needs!

#### Features

- **Base Speed Increased 5x**: From 4 to 20 pixels per simulation tick (50ms)
- **Custom Speed Per Move**: Optional `speed` parameter (min: 5, max: 50)
- **Speed Persistence**: Once set, custom speed persists until changed
- **Tactical Flexibility**: Different speeds for sprinting, positioning, shielding

#### Speed Examples

- **Sprint**: 40-50 pixels/tick (800-1000 pixels/second)
- **Normal**: 20 pixels/tick (400 pixels/second, default)
- **Tactical**: 10-15 pixels/tick (200-300 pixels/second)
- **Slow**: 5-8 pixels/tick (100-160 pixels/second)

#### API Changes

```javascript
// Move with default speed
POST /api/game/{id}/move
{"playerId": "...", "targetX": 600, "targetY": 400}

// Move with custom speed
POST /api/game/{id}/move
{"playerId": "...", "targetX": 600, "targetY": 400, "speed": 35}

// Response includes speed
{"success": true, "position": {...}, "targetPosition": {...}, "speed": 35}
```

### Changed

- `GAME_CONFIG.PLAYER_SPEED`: 4 → 20 (5x faster)
- Added `MIN_PLAYER_SPEED`: 5 pixels/tick
- Added `MAX_PLAYER_SPEED`: 50 pixels/tick
- Move endpoint now accepts optional `speed` parameter
- Move response includes `speed` field

### Added

- `speed` field to Player interface and schema
- Speed validation in `movePlayer()` function
- Speed parameter to move API endpoint
- Speed documentation in agent tools spec

### Documentation

- Updated README.md with speed configuration details
- Updated MOVEMENT_SYSTEM.md with configurable speed section
- Updated API_RESPONSE_FORMATS.md with speed examples
- Added tactical use cases for different speeds

---

## [1.1.0] - 2025-10-28

### Changed - Movement System Overhaul

**Breaking Change**: Movement behavior has been completely redesigned.

#### Old Behavior (v1.0.0)
- Move action moved player exactly 4 pixels per call
- Required hundreds of API calls to traverse the field
- Agents needed complex polling loops
- Movement appeared stuttery in UI

#### New Behavior (v1.1.0+)
- Move action sets a target position
- Player autonomously moves towards target
- Single API call for any distance
- Smooth, continuous movement in UI
- Ball automatically moves with player during possession

#### Migration Required

**Old code:**
```javascript
// v1.0.0 - Had to call repeatedly
while (distanceToTarget > 5) {
  await move(gameId, playerId, targetX, targetY);
  await sleep(100);
  perception = await getPerception(gameId, playerId);
  distanceToTarget = calculateDistance(perception.yourPlayer.position, target);
}
```

**New code:**
```javascript
// v1.1.0+ - One call
await move(gameId, playerId, targetX, targetY);
// Player moves automatically!
```

### Added

- `targetPosition` field to Player type
- Autonomous player movement in simulation loop
- Enhanced move response with `targetPosition` and `distance` fields
- Comprehensive movement system documentation in `MOVEMENT_SYSTEM.md`

### Improved

- **API Efficiency**: 99.3% reduction in API calls for long-distance movement
- **UI Smoothness**: Continuous movement instead of stuttering
- **Agent Simplicity**: Agents no longer need movement polling logic
- **Ball Handling**: Ball automatically follows player with possession
- **Performance**: Significantly fewer database updates

### Documentation

- Added movement system comparison in README.md
- Created detailed MOVEMENT_SYSTEM.md guide
- Updated API_RESPONSE_FORMATS.md with new move response format
- Added migration examples

---

## [1.0.0] - 2025-10-27

### Initial Release

#### Features
- Multi-instance 5v5 football game
- Real-time gameplay with SSE streaming
- AI agent perception system
- MongoDB-based game state persistence
- Canvas-based UI rendering
- Player roles: Goalkeeper, Defender, Midfielder, Striker
- Actions: Move, Pass, Shoot, Tackle
- Ball physics with velocity and friction
- Goal detection and scoring
- Configurable game rules (players per team, goals to win)

#### Technical Implementation
- Next.js 15 with App Router
- TypeScript with strict type checking
- Mongoose for MongoDB ODM
- Fixed timestep simulation (50ms)
- Server-Sent Events for real-time updates
- Atomic database operations for concurrency

#### Known Issues
- Movement required multiple API calls (fixed in v1.1.0)
- Mongoose nested object tracking required markModified() calls
- MongoDB connection issues with some Atlas configurations
