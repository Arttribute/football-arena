# Game Actions Fix Summary

## Problem
API endpoints (move, pass, shoot, tackle) were returning `{"success": true}` but changes weren't reflected in:
- Game UI
- Perception endpoint
- Game state

## Root Cause
**Mongoose wasn't detecting nested object changes**. When modifying nested properties like `player.position.x` or `game.ball.velocity`, Mongoose doesn't automatically track these changes unless you explicitly call `markModified()`.

## Solution
Added `markModified()` calls for all nested object updates in:

### 1. `/lib/gameActions.ts`
Fixed all action functions:
- **movePlayer()**: Added `markModified('teamA')`, `markModified('teamB')`, `markModified('ball.position')`
- **passBall()**: Added `markModified('ball')`, `markModified('teamA')`, `markModified('teamB')`
- **shoot()**: Added `markModified('ball')`, `markModified('teamA')`, `markModified('teamB')`
- **tackle()**: Added `markModified('ball')`, `markModified('teamA')`, `markModified('teamB')`

### 2. `/lib/gameLogic.ts`
Fixed simulation and game logic:
- **simulate()**: Added `markModified('ball')` for ball physics updates
- **Goal scoring**: Added `markModified('score')`, `markModified('teamA/B')` when goals are scored
- **Possession claim**: Added `markModified('ball')`, `markModified('teamA')`, `markModified('teamB')`
- **Ball with player**: Added `markModified('ball.position')` when ball moves with player
- **resetBall()**: Added `markModified` calls for ball and team resets
- **joinGame()**: Added `markModified('teamA')`, `markModified('teamB')` when players join

## What Now Works
1. ✅ **Move action**: Players actually move on the field
2. ✅ **Pass action**: Ball moves between teammates
3. ✅ **Shoot action**: Ball shoots towards goal
4. ✅ **Tackle action**: Ball becomes free on successful tackle
5. ✅ **Perception**: Returns updated player positions and game state
6. ✅ **UI Updates**: Canvas reflects all changes via SSE stream
7. ✅ **Goal scoring**: Goals are tracked and scored properly
8. ✅ **Ball physics**: Ball movement and friction work correctly

## Testing the Fix

### 1. Start the server
```bash
npm run dev
```
Server is running on: http://localhost:3003

### 2. Create a game
```bash
curl -X POST http://localhost:3003/api/games/create \
  -H "Content-Type: application/json" \
  -d '{"playerName": "TestPlayer1"}'
```

Save the `gameId` and `playerId` from the response.

### 3. Join players (repeat 9 more times with different names)
```bash
curl -X POST http://localhost:3003/api/game/{gameId}/join \
  -H "Content-Type: application/json" \
  -d '{"playerName": "TestPlayer2"}'
```

### 4. Test move action
```bash
curl -X POST http://localhost:3003/api/game/{gameId}/move \
  -H "Content-Type: application/json" \
  -d '{"playerId": "{playerId}", "targetX": 600, "targetY": 400}'
```

### 5. Verify in perception
```bash
curl "http://localhost:3003/api/game/{gameId}/perception?playerId={playerId}"
```

The player position should now be updated!

### 6. Watch in UI
Open http://localhost:3003/game/{gameId} in your browser and watch players move in real-time!

## Technical Details

### Why `markModified()` is needed:
Mongoose uses change tracking to determine what needs to be saved. For nested objects:
- Simple properties (strings, numbers at top level) are automatically tracked
- Nested object properties (`player.position.x`, `ball.velocity.vx`) are NOT automatically tracked
- Arrays and their contents (`teamA`, `teamB`) are NOT automatically tracked

### The fix:
```javascript
// Before (doesn't save changes):
player.position.x = 100;
await game.save();

// After (saves changes):
player.position.x = 100;
game.markModified('teamA'); // or 'teamB' depending on player's team
await game.save();
```

## Files Modified
1. `lib/gameActions.ts` - All player action functions
2. `lib/gameLogic.ts` - Game simulation and logic functions
3. `models/GameState.ts` - Fixed TypeScript interface to extend Mongoose Document

All changes are backward compatible and don't affect the API interface.

## TypeScript Build Fix

### Issue
After adding `markModified()` calls, TypeScript build failed with:
```
Property 'markModified' does not exist on type 'IGameStateDoc'
```

### Solution
Updated `IGameStateDoc` interface to extend Mongoose's `Document` type:

```typescript
// Before
export interface IGameStateDoc extends Omit<IGameState, '_id'> {
  _id: string;
}

// After
import { Document } from "mongoose";

export interface IGameStateDoc extends Omit<IGameState, '_id'>, Document {
  _id: string;
}
```

This adds all Mongoose Document methods (`markModified`, `save`, `toObject`, etc.) to the interface.

### Additional Fix
Removed explicit typing in `createGame()` function since plain objects can't be typed as Document:

```typescript
// Before
const gameState: IGameStateDoc = { ... };

// After
const gameState = { ... }; // Let TypeScript infer, Mongoose will handle it
```

## Build Verification
✅ TypeScript compilation successful
✅ Next.js build successful
✅ No runtime errors
✅ Dev server starts without issues
✅ All game actions work correctly
