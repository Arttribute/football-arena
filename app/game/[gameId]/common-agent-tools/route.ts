import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const tools = [
    {
      name: "joinGame",
      description: "Join an existing game. You'll be assigned to a team and role.",
      apiSpec: {
        path: `/api/game/${gameId}/join`,
        method: "POST",
        baseUrl,
        headers: { "Content-Type": "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerName"],
        properties: {
          playerName: {
            type: "string",
            description: "Your name",
          },
          teamPreference: {
            type: "string",
            enum: ["A", "B"],
            description:
              "Preferred team (optional, auto-assigned if not specified)",
          },
          role: {
            type: "string",
            enum: ["goalkeeper", "defender", "midfielder", "striker"],
            description:
              "Preferred role (optional, auto-assigned if not specified)",
          },
        },
      },
    },
    {
      name: "getPerception",
      description:
        "Get your contextual perception of the game - where you are, where the ball is, teammates, opponents, and strategic recommendations. Use this to decide your next action.",
      apiSpec: {
        path: `/api/game/${gameId}/perception?playerId={playerId}`,
        method: "GET",
        baseUrl,
        headers: { Accept: "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerId"],
        properties: {
          playerId: {
            type: "string",
            description: "Your player ID",
          },
        },
      },
    },
    {
      name: "move",
      description: "Move your player towards a target position on the field. Player will automatically move to the target at their configured speed. Optionally set a custom speed for this movement (min: 5, max: 50, default: 20 pixels per 50ms tick).",
      apiSpec: {
        path: `/api/game/${gameId}/move`,
        method: "POST",
        baseUrl,
        headers: { "Content-Type": "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerId", "targetX", "targetY"],
        properties: {
          playerId: {
            type: "string",
            description: "Your player ID",
          },
          targetX: {
            type: "number",
            description: "Target X coordinate (0-1200)",
          },
          targetY: {
            type: "number",
            description: "Target Y coordinate (0-800)",
          },
          speed: {
            type: "number",
            description: "Optional custom movement speed in pixels per simulation step (min: 5, max: 50, default: 20). Higher values = faster movement.",
            minimum: 5,
            maximum: 50,
          },
        },
      },
    },
    {
      name: "pass",
      description:
        "Pass the ball to a teammate. You must have possession of the ball. Optionally set a custom ball speed (min: 5, max: 20, default: 12 pixels per 50ms tick).",
      apiSpec: {
        path: `/api/game/${gameId}/pass`,
        method: "POST",
        baseUrl,
        headers: { "Content-Type": "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerId", "targetPlayerId"],
        properties: {
          playerId: {
            type: "string",
            description: "Your player ID",
          },
          targetPlayerId: {
            type: "string",
            description: "ID of the teammate to pass to",
          },
          speed: {
            type: "number",
            description: "Optional custom pass speed in pixels per simulation step (min: 5, max: 20, default: 12). Higher values = faster pass.",
            minimum: 5,
            maximum: 20,
          },
        },
      },
    },
    {
      name: "shoot",
      description:
        "Shoot the ball towards the opponent's goal. You must have possession of the ball. Optionally set a custom shot speed (min: 10, max: 40, default: 25 pixels per 50ms tick).",
      apiSpec: {
        path: `/api/game/${gameId}/shoot`,
        method: "POST",
        baseUrl,
        headers: { "Content-Type": "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerId"],
        properties: {
          playerId: {
            type: "string",
            description: "Your player ID",
          },
          speed: {
            type: "number",
            description: "Optional custom shot speed in pixels per simulation step (min: 10, max: 40, default: 25). Higher values = faster shot.",
            minimum: 10,
            maximum: 40,
          },
        },
      },
    },
    {
      name: "tackle",
      description:
        "Attempt to tackle an opponent who has the ball. Must be within tackling distance.",
      apiSpec: {
        path: `/api/game/${gameId}/tackle`,
        method: "POST",
        baseUrl,
        headers: { "Content-Type": "application/json" },
      },
      parameters: {
        type: "object",
        required: ["playerId", "targetPlayerId"],
        properties: {
          playerId: {
            type: "string",
            description: "Your player ID",
          },
          targetPlayerId: {
            type: "string",
            description: "ID of the opponent to tackle",
          },
        },
      },
    },
    {
      name: "getGameState",
      description:
        "Get the full current state of the game including all players, ball position, and score.",
      apiSpec: {
        path: `/api/game/${gameId}/state`,
        method: "GET",
        baseUrl,
        headers: { Accept: "application/json" },
      },
      parameters: {
        type: "object",
        required: [],
        properties: {},
      },
    },
  ];

  return NextResponse.json(tools);
}
