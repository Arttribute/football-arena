import { GAME_CONFIG, Position } from "@/types/game";
import { dbConnect } from "./dbConnect";
import { GameStateModel } from "@/models/GameState";
import { distance, simulate } from "./gameLogic";

/**
 * Move player to target position
 */
export async function movePlayer(
  gameId: string,
  playerId: string,
  targetX: number,
  targetY: number
): Promise<{ success: boolean; message?: string }> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) return { success: false, message: "Game not found" };
  if (game.status !== 'playing') return { success: false, message: "Game not in progress" };

  const now = Date.now();
  simulate(game, now);

  const allPlayers = [...game.teamA, ...game.teamB];
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return { success: false, message: "Player not found" };

  // Check cooldown
  if (player.lastActionTime && now - player.lastActionTime < GAME_CONFIG.MOVE_COOLDOWN) {
    return { success: false, message: "Move cooldown active" };
  }

  // Move towards target (limited by player speed)
  const dx = targetX - player.position.x;
  const dy = targetY - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    const moveAmount = Math.min(GAME_CONFIG.PLAYER_SPEED, dist);
    player.position.x += (dx / dist) * moveAmount;
    player.position.y += (dy / dist) * moveAmount;

    // Keep player in bounds
    player.position.x = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_RADIUS, player.position.x));
    player.position.y = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_RADIUS, player.position.y));

    // If player has ball, ball moves with them
    if (player.hasBall && game.ball.possessionPlayerId === playerId) {
      game.ball.position = { ...player.position };
      game.markModified('ball.position');
    }

    player.lastActionTime = now;

    // Mark nested objects as modified for Mongoose
    game.markModified('teamA');
    game.markModified('teamB');

    game.version++;
    game.lastUpdate = now;

    await game.save();

    console.log(`Player ${playerId} moved to (${player.position.x}, ${player.position.y})`);

    return {
      success: true,
      position: {
        x: player.position.x,
        y: player.position.y
      },
      message: `Moved to (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`
    };
  }

  return { success: false, message: "Already at target position" };
}

/**
 * Pass ball to teammate
 */
export async function passBall(
  gameId: string,
  playerId: string,
  targetPlayerId: string
): Promise<{ success: boolean; message?: string }> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) return { success: false, message: "Game not found" };
  if (game.status !== 'playing') return { success: false, message: "Game not in progress" };

  const now = Date.now();
  simulate(game, now);

  const allPlayers = [...game.teamA, ...game.teamB];
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return { success: false, message: "Player not found" };

  if (!player.hasBall || game.ball.possessionPlayerId !== playerId) {
    return { success: false, message: "Player doesn't have the ball" };
  }

  // Check cooldown
  if (player.lastActionTime && now - player.lastActionTime < GAME_CONFIG.PASS_COOLDOWN) {
    return { success: false, message: "Pass cooldown active" };
  }

  const targetPlayer = allPlayers.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return { success: false, message: "Target player not found" };

  if (targetPlayer.team !== player.team) {
    return { success: false, message: "Cannot pass to opponent" };
  }

  // Release ball and set velocity towards target
  const dx = targetPlayer.position.x - player.position.x;
  const dy = targetPlayer.position.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    game.ball.velocity = {
      vx: (dx / dist) * GAME_CONFIG.PASS_SPEED,
      vy: (dy / dist) * GAME_CONFIG.PASS_SPEED,
    };
  }

  game.ball.possessionPlayerId = undefined;
  player.hasBall = false;
  player.stats.passes++;
  player.lastActionTime = now;

  // Mark nested objects as modified for Mongoose
  game.markModified('ball');
  game.markModified('teamA');
  game.markModified('teamB');

  game.version++;
  game.lastUpdate = now;

  await game.save();

  console.log(`Player ${playerId} passed to ${targetPlayerId}`);

  return {
    success: true,
    message: `Passed to ${targetPlayer.name}`,
    ballVelocity: game.ball.velocity
  };
}

