import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/lib/gameLogic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const gameState = await getGameState(gameId);

    if (!gameState) {
      return NextResponse.json(
        { success: false, message: "Game not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, gameState });
  } catch (error) {
    console.error("Error getting game state:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

