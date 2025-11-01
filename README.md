# Football Arena - AI Agent Soccer Game

A real-time multi-instance 5v5 football/soccer game built with Next.js 15, TypeScript, MongoDB, and designed for AI agents to play autonomously while humans watch live.

## 🎯 Features

### Multi-Instance Architecture
- **Multiple concurrent games**: Unlike single-instance games, supports unlimited simultaneous matches
- **Configurable games**: Customize players per team (default 5) and goals to win (default 3)
- **Auto-team balancing**: Players are automatically assigned to teams

### Enhanced Agent Perception System
- **Contextual awareness**: Agents receive processed game context, not just raw state
- **Strategic recommendations**: AI-powered suggestions for optimal actions
- **Natural language descriptions**: LLM-friendly perception data including:
  - Your position, role, and ball possession status
  - Distances to ball, teammates, opponents, and goals
  - Pass targets with viability analysis
  - Shot opportunities and clear path detection
  - Tactical recommendations based on game state

### Real-Time Gameplay
- **SSE streaming**: Server-Sent Events for live updates to viewers
- **Smooth animations**: Canvas-based rendering with 60 FPS
- **Efficient polling**: Agents use perception endpoint for state + context in one call

### Game Mechanics
- **Roles**: Goalkeeper, Defender, Midfielder, Striker
- **Actions**: Move, Pass, Shoot, Tackle
- **Physics**: Ball velocity, friction, collision detection
- **Scoring**: First team to reach goal limit wins

### Movement System: Autonomous Navigation

**⚠️ Important Changes**

The movement system has been redesigned for better agent experience with configurable speed:

**OLD System (v1.0.0):**
- Move action moved player by exactly 4 pixels (PLAYER_SPEED)
- Required **multiple API calls** to reach distant positions
- Agent had to continuously poll and call move to traverse the field
- Example: Moving 600 pixels required ~150 API calls
- Felt "stuttery" and required complex agent logic

**NEW System (v1.1.0):**
- Move action sets a **target position**
- Player **autonomously moves** towards target at constant speed (4 pixels per 50ms simulation tick)
- **Single API call** to reach any position on the field

**NEW in v1.2.0 - Configurable Speed:**
- **Base speed increased 5x**: From 4 to 20 pixels per simulation tick (much faster!)
- **Custom speed per move**: Optional `speed` parameter (min: 5, max: 50)
- Players can move at different speeds based on tactical needs
- Speed persists across movement commands until changed

**How It Works:**
- Player continues moving automatically until:
  - ✅ Target is reached
  - ✅ New move command overrides the target
  - ✅ Game ends
- Movement is smooth and continuous in the UI
- Agent code is much simpler - just set destination and let physics handle it

**Why This Change?**

1. **Better UX**: Smooth, continuous movement visible in UI
2. **Simpler AI**: Agents don't need movement polling logic
3. **Fewer API Calls**: 1 call instead of hundreds for long distances
4. **More Realistic**: Real players run to a position, they don't teleport in tiny increments
5. **Better Performance**: Less network traffic and database updates

**Example:**

```bash
# Basic move - uses default speed (20 pixels per tick)
curl -X POST /api/game/{gameId}/move \
  -d '{"playerId": "...", "targetX": 600, "targetY": 400}'

# Response tells you the journey:
{
  "success": true,
  "position": { "x": 727, "y": 386 },      # Current position
  "targetPosition": { "x": 600, "y": 400 }, # Destination
  "distance": 142,                           # Distance to travel
  "speed": 20,                               # Movement speed
  "message": "Moving to (600, 400), distance: 142 pixels at speed 20"
}

# Move with custom speed (faster tactical sprint)
curl -X POST /api/game/{gameId}/move \
  -d '{"playerId": "...", "targetX": 600, "targetY": 400, "speed": 35}'

# Response with custom speed:
{
  "success": true,
  "position": { "x": 727, "y": 386 },
  "targetPosition": { "x": 600, "y": 400 },
  "distance": 142,
  "speed": 35,  # 75% faster than default!
  "message": "Moving to (600, 400), distance: 142 pixels at speed 35"
}

# Player automatically moves at specified speed every 50ms until reaching target
# You can watch it happen in the UI or via the perception endpoint
```

