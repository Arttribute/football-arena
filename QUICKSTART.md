# Football Arena - Quick Start Guide

Get your football arena up and running in 5 minutes!

## 📦 Installation

### Step 1: Extract and Install

```bash
# Extract the project
tar -xzf football-arena.tar.gz
cd football-arena

# Install dependencies
npm install
```

### Step 2: Set Up MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB (if not already installed)
# macOS:
brew install mongodb-community

# Ubuntu/Debian:
sudo apt-get install mongodb

# Start MongoDB
mongod --dbpath=/path/to/data
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string

### Step 3: Configure Environment

Create `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/football_arena
# Or for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/football_arena

NEXT_PUBLIC_BASE_URL=http://localhost:3000
# For production, set to your deployment URL
```

### Step 4: Run the Server

```bash
npm run dev
```

Open http://localhost:3000 🎉

## 🤖 Testing with AI Agents

### Agent Tools Pattern

AI agents discover available actions by fetching tool specifications from `common-agent-tools` endpoints for each page:

1. **Entry Page Tools**: Fetch `/common-agent-tools` for navigation (create/list games)
2. **Game Page Tools**: Fetch `/game/{gameId}/common-agent-tools` for game interactions (join, move, pass, shoot, etc.)

This pattern allows agents to dynamically discover what actions they can take on each page they visit. Tools are served as route handlers, not static JSON files.

### Create a Game

```bash
curl -X POST http://localhost:3000/api/games/create \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Agent1"}'
```

Save the `gameId` and `playerId` from the response.

### Join the Game (as another agent)

```bash
curl -X POST http://localhost:3000/api/game/{gameId}/join \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Agent2"}'
```

Repeat until you have 10 players (5 per team). The game will auto-start!

### Get Perception

```bash
curl "http://localhost:3000/api/game/{gameId}/perception?playerId={playerId}"
```

### Take Actions

**Move:**
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/move \
  -H "Content-Type: application/json" \
  -d '{"playerId": "{playerId}", "targetX": 600, "targetY": 400}'
```

**Shoot:**
```bash
curl -X POST http://localhost:3000/api/game/{gameId}/shoot \
  -H "Content-Type": "application/json" \
  -d '{"playerId": "{playerId}"}'
```

## 🎮 Simple Agent Script

Create `agent.js`:

```javascript
const gameId = "your-game-id";
const playerId = "your-player-id";
const baseUrl = "http://localhost:3000";

async function playLoop() {
  while (true) {
    // Get perception
    const res = await fetch(
      `${baseUrl}/api/game/${gameId}/perception?playerId=${playerId}`
    );
    const { perception } = await res.json();

    if (perception.gameState.status !== "playing") {
      await sleep(1000);
      continue;
    }

    // Follow recommendation
    const action = perception.recommendations.action;

    if (action === "shoot") {
      await fetch(`${baseUrl}/api/game/${gameId}/shoot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } else if (action === "pass") {
      const target = perception.recommendations.passTargets[0];
      await fetch(`${baseUrl}/api/game/${gameId}/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, targetPlayerId: target.playerId }),
      });
    } else if (action === "move") {
      const { x, y } = perception.recommendations.moveTarget;
      await fetch(`${baseUrl}/api/game/${gameId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, targetX: x, targetY: y }),
      });
    }

    await sleep(200);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

playLoop();
```

Run it:
```bash
node agent.js
```

## 🌐 Watch Live

Open http://localhost:3000 in your browser to see the game list and click on any game to watch it live!

## 🚀 Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables:
   - `MONGODB_URI`
   - `NEXT_PUBLIC_BASE_URL` (your deployment URL)
4. Deploy!

## 📚 Next Steps

- Read `README.md` for full documentation
- Check `TECHNICAL_IMPROVEMENTS.md` for architecture details
- Fetch `/common-agent-tools` for entry page navigation tools
- Fetch `/game/{gameId}/common-agent-tools` for game page interaction tools
- Customize game config (players per team, goals to win)

## 🐛 Troubleshooting

**MongoDB connection error:**
- Check if MongoDB is running
- Verify connection string in `.env.local`

**Port 3000 already in use:**
```bash
npm run dev -- -p 3001
```

**Module not found errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## 💡 Tips

- Always fetch `common-agent-tools` for each page to discover available actions
- Tools are served dynamically as route handlers with correct base URLs
- Use `getPerception` endpoint - it has everything agents need!
- Start with simple agents that follow recommendations
- Watch games in browser while agents play
- Check cooldowns - actions have rate limits
- Multiple games can run simultaneously

Happy coding! ⚽🤖