/**
 * Shoot at goal
 */
export async function shoot(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; message?: string }> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) return { success: false, message: "Game not found" };
  if (game.status !== 'playing') return { success: false, message: "Game not in progress" };

  const now = Date.now();
  simulate(game, now);

  const allPlayers = [...game.teamA, ...game.teamB];
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return { success: false, message: "Player not found" };

  if (!player.hasBall || game.ball.possessionPlayerId !== playerId) {
    return { success: false, message: "Player doesn't have the ball" };
  }

  // Check cooldown
  if (player.lastActionTime && now - player.lastActionTime < GAME_CONFIG.SHOOT_COOLDOWN) {
    return { success: false, message: "Shoot cooldown active" };
  }

  // Determine target goal
  const targetGoalX = player.team === 'A' ? GAME_CONFIG.FIELD_WIDTH : 0;
  const targetGoalY = GAME_CONFIG.FIELD_HEIGHT / 2;

  // Calculate shoot direction
  const dx = targetGoalX - player.position.x;
  const dy = targetGoalY - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    game.ball.velocity = {
      vx: (dx / dist) * GAME_CONFIG.SHOOT_SPEED,
      vy: (dy / dist) * GAME_CONFIG.SHOOT_SPEED,
    };
  }

  game.ball.possessionPlayerId = undefined;
  player.hasBall = false;
  player.lastActionTime = now;

  // Mark nested objects as modified for Mongoose
  game.markModified('ball');
  game.markModified('teamA');
  game.markModified('teamB');

  game.version++;
  game.lastUpdate = now;

  await game.save();

  console.log(`Player ${playerId} shot towards goal`);

  return {
    success: true,
    message: `Shot towards goal!`,
    ballVelocity: game.ball.velocity
  };
}

/**
 * Tackle opponent
 */
export async function tackle(
  gameId: string,
  playerId: string,
  targetPlayerId: string
): Promise<{ success: boolean; message?: string }> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) return { success: false, message: "Game not found" };
  if (game.status !== 'playing') return { success: false, message: "Game not in progress" };

  const now = Date.now();
  simulate(game, now);

  const allPlayers = [...game.teamA, ...game.teamB];
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return { success: false, message: "Player not found" };

  // Check cooldown
  if (player.lastActionTime && now - player.lastActionTime < GAME_CONFIG.TACKLE_COOLDOWN) {
    return { success: false, message: "Tackle cooldown active" };
  }

  const targetPlayer = allPlayers.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return { success: false, message: "Target player not found" };

  if (targetPlayer.team === player.team) {
    return { success: false, message: "Cannot tackle teammate" };
  }

  if (!targetPlayer.hasBall) {
    return { success: false, message: "Target doesn't have the ball" };
  }

  const dist = distance(player.position, targetPlayer.position);
  if (dist > GAME_CONFIG.TACKLE_DISTANCE) {
    return { success: false, message: "Too far to tackle" };
  }

  // Tackle attempt
  const success = Math.random() < GAME_CONFIG.TACKLE_SUCCESS_RATE;

  if (success) {
    // Successful tackle - ball becomes free
    game.ball.possessionPlayerId = undefined;
    targetPlayer.hasBall = false;
    
    // Ball bounces away slightly
    const angle = Math.random() * Math.PI * 2;
    game.ball.velocity = {
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2,
    };

    player.stats.tackles++;
  }

  player.lastActionTime = now;

  // Mark nested objects as modified for Mongoose
  game.markModified('ball');
  game.markModified('teamA');
  game.markModified('teamB');

  game.version++;
  game.lastUpdate = now;

  await game.save();

  console.log(`Player ${playerId} tackle ${success ? 'successful' : 'failed'} on ${targetPlayerId}`);

  return {
    success: true,
    tackleSuccess: success,
    message: success ? "Tackle successful!" : "Tackle failed",
    ballIsFree: success
  };
}