**For AI Agents:**
- Set a destination, then focus on other decisions (should I pass? shoot?)
- Check perception to see if you've reached your target
- Issue new move commands to change direction mid-journey
- Ball moves with you automatically if you have possession

## 🏗️ Technical Improvements Over Duel Game

### 1. Better Concurrency Control
- **Atomic operations**: Uses MongoDB's `findOneAndUpdate` instead of retry loops
- **Reduced race conditions**: Atomic updates eliminate most concurrency issues
- **Proper indexing**: MongoDB indexes on `gameId` and `status` for fast queries

### 2. Fixed Timestep Simulation
- **Consistent physics**: Game logic runs at fixed 50ms intervals
- **Frame-rate independent**: Physics behave the same regardless of server load
- **Predictable gameplay**: No tunneling or missed collisions

### 3. Enhanced Perception System
- **Contextual data**: Agents get processed information, not raw coordinates
- **Strategic AI**: Recommendations help LLMs make intelligent decisions
- **Distance calculations**: Pre-computed distances to all relevant entities
- **Path analysis**: Checks for clear shots and pass interception risks

### 4. Cleaner Architecture
- **Separation of concerns**: Logic, actions, perception, and DB in separate modules
- **Type safety**: Full TypeScript with strict types
- **Reusable functions**: Distance, normalization, and physics helpers

### 5. Optimized Real-Time Updates
- **Shorter SSE timeout**: 30s instead of 55s for faster reconnection
- **Adaptive streaming**: Stops streaming when game finishes
- **Efficient perception**: Single endpoint returns state + context for agents

## 📁 Project Structure

```
football-arena/
├── app/
│   ├── api/
│   │   ├── games/
│   │   │   ├── create/route.ts      # Create new game
│   │   │   └── list/route.ts        # List active games
│   │   └── game/[gameId]/
│   │       ├── join/route.ts        # Join game
│   │       ├── state/route.ts       # Get game state
│   │       ├── perception/route.ts  # Get agent perception
│   │       ├── move/route.ts        # Move player
│   │       ├── pass/route.ts        # Pass ball
│   │       ├── shoot/route.ts       # Shoot at goal
│   │       ├── tackle/route.ts      # Tackle opponent
│   │       └── stream/route.ts      # SSE stream
│   ├── game/[gameId]/
│   │   ├── common-agent-tools/route.ts  # Agent tools spec for game page
│   │   └── page.tsx                 # Game viewer page
│   ├── common-agent-tools/route.ts  # Agent tools spec for entry page
│   ├── page.tsx                     # Home page (game list)
│   ├── layout.tsx                   # Root layout
│   └── globals.css                  # Global styles
├── components/
│   └── GameCanvas.tsx               # Canvas rendering
├── lib/
│   ├── dbConnect.ts                 # MongoDB connection
│   ├── gameLogic.ts                 # Core game logic
│   ├── gameActions.ts               # Player actions
│   └── perception.ts                # Perception system
├── models/
│   └── GameState.ts                 # Mongoose model
├── types/
│   └── game.ts                      # TypeScript types
├── public/
│   └── (static assets)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)

### Installation

1. **Clone and install dependencies**:
```bash
cd football-arena
npm install
```

2. **Set up environment variables**:

Create a `.env.local` file:
```env
MONGODB_URI=mongodb://localhost:27017/football_arena
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/football_arena

NEXT_PUBLIC_BASE_URL=http://localhost:3000
# For production, set to your deployment URL
```

3. **Run development server**:
```bash
npm run dev
```

4. **Open browser**:
Navigate to `http://localhost:3000`

## 🎮 How to Play (for AI Agents)

### Agent Tools Pattern

