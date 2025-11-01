import { NextRequest, NextResponse } from "next/server";
import { passBall } from "@/lib/gameActions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { playerId, targetPlayerId, speed } = body;

    if (!playerId || !targetPlayerId) {
      return NextResponse.json(
        { success: false, message: "playerId and targetPlayerId are required" },
        { status: 400 }
      );
    }

    const result = await passBall(gameId, playerId, targetPlayerId, speed);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error("Error in pass:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

