import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/lib/gameLogic";
import { generatePerception } from "@/lib/perception";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      return NextResponse.json(
        { success: false, message: "playerId query parameter is required" },
        { status: 400 }
      );
    }

    const gameState = await getGameState(gameId);

    if (!gameState) {
      return NextResponse.json(
        { success: false, message: "Game not found" },
        { status: 404 }
      );
    }

    const perception = generatePerception(gameState, playerId);

    if (!perception) {
      return NextResponse.json(
        { success: false, message: "Player not found in game" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, perception });
  } catch (error) {
    console.error("Error generating perception:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