AI agents interact with the application by fetching tool specifications from `common-agent-tools` endpoints for each page:

1. **Entry Page** (`/`): Fetch `/common-agent-tools` for tools to create games and list active games
2. **Game Page** (`/game/{gameId}`): Fetch `/game/{gameId}/common-agent-tools` for tools to join and play in a specific game

This pattern allows agents to dynamically discover available actions for each page they navigate to. The tools are co-located with the page routes as route handlers, not in the API directory or as static JSON files.

### 1. Create or Join a Game

**Create a new game**:
```bash
curl -X POST http://localhost:3000/api/games/create \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Agent1"}'
```

Response:
```json
{
  "success": true,
  "gameId": "uuid-here",
  "playerId": "player-uuid-here"
}
```

**Join an existing game**:
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/join \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Agent2", "teamPreference": "B"}'
```

### 2. Get Perception (Most Important!)

This endpoint provides everything an agent needs to make decisions:

```bash
curl "http://localhost:3000/api/game/{gameId}/perception?playerId={playerId}"
```

Response includes:
- **yourPlayer**: Your position, role, stats
- **ball**: Ball position, who has it, distance from you
- **teammates**: All teammates with distances, pass viability
- **opponents**: All opponents with distances, tackle opportunities
- **goals**: Your goal and opponent goal with distances and shot analysis
- **recommendations**: AI-generated action suggestions with reasons

### 3. Take Actions

**Move**:
```bash
# Move with default speed
curl -X POST http://localhost:3000/api/game/{gameId}/move \
  -H "Content-Type: application/json" \
  -d '{"playerId": "your-id", "targetX": 600, "targetY": 400}'

# Move with custom speed (optional)
curl -X POST http://localhost:3000/api/game/{gameId}/move \
  -H "Content-Type: application/json" \
  -d '{"playerId": "your-id", "targetX": 600, "targetY": 400, "speed": 30}'
```

Response:
```json
{
  "success": true,
  "position": { "x": 604, "y": 400 },
  "targetPosition": { "x": 600, "y": 400 },
  "distance": 4,
  "speed": 20,
  "message": "Moving to (600, 400), distance: 4 pixels at speed 20"
}
```

**Pass**:
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/pass \
  -H "Content-Type: application/json" \
  -d '{"playerId": "your-id", "targetPlayerId": "teammate-id"}'
```

Response:
```json
{
  "success": true,
  "message": "Passed to PlayerName",
  "ballVelocity": { "vx": 4.2, "vy": 1.8 }
}
```

**Shoot**:
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/shoot \
  -H "Content-Type": "application/json" \
  -d '{"playerId": "your-id"}'
```

Response:
```json
{
  "success": true,
  "message": "Shot towards goal!",
  "ballVelocity": { "vx": 8.5, "vy": 0.2 }
}
```

**Tackle**:
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/tackle \
  -H "Content-Type": "application/json" \
  -d '{"playerId": "your-id", "targetPlayerId": "opponent-id"}'
```

Response:
```json
{
  "success": true,
  "tackleSuccess": true,
  "message": "Tackle successful!",
  "ballIsFree": true
}
```

### 4. Agent Loop Example

```javascript
// Pseudocode for an AI agent
async function playGame(gameId, playerId) {
  while (true) {
    // Get perception
    const perception = await getPerception(gameId, playerId);
    
    // Check game status
    if (perception.gameState.status !== 'playing') {
      await sleep(1000);
      continue;
    }
    
    // Follow recommendation
    const action = perception.recommendations.action;
    
    if (action === 'shoot') {
      await shoot(gameId, playerId);
    } else if (action === 'pass' && perception.recommendations.passTargets) {
      const target = perception.recommendations.passTargets[0];
      await pass(gameId, playerId, target.playerId);
    } else if (action === 'move' && perception.recommendations.moveTarget) {
      await move(gameId, playerId, 
        perception.recommendations.moveTarget.x,
        perception.recommendations.moveTarget.y
      );
    } else if (action === 'tackle') {
      const opponent = perception.opponents.find(o => o.hasBall);
      if (opponent) await tackle(gameId, playerId, opponent.id);
    }
    
    await sleep(200); // Poll every 200ms
  }
}
```

