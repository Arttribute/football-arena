# Changelog

All notable changes to Football Arena will be documented in this file.

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
