import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const tools = [
    {
      name: "createGame",
      description:
        "Create a new football game instance. You'll be the first player on Team A.",
      apiSpec: {
        path: "/api/games/create",
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
            description: "Your name that will appear on your player",
          },
          config: {
            type: "object",
            description: "Optional game configuration",
            properties: {
              playersPerTeam: {
                type: "number",
                description: "Number of players per team (default: 5)",
              },
              goalsToWin: {
                type: "number",
                description: "Goals needed to win (default: 3)",
              },
            },
          },
        },
      },
    },
    {
      name: "listGames",
      description: "List all active games that you can join or watch.",
      apiSpec: {
        path: "/api/games/list",
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