## 🎨 UI for Human Viewers

### Home Page
- Grid of active games
- Create new game button
- Live score updates
- Game status indicators

### Game Viewer
- Full-screen canvas with football field
- Real-time player movements
- Ball physics visualization
- Team rosters with stats
- Score board and game info

## 🔧 Configuration

### Game Config
```typescript
{
  playersPerTeam: 5,    // Players per team (1-11)
  goalsToWin: 3         // Goals needed to win (1-10)
}
```

### Field Dimensions
- Width: 1200px
- Height: 800px
- Goal Width: 150px

### Movement Speed
- Default Speed: 20 pixels per simulation tick (50ms)
- Minimum Speed: 5 pixels per tick
- Maximum Speed: 50 pixels per tick
- Speed is configurable per move action

### Cooldowns
- Move: 100ms
- Pass: 500ms
- Shoot: 1000ms
- Tackle: 2000ms

## 🔨 Development Process & Troubleshooting

### Initial Setup Issues & Solutions

#### 1. Tailwind CSS v4 PostCSS Configuration
**Problem**: When starting the project, encountered an error:
```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin.
The PostCSS plugin has moved to a separate package...
```

**Root Cause**: Tailwind CSS v4 moved the PostCSS plugin to a separate package `@tailwindcss/postcss`, but the configuration was still referencing the old `tailwindcss` plugin.

**Solution**: Updated `postcss.config.mjs`:
```javascript
// Before
const config = {
  plugins: {
    tailwindcss: {},
  },
};

// After
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**Key Learning**: Always check for breaking changes when upgrading major versions. Tailwind CSS v4 requires the new `@tailwindcss/postcss` package for PostCSS integration.

#### 2. Mongoose Duplicate Index Warnings
**Problem**: Console flooded with warnings on every request:
```
[MONGOOSE] Warning: Duplicate schema index on {"gameId":1} found.
This is often due to declaring an index using both "index: true" and "schema.index()".
```

**Root Cause**: The `GameState` model had duplicate index definitions:
- Inline index on field definition: `gameId: { type: String, index: true }`
- Schema-level index: `GameStateSchema.index({ gameId: 1 })`

Both approaches created an index on the same field, causing Mongoose to warn about duplication.

**Solution**: Removed inline index declarations and kept only schema-level indexes in `models/GameState.ts`:
```typescript
// Before
const GameStateSchema = new Schema({
  gameId: { type: String, required: true, unique: true, index: true }, // ❌ Inline
  status: { type: String, enum: [...], index: true }, // ❌ Inline
  // ...
});
GameStateSchema.index({ gameId: 1 }, { unique: true }); // ❌ Duplicate
GameStateSchema.index({ status: 1, createdAt: -1 });

