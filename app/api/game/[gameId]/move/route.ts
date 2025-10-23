import { NextRequest, NextResponse } from "next/server";
import { movePlayer } from "@/lib/gameActions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { playerId, targetX, targetY } = body;

    if (!playerId || targetX === undefined || targetY === undefined) {
      return NextResponse.json(
        { success: false, message: "playerId, targetX, and targetY are required" },
        { status: 400 }
      );
    }

    const result = await movePlayer(gameId, playerId, targetX, targetY);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error("Error in move:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

