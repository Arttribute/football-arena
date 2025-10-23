"use client";

import { useEffect, useRef } from "react";
import type { GameState, Player } from "@/types/game";
import { GAME_CONFIG } from "@/types/game";

interface GameCanvasProps {
  gameState: GameState;
}

export default function GameCanvas({ gameState }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT);

    // Draw field
    drawField(ctx);

    // Draw players
    gameState.teamA.forEach(player => drawPlayer(ctx, player, "#EF4444")); // Red
    gameState.teamB.forEach(player => drawPlayer(ctx, player, "#3B82F6")); // Blue

    // Draw ball
    drawBall(ctx, gameState.ball.position.x, gameState.ball.position.y);

    // Draw status
    drawStatus(ctx, gameState);
  }, [gameState]);

  function drawField(ctx: CanvasRenderingContext2D) {
    // Grass background
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.FIELD_HEIGHT);
    gradient.addColorStop(0, "#22C55E");
    gradient.addColorStop(1, "#16A34A");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_CONFIG.FIELD_WIDTH, GAME_CONFIG.FIELD_HEIGHT);

    // Field lines
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;

    // Border
    ctx.strokeRect(10, 10, GAME_CONFIG.FIELD_WIDTH - 20, GAME_CONFIG.FIELD_HEIGHT - 20);

    // Center line
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.FIELD_WIDTH / 2, 10);
    ctx.lineTo(GAME_CONFIG.FIELD_WIDTH / 2, GAME_CONFIG.FIELD_HEIGHT - 10);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(GAME_CONFIG.FIELD_WIDTH / 2, GAME_CONFIG.FIELD_HEIGHT / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Goals
    const goalY = GAME_CONFIG.FIELD_HEIGHT / 2 - GAME_CONFIG.GOAL_WIDTH / 2;
    
    // Left goal (Team A)
    ctx.fillStyle = "#DC2626";
    ctx.fillRect(0, goalY, GAME_CONFIG.GOAL_HEIGHT, GAME_CONFIG.GOAL_WIDTH);
    ctx.strokeRect(0, goalY, GAME_CONFIG.GOAL_HEIGHT, GAME_CONFIG.GOAL_WIDTH);

    // Right goal (Team B)
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.GOAL_HEIGHT, goalY, GAME_CONFIG.GOAL_HEIGHT, GAME_CONFIG.GOAL_WIDTH);
    ctx.strokeRect(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.GOAL_HEIGHT, goalY, GAME_CONFIG.GOAL_HEIGHT, GAME_CONFIG.GOAL_WIDTH);
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, color: string) {
    // Player circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(player.position.x, player.position.y, GAME_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ball indicator if player has ball
    if (player.hasBall) {
      ctx.strokeStyle = "#FCD34D";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, GAME_CONFIG.PLAYER_RADIUS + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(player.name, player.position.x, player.position.y - GAME_CONFIG.PLAYER_RADIUS - 8);

    // Role indicator
    ctx.font = "10px Arial";
    ctx.fillText(player.role[0].toUpperCase(), player.position.x, player.position.y + 4);
  }

  function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Ball
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, GAME_CONFIG.BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Ball pattern
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + GAME_CONFIG.BALL_RADIUS + 2, GAME_CONFIG.BALL_RADIUS, GAME_CONFIG.BALL_RADIUS / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStatus(ctx: CanvasRenderingContext2D, state: GameState) {
    // Score board
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(GAME_CONFIG.FIELD_WIDTH / 2 - 150, 20, 300, 60);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `${state.score.teamA} - ${state.score.teamB}`,
      GAME_CONFIG.FIELD_WIDTH / 2,
      60
    );

    // Status text
    if (state.status === "waiting") {
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#FCD34D";
      ctx.fillText(
        "Waiting for players...",
        GAME_CONFIG.FIELD_WIDTH / 2,
        GAME_CONFIG.FIELD_HEIGHT / 2
      );
    } else if (state.status === "countdown") {
      ctx.font = "bold 48px Arial";
      ctx.fillStyle = "#FCD34D";
      const countdown = state.countdownStartTime
        ? Math.ceil((GAME_CONFIG.COUNTDOWN_DURATION - (Date.now() - state.countdownStartTime)) / 1000)
        : 3;
      ctx.fillText(
        countdown > 0 ? countdown.toString() : "GO!",
        GAME_CONFIG.FIELD_WIDTH / 2,
        GAME_CONFIG.FIELD_HEIGHT / 2
      );
    } else if (state.status === "finished" && state.winner) {
      ctx.font = "bold 48px Arial";
      ctx.fillStyle = "#FCD34D";
      ctx.fillText(
        `Team ${state.winner} Wins! 🏆`,
        GAME_CONFIG.FIELD_WIDTH / 2,
        GAME_CONFIG.FIELD_HEIGHT / 2
      );
    }
  }

  return (
    <div className="flex justify-center items-center bg-gray-900 p-4 rounded-lg shadow-2xl">
      <canvas
        ref={canvasRef}
        width={GAME_CONFIG.FIELD_WIDTH}
        height={GAME_CONFIG.FIELD_HEIGHT}
        className="border-4 border-gray-700 rounded"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}