// After
const GameStateSchema = new Schema({
  gameId: { type: String, required: true }, // ✅ No inline index
  status: { type: String, enum: [...] }, // ✅ No inline index
  // ...
});
GameStateSchema.index({ gameId: 1 }, { unique: true }); // ✅ Schema-level only
GameStateSchema.index({ status: 1, createdAt: -1 }); // ✅ Compound index
```

**Key Learning**: Choose one indexing approach for Mongoose schemas:
- **Recommended**: Schema-level indexes (`.index()`) - more flexible, supports compound indexes
- **Alternative**: Inline indexes on field definitions - simpler for basic single-field indexes
- **Never**: Mix both approaches on the same field

**Impact**: Eliminated console spam while maintaining database performance. The realtime functionality continues to work perfectly as indexes are still properly defined.

### Best Practices Established

1. **PostCSS Configuration**: Always use package-specific PostCSS plugins for v4+ frameworks
2. **Mongoose Indexing**: Define indexes at schema level for better control and compound index support
3. **Error Investigation**: Read error messages carefully - they often contain the exact solution
4. **Atomic Operations**: Use `findOneAndUpdate` with optimistic locking for concurrent game state updates
5. **Real-time Updates**: SSE with 30s timeout provides responsive streaming without overwhelming the server

## ⚠️ Common Pitfalls & How to Avoid Them

When developing similar real-time multiplayer games with MongoDB/Mongoose, watch out for these issues:

### Critical Issue: Mongoose Nested Object Updates

**Problem**: Game actions (move, pass, shoot, tackle) return `{"success": true}` but changes don't appear in the UI or perception API.

**Root Cause**: Mongoose doesn't automatically detect changes to nested object properties or array elements. When you modify:
- `player.position.x` or `player.position.y`
- `ball.velocity.vx` or `ball.velocity.vy`
- Items within arrays like `teamA` or `teamB`

Mongoose won't know these changed unless you explicitly tell it.

**The Bug**:
```javascript
// ❌ WRONG - Changes won't be saved!
const game = await GameStateModel.findOne({ gameId });
const player = game.teamA[0];
player.position.x = 100;  // Mongoose doesn't detect this change
await game.save();        // Position is NOT saved to database
```

**The Fix**:
```javascript
// ✅ CORRECT - Use markModified()
const game = await GameStateModel.findOne({ gameId });
const player = game.teamA[0];
player.position.x = 100;
game.markModified('teamA');  // Tell Mongoose this array changed
await game.save();           // Now it saves correctly!
```

**Where to Apply**:
1. **Player movements**: `game.markModified('teamA')` or `game.markModified('teamB')`
2. **Ball updates**: `game.markModified('ball')` or `game.markModified('ball.position')`
3. **Stats changes**: `game.markModified('teamA')` when updating `player.stats.goals`
4. **Any array modification**: Always mark the array as modified

**Real Example from This Project**:
```javascript
// In lib/gameActions.ts - movePlayer function
export async function movePlayer(gameId: string, playerId: string, targetX: number, targetY: number) {
  const game = await GameStateModel.findOne({ gameId });
  const player = [...game.teamA, ...game.teamB].find(p => p.id === playerId);

  // Update position
  player.position.x = newX;
  player.position.y = newY;

  // ✅ CRITICAL: Mark as modified
  game.markModified('teamA');
  game.markModified('teamB');

  await game.save();  // Now changes are actually saved!
}
```

**Symptoms of This Bug**:
- API returns success but nothing happens in the UI
- Database shows old values after "successful" updates
- SSE stream doesn't send updated state
- Perception API returns stale data
- Players appear frozen despite move commands

**Prevention**:
- Always call `markModified()` after modifying nested objects
- Test your actions in the UI, not just via API responses
- Check the database directly to verify changes are persisted
- Add `markModified()` calls to all game logic and action functions

**Files to Check**:
- `lib/gameActions.ts` - All player action functions
- `lib/gameLogic.ts` - Game simulation and physics
- Any file that modifies game state nested properties

**Further Reading**:
- [Mongoose markModified() docs](https://mongoosejs.com/docs/api/document.html#Document.prototype.markModified())
- See `GAME_FIX_SUMMARY.md` for detailed fix documentation

### Critical Issue: Ball Not Moving After Pass/Shoot (v1.2.1)

**Problem**: Pass/shoot endpoints return success with ball velocity, but ball doesn't move in UI.

**Root Cause**: Action functions were setting `game.lastUpdate = now` which prevented the simulation from running for the next 50ms. The ball had velocity but position didn't update.

**The Fix**:
```javascript
// ❌ WRONG - Prevents simulation
game.ball.velocity = { vx: 6, vy: 0 };
game.lastUpdate = now;  // This breaks it!
await game.save();

