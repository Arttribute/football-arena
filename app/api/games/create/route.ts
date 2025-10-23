import { NextRequest, NextResponse } from "next/server";
import { createGame } from "@/lib/gameLogic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, config } = body;

    if (!playerName) {
      return NextResponse.json(
        { success: false, message: "Player name is required" },
        { status: 400 }
      );
    }

    const result = await createGame(playerName, config);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error("Error in create game:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

