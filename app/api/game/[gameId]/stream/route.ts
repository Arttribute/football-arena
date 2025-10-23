import { NextRequest } from "next/server";
import { getGameState } from "@/lib/gameLogic";

// Use Node.js runtime for MongoDB compatibility
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Initial snapshot
      try {
        const state = await getGameState(gameId);
        if (state) {
          controller.enqueue(
            encoder.encode(`event: init\ndata: ${JSON.stringify(state)}\n\n`)
          );
        } else {
          controller.enqueue(encoder.encode(`event: error\ndata: "game not found"\n\n`));
          controller.close();
          return;
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error\ndata: "init error"\n\n`));
        controller.close();
        return;
      }

      // Tick loop - send updates every 250ms
      const TICK_MS = 250;
      const MAX_DURATION_MS = 30000; // 30 seconds before reconnect
      const started = Date.now();

      async function loop() {
        if (closed) return;
        const elapsed = Date.now() - started;
        if (elapsed > MAX_DURATION_MS) {
          controller.close();
          return;
        }

        try {
          const state = await getGameState(gameId);
          if (state) {
            controller.enqueue(
              encoder.encode(`event: update\ndata: ${JSON.stringify(state)}\n\n`)
            );
            
            // Stop streaming if game is finished
            if (state.status === 'finished') {
              setTimeout(() => controller.close(), 5000); // Give 5s to see final state
              return;
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: "tick error"\n\n`));
        }

        setTimeout(loop, TICK_MS);
      }

      loop();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
    },
  });
}

