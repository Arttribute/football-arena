"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { GameState } from "@/types/game";

export default function Home() {
  const [games, setGames] = useState<GameState[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchGames() {
    try {
      const res = await fetch("/api/games/list");
      const data = await res.json();
      if (data.success) {
        setGames(data.games);
      }
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createGame() {
    if (!playerName.trim()) {
      alert("Please enter your name");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = `/game/${data.gameId}?playerId=${data.playerId}`;
      } else {
        alert(data.message || "Failed to create game");
      }
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game");
    } finally {
      setCreating(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "waiting": return "bg-yellow-500";
      case "countdown": return "bg-orange-500";
      case "playing": return "bg-green-500";
      case "finished": return "bg-gray-500";
      default: return "bg-gray-400";
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case "waiting": return "Waiting for Players";
      case "countdown": return "Starting Soon";
      case "playing": return "In Progress";
      case "finished": return "Finished";
      default: return status;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            ⚽ Football Arena
          </h1>
          <p className="text-xl text-gray-600">
            AI Agent Soccer - Watch live 5v5 matches
          </p>
        </div>

        {/* Create Game Section */}
        <div className="max-w-2xl mx-auto mb-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Create New Game</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createGame()}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={createGame}
              disabled={creating}
              className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {creating ? "Creating..." : "Create Game"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Create a game and you'll be the first player. Others can join to start the match!
          </p>
        </div>

        {/* Active Games List */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Active Games</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <p className="mt-4 text-gray-600">Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-xl text-gray-600">No active games. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <Link
                  key={game.gameId}
                  href={`/game/${game.gameId}`}
                  className="block bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${getStatusColor(game.status)}`}>
                        {getStatusText(game.status)}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {game.config.playersPerTeam}v{game.config.playersPerTeam}
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center text-2xl font-bold">
                        <span className="text-red-600">Team A</span>
                        <span className="text-gray-800">{game.score.teamA} - {game.score.teamB}</span>
                        <span className="text-blue-600">Team B</span>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-gray-600 mb-4">
                      <span>{game.teamA.length} players</span>
                      <span>{game.teamB.length} players</span>
                    </div>

                    {game.status === "waiting" && (
                      <div className="text-sm text-gray-500">
                        Waiting for {(game.config.playersPerTeam * 2) - (game.teamA.length + game.teamB.length)} more players
                      </div>
                    )}

                    {game.winner && (
                      <div className="text-center py-2 bg-yellow-100 rounded text-yellow-800 font-semibold">
                        🏆 Team {game.winner} Wins!
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-6 py-3 text-center text-green-600 font-semibold hover:bg-gray-100 transition">
                    Watch Live →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

