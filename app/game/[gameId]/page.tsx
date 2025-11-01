"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import GameCanvas from "@/components/GameCanvas";
import type { GameState } from "@/types/game";

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const errorCountRef = useRef<number>(0);
  const successCountRef = useRef<number>(0);
  const MAX_CONSECUTIVE_ERRORS = 5; // Show full error page after 5 consecutive failures
  const WARNING_BANNER_THRESHOLD = 3; // Show warning banner after 3 consecutive errors

  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameId}/state`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.gameState) {
        setGameState(data.gameState);
        errorCountRef.current = 0; // Reset error count on success
        successCountRef.current++;
        setIsConnected(true);

        // Clear any transient error after 2 successful fetches
        if (successCountRef.current >= 2) {
          setError(null);
        }
      } else {
        throw new Error(data.message || "Failed to load game");
      }
    } catch (err) {
      errorCountRef.current++;
      successCountRef.current = 0; // Reset success count on error
      console.error(`Error fetching game state (${errorCountRef.current}/${MAX_CONSECUTIVE_ERRORS}):`, err);

      // Only show warning banner after threshold of consecutive errors
      if (errorCountRef.current >= WARNING_BANNER_THRESHOLD) {
        setIsConnected(false);
      }

      // Only set full error state after more consecutive failures
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setError(err instanceof Error ? err.message : "Failed to connect to server");
      }
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // Try SSE first
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const setupSSE = () => {
      try {
        eventSource = new EventSource(`/api/game/${gameId}/stream`);

        eventSource.addEventListener("init", (event) => {
          try {
            const state = JSON.parse(event.data);
            setGameState(state);
            setLoading(false);
            setIsConnected(true);
            errorCountRef.current = 0;
            successCountRef.current++;
          } catch (e) {
            console.error("Error parsing SSE init:", e);
          }
        });

        eventSource.addEventListener("update", (event) => {
          try {
            const state = JSON.parse(event.data);
            setGameState(state);
            setIsConnected(true);
            errorCountRef.current = 0;
            successCountRef.current++;
          } catch (e) {
            console.error("Error parsing SSE update:", e);
          }
        });

        eventSource.addEventListener("error", (event) => {
          console.error("SSE error, falling back to polling");
          eventSource?.close();
          // Don't immediately show warning - let polling handle it
          // If polling succeeds, no banner. If polling fails 3+ times, banner shows.

          // Fall back to polling
          if (!fallbackInterval) {
            fallbackInterval = setInterval(fetchGameState, 1000);
            fetchGameState(); // Immediate fetch
          }

          // Try to reconnect SSE after 5 seconds
          reconnectTimeout = setTimeout(() => {
            console.log("Attempting to reconnect SSE...");
            if (fallbackInterval) {
              clearInterval(fallbackInterval);
              fallbackInterval = null;
            }
            setupSSE();
          }, 5000);
        });

        eventSource.addEventListener("open", () => {
          console.log("SSE connection established");
          setIsConnected(true);
        });

      } catch (err) {
        console.error("SSE not supported, using polling");
        // SSE not supported, use polling
        fallbackInterval = setInterval(fetchGameState, 1000);
        fetchGameState();
      }
    };

    setupSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
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

  // Only show error page if we have persistent errors AND no game state
  if (error && !gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">{error || "Game not found"}</p>
          <p className="text-gray-400 mb-6">Unable to load game after multiple attempts</p>
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

  // Show game even if there are transient errors (keeps showing last known state)
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-xl mb-4">Waiting for game data...</p>
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Connection Status Banner - Only show after persistent errors */}
        {!isConnected && (
          <div className="mb-4 bg-yellow-900/50 border border-yellow-600 rounded-lg p-3 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-yellow-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-yellow-200 text-sm">Experiencing connection issues, attempting to reconnect...</span>
          </div>
        )}

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
