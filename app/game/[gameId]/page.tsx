"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import GameCanvas from "@/components/GameCanvas";
import type { GameState } from "@/types/game";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameId}/state`);
      const data = await res.json();
      
      if (data.success) {
        setGameState(data.gameState);
        setError(null);
      } else {
        setError(data.message || "Failed to load game");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // Try SSE first
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(`/api/game/${gameId}/stream`);

      eventSource.addEventListener("init", (event) => {
        const state = JSON.parse(event.data);
        setGameState(state);
        setLoading(false);
      });

      eventSource.addEventListener("update", (event) => {
        const state = JSON.parse(event.data);
        setGameState(state);
      });

      eventSource.addEventListener("error", () => {
        eventSource?.close();
        // Fall back to polling
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchGameState, 1000);
        }
      });
    } catch (err) {
      // SSE not supported, use polling
      fallbackInterval = setInterval(fetchGameState, 1000);
      fetchGameState();
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [gameId, fetchGameState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
          <p className="mt-4 text-white text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">{error || "Game not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            ← Back to Games
          </button>
          <h1 className="text-3xl font-bold text-white">
            ⚽ Live Match
          </h1>
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>

        {/* Game Canvas */}
        <div className="mb-6">
          <GameCanvas gameState={gameState} />
        </div>

        {/* Team Rosters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team A */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-500 mb-4">
              Team A ({gameState.teamA.length} players)
            </h2>
            <div className="space-y-2">
              {gameState.teamA.map((player) => (
                <div
                  key={player.id}
                  className="flex justify-between items-center bg-gray-700 rounded p-3"
                >
                  <div>
                    <span className="text-white font-semibold">{player.name}</span>
                    <span className="text-gray-400 text-sm ml-2">({player.role})</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    ⚽ {player.stats.goals} | 🎯 {player.stats.assists}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-blue-500 mb-4">
              Team B ({gameState.teamB.length} players)
            </h2>
            <div className="space-y-2">
              {gameState.teamB.map((player) => (
                <div
                  key={player.id}
                  className="flex justify-between items-center bg-gray-700 rounded p-3"
                >
                  <div>
                    <span className="text-white font-semibold">{player.name}</span>
                    <span className="text-gray-400 text-sm ml-2">({player.role})</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    ⚽ {player.stats.goals} | 🎯 {player.stats.assists}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-sm">Status</div>
              <div className="text-lg font-semibold capitalize">{gameState.status}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Score</div>
              <div className="text-lg font-semibold">{gameState.score.teamA} - {gameState.score.teamB}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Goals to Win</div>
              <div className="text-lg font-semibold">{gameState.config.goalsToWin}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Players per Team</div>
              <div className="text-lg font-semibold">{gameState.config.playersPerTeam}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

