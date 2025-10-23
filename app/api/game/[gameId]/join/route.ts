import { NextRequest, NextResponse } from "next/server";
import { joinGame } from "@/lib/gameLogic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { playerName, teamPreference, role } = body;

    if (!playerName) {
      return NextResponse.json(
        { success: false, message: "Player name is required" },
        { status: 400 }
      );
    }

    const result = await joinGame(gameId, playerName, teamPreference, role);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error("Error in join game:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

