import { NextResponse } from "next/server";
import { listActiveGames } from "@/lib/gameLogic";

export async function GET() {
  try {
    const games = await listActiveGames();
    return NextResponse.json({ success: true, games });
  } catch (error) {
    console.error("Error listing games:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

