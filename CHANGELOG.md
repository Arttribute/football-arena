# Changelog

All notable changes to Football Arena will be documented in this file.

## [1.2.1] - 2025-10-29

### Fixed - Real-Time Game State Issues

Critical fixes for ball physics and error handling that were preventing proper gameplay.

#### Issue 1: Ball Not Moving After Pass/Shoot

**Problem**: Pass and shoot actions returned success with ball velocity, but the ball didn't actually move in the UI or game state.

**Root Cause**: Action functions were setting `game.lastUpdate = now` which prevented the simulation from running for the next 50ms. The ball had velocity but no position updates.

**Fix**: Removed `lastUpdate` assignments from all action functions. Only the simulation loop updates `lastUpdate` now.

**Impact**: Ball now moves immediately after pass/shoot actions.

#### Issue 2: UI Flashing "Internal Server Error"

**Problem**: Game page repeatedly showed full-screen error message then went back to normal, making the game unplayable.

**Root Cause**: Any single transient error (MongoDB connection blip, SSE timeout) immediately showed full-screen error and discarded game state.

**Fix**: Implemented graceful degradation:
- Error counting: Only show error after 5 consecutive failures
- Last known state: Keep displaying game during reconnection
- Visual feedback: Yellow warning banner instead of full-screen error
- Auto-recovery: SSE auto-reconnects after 5 seconds
- Polling fallback: Switches to polling on SSE errors

**Impact**: Smooth, professional experience even with network/server issues.

### Changed

- Removed `game.lastUpdate = now` from `movePlayer()`, `passBall()`, `shoot()`, and `tackle()`
- Complete rewrite of game page error handling with resilience
- Added connection status indicator to UI
- Implemented automatic SSE reconnection with fallback polling

### Added

- Connection status banner in game UI
- Error counting with `useRef` hooks
- SSE reconnection logic with 5-second retry
- Graceful error recovery without breaking UI
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
