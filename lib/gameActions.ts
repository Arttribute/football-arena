import { GAME_CONFIG, Position } from "@/types/game";
import { dbConnect } from "./dbConnect";
import { GameStateModel } from "@/models/GameState";
import { distance, simulate } from "./gameLogic";

/**
 * Move player to target position with optional custom speed
 */
export async function movePlayer(
  gameId: string,
  playerId: string,
  targetX: number,
  targetY: number,
  speed?: number
): Promise<{ success: boolean; message?: string; position?: Position; targetPosition?: Position; distance?: number; speed?: number }> {
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

  // Validate and set custom speed if provided
  if (speed !== undefined) {
    if (speed < GAME_CONFIG.MIN_PLAYER_SPEED) {
      return { success: false, message: `Speed too low. Minimum: ${GAME_CONFIG.MIN_PLAYER_SPEED}` };
    }
    if (speed > GAME_CONFIG.MAX_PLAYER_SPEED) {
      return { success: false, message: `Speed too high. Maximum: ${GAME_CONFIG.MAX_PLAYER_SPEED}` };
    }
    player.speed = speed;
  }

  // Validate target position is within field bounds
  const clampedX = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_RADIUS, targetX));
  const clampedY = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_RADIUS, targetY));

  // Calculate distance to target
  const dx = clampedX - player.position.x;
  const dy = clampedY - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return { success: false, message: "Already at target position" };
  }

  // Set the target position - player will move towards it in simulation
  player.targetPosition = {
    x: clampedX,
    y: clampedY
  };

  player.lastActionTime = now;

  // Mark nested objects as modified for Mongoose
  game.markModified('teamA');
  game.markModified('teamB');

  game.version++;
  // Don't update lastUpdate here - let simulation handle it
  // This ensures ball starts moving immediately on next simulation tick

  await game.save();

  const actualSpeed = player.speed || GAME_CONFIG.PLAYER_SPEED;
  console.log(`Player ${playerId} target set to (${clampedX}, ${clampedY}), distance: ${Math.round(dist)}, speed: ${actualSpeed}`);

  return {
    success: true,
    position: {
      x: player.position.x,
      y: player.position.y
    },
    targetPosition: {
      x: clampedX,
      y: clampedY
    },
    distance: Math.round(dist),
    speed: actualSpeed,
    message: `Moving to (${Math.round(clampedX)}, ${Math.round(clampedY)}), distance: ${Math.round(dist)} pixels at speed ${actualSpeed}`
  };
}

/**
 * Pass ball to teammate with optional custom speed
 */
export async function passBall(
  gameId: string,
  playerId: string,
  targetPlayerId: string,
  speed?: number
): Promise<{ success: boolean; message?: string; ballVelocity?: { vx: number; vy: number }; speed?: number }> {
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

  // Validate and use custom speed if provided
  let passSpeed: number = GAME_CONFIG.PASS_SPEED;
  if (speed !== undefined) {
    if (speed < GAME_CONFIG.MIN_PASS_SPEED) {
      return { success: false, message: `Speed too low. Minimum: ${GAME_CONFIG.MIN_PASS_SPEED}` };
    }
    if (speed > GAME_CONFIG.MAX_PASS_SPEED) {
      return { success: false, message: `Speed too high. Maximum: ${GAME_CONFIG.MAX_PASS_SPEED}` };
    }
    passSpeed = speed;
  }

  // Release ball and set velocity towards target
  const dx = targetPlayer.position.x - player.position.x;
  const dy = targetPlayer.position.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    game.ball.velocity = {
      vx: (dx / dist) * passSpeed,
      vy: (dy / dist) * passSpeed,
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
  // Don't update lastUpdate here - let simulation handle it
  // This ensures ball starts moving immediately on next simulation tick

  await game.save();

  console.log(`Player ${playerId} passed to ${targetPlayerId} at speed ${passSpeed}`);

  return {
    success: true,
    message: `Passed to ${targetPlayer.name}`,
    ballVelocity: game.ball.velocity,
    speed: passSpeed
  };
}

/**
 * Shoot at goal with optional custom speed
 */
export async function shoot(
  gameId: string,
  playerId: string,
  speed?: number
): Promise<{ success: boolean; message?: string; ballVelocity?: { vx: number; vy: number }; speed?: number }> {
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

  // Validate and use custom speed if provided
  let shootSpeed: number = GAME_CONFIG.SHOOT_SPEED;
  if (speed !== undefined) {
    if (speed < GAME_CONFIG.MIN_SHOOT_SPEED) {
      return { success: false, message: `Speed too low. Minimum: ${GAME_CONFIG.MIN_SHOOT_SPEED}` };
    }
    if (speed > GAME_CONFIG.MAX_SHOOT_SPEED) {
      return { success: false, message: `Speed too high. Maximum: ${GAME_CONFIG.MAX_SHOOT_SPEED}` };
    }
    shootSpeed = speed;
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
      vx: (dx / dist) * shootSpeed,
      vy: (dy / dist) * shootSpeed,
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
  // Don't update lastUpdate here - let simulation handle it
  // This ensures ball starts moving immediately on next simulation tick

  await game.save();

  console.log(`Player ${playerId} shot towards goal at speed ${shootSpeed}`);

  return {
    success: true,
    message: `Shot towards goal!`,
    ballVelocity: game.ball.velocity,
    speed: shootSpeed
  };
}

/**
 * Tackle opponent
 */
export async function tackle(
  gameId: string,
  playerId: string,
  targetPlayerId: string
): Promise<{ success: boolean; message?: string; tackleSuccess?: boolean; ballIsFree?: boolean }> {
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
  // Don't update lastUpdate here - let simulation handle it
  // This ensures ball starts moving immediately on next simulation tick

  await game.save();

  console.log(`Player ${playerId} tackle ${success ? 'successful' : 'failed'} on ${targetPlayerId}`);

  return {
    success: true,
    tackleSuccess: success,
    message: success ? "Tackle successful!" : "Tackle failed",
    ballIsFree: success
  };
}

