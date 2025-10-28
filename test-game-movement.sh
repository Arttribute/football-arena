#!/bin/bash

# Test script to verify game movement works
# Usage: ./test-game-movement.sh

BASE_URL="http://localhost:3000"

echo "=== Testing Game Movement ==="
echo ""

# Step 1: Create a game
echo "1. Creating game..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/games/create" \
  -H "Content-Type: application/json" \
  -d '{"playerName": "TestPlayer1"}')

echo "Create response: $CREATE_RESPONSE"
echo ""

GAME_ID=$(echo $CREATE_RESPONSE | grep -o '"gameId":"[^"]*"' | cut -d'"' -f4)
PLAYER_ID=$(echo $CREATE_RESPONSE | grep -o '"playerId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$GAME_ID" ]; then
  echo "ERROR: Failed to create game"
  exit 1
fi

echo "Game ID: $GAME_ID"
echo "Player ID: $PLAYER_ID"
echo ""

# Step 2: Join more players to start the game
echo "2. Joining players..."
for i in {2..10}; do
  curl -s -X POST "$BASE_URL/api/game/$GAME_ID/join" \
    -H "Content-Type: application/json" \
    -d "{\"playerName\": \"TestPlayer$i\"}" > /dev/null
  echo "   Joined player $i"
done
echo ""

# Wait for game to start
echo "3. Waiting for game to start (countdown)..."
sleep 4
echo ""

# Step 4: Get initial state
echo "4. Getting initial game state..."
INITIAL_STATE=$(curl -s "$BASE_URL/api/game/$GAME_ID/state")
echo "Initial state (first 200 chars): ${INITIAL_STATE:0:200}..."
echo ""

# Step 5: Move player
echo "5. Moving player to position (600, 400)..."
MOVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/game/$GAME_ID/move" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\": \"$PLAYER_ID\", \"targetX\": 600, \"targetY\": 400}")

echo "Move response: $MOVE_RESPONSE"
echo ""

# Step 6: Get updated state
echo "6. Getting updated game state..."
sleep 1
UPDATED_STATE=$(curl -s "$BASE_URL/api/game/$GAME_ID/state")
echo "Updated state (first 200 chars): ${UPDATED_STATE:0:200}..."
echo ""

# Step 7: Get perception
echo "7. Getting perception for player..."
PERCEPTION=$(curl -s "$BASE_URL/api/game/$GAME_ID/perception?playerId=$PLAYER_ID")
echo "Perception (first 300 chars): ${PERCEPTION:0:300}..."
echo ""

echo "=== Test Complete ==="
echo "Check the game UI at: $BASE_URL/game/$GAME_ID"
echo ""
echo "Manual test commands:"
echo "  Move again:  curl -X POST '$BASE_URL/api/game/$GAME_ID/move' -H 'Content-Type: application/json' -d '{\"playerId\": \"$PLAYER_ID\", \"targetX\": 700, \"targetY\": 500}'"
echo "  Get state:   curl '$BASE_URL/api/game/$GAME_ID/state'"
echo "  Perception:  curl '$BASE_URL/api/game/$GAME_ID/perception?playerId=$PLAYER_ID'"