// ✅ CORRECT - Let simulation handle lastUpdate
game.ball.velocity = { vx: 6, vy: 0 };
game.version++;
// Don't set lastUpdate - simulation will update it
await game.save();
```

**Impact**: Ball now moves immediately after pass/shoot actions. See [REALTIME_FIXES.md](./REALTIME_FIXES.md) for complete details.

### Critical Issue: Ball Returning to Passer (v1.2.1)

**Problem**: Ball moves slightly toward recipient then immediately returns to the passer. Ball never reaches its target.

**Root Cause**: Passer remained within possession distance (25 pixels) and immediately reclaimed the ball on the next tick, stopping its movement.

**The Fix**:
```javascript
// Smart possession claim - prevent passer from immediately reclaiming
const canClaim = dist <= POSSESSION_DISTANCE &&
                (ballSpeed <= 0.5 ||  // Ball nearly stopped, OR
                 player.id !== lastTouchPlayerId);  // Different player (interception)
```

**Impact**:
- Passes and shots now complete their full trajectory
- Interceptions still work (different players can claim moving ball)
- Natural ball stops work (anyone can claim when ball friction stops it)

See [REALTIME_FIXES.md](./REALTIME_FIXES.md) for complete details.

### Critical Issue: UI Flashing "Internal Server Error" (v1.2.1)

**Problem**: Game page repeatedly flashes error message then goes back to normal, making it unplayable.

**Root Cause**: Any single transient error (MongoDB connection blip, SSE timeout) immediately showed full-screen error, discarding the game state.

**The Fix - Tiered Error Thresholds**:
- 1-2 errors: Silent retry, game continues normally (invisible to users!)
- 3 consecutive errors: Show yellow warning banner
- 5 consecutive errors: Show full error page (genuine failure)
- Success resets counters immediately
- SSE errors fall back to polling without showing banner

**Impact**:
- Single/transient errors are completely invisible - game just works
- Only persistent connection issues show warnings
- Smooth, professional experience even with network/server issues

See [REALTIME_FIXES.md](./REALTIME_FIXES.md) for implementation details.

## 📊 MongoDB Schema

```javascript
{
  _id: "gameId",
  gameId: "uuid",
  status: "waiting|countdown|playing|finished",
  config: {
    playersPerTeam: 5,
    goalsToWin: 3
  },
  teamA: [Player],
  teamB: [Player],
  ball: {
    position: { x, y },
    velocity: { vx, vy },
    possessionPlayerId: "uuid"
  },
  score: { teamA: 0, teamB: 0 },
  winner: "A|B",
  version: 0,
  createdAt: timestamp,
  lastUpdate: timestamp
}
```

## 🚢 Deployment

### Vercel Deployment

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Add environment variables**:
   - `MONGODB_URI`
4. **Deploy**

### Environment Variables

```env
MONGODB_URI=your-mongodb-connection-string
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

Make sure to set `NEXT_PUBLIC_BASE_URL` to your production URL so agent tools have the correct base URL.

## 🎯 API Endpoints Summary

### Agent Tool Discovery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/common-agent-tools` | GET | Entry page tools (create game, list games) |
| `/game/[gameId]/common-agent-tools` | GET | Game page interaction tools (join, play, etc.) |

### Game Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/games/create` | POST | Create new game |
| `/api/games/list` | GET | List active games |
| `/api/game/[gameId]/join` | POST | Join game |
| `/api/game/[gameId]/state` | GET | Get game state |
| `/api/game/[gameId]/perception` | GET | Get agent perception |
| `/api/game/[gameId]/stream` | GET | SSE stream |

### Player Actions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/game/[gameId]/move` | POST | Move player |
| `/api/game/[gameId]/pass` | POST | Pass ball |
| `/api/game/[gameId]/shoot` | POST | Shoot at goal |
| `/api/game/[gameId]/tackle` | POST | Tackle opponent |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use for learning, experiments, or as a starter template.

## 🙏 Acknowledgments

Inspired by the duel-game architecture, with significant improvements in:
- Multi-instance support
- Perception system for AI agents
- Atomic database operations
- Fixed timestep physics
- Cleaner code architecture

