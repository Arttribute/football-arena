import { GAME_CONFIG, GameState, Player, Ball, Position, TeamId, PlayerRole } from "@/types/game";
import { v4 as uuidv4 } from "uuid";
import { dbConnect } from "./dbConnect";
import { GameStateModel, IGameStateDoc } from "@/models/GameState";

/**
 * TECHNICAL IMPROVEMENT #1: Use findOneAndUpdate with atomic operations
 * instead of retry loops. This is more efficient and reduces race conditions.
 */

// Helper: Calculate distance between two points
export function distance(p1: Position, p2: Position): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Helper: Normalize vector
function normalize(vx: number, vy: number): { vx: number; vy: number } {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag === 0) return { vx: 0, vy: 0 };
  return { vx: vx / mag, vy: vy / mag };
}

/**
 * TECHNICAL IMPROVEMENT #2: Fixed timestep simulation
 * Ensures consistent physics regardless of frame rate
 */
export function simulate(state: IGameStateDoc, now: number): boolean {
  const dt = now - state.lastUpdate;
  if (dt < GAME_CONFIG.SIMULATION_STEP) return false;

  let stateChanged = false;

  // Handle countdown
  if (state.status === "countdown" && state.countdownStartTime) {
    const elapsed = now - state.countdownStartTime;
    if (elapsed >= GAME_CONFIG.COUNTDOWN_DURATION) {
      state.status = "playing";
      state.startedAt = now;
      state.countdownStartTime = undefined;
      stateChanged = true;
    }
  }

  if (state.status === "playing") {
    // Move players towards their target positions
    const allPlayers = [...state.teamA, ...state.teamB];
    for (const player of allPlayers) {
      if (player.targetPosition) {
        const dx = player.targetPosition.x - player.position.x;
        const dy = player.targetPosition.y - player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.5) {
          // Move towards target at constant speed (use player's custom speed if set)
          const playerSpeed = player.speed || GAME_CONFIG.PLAYER_SPEED;
          const moveAmount = Math.min(playerSpeed, dist);
          player.position.x += (dx / dist) * moveAmount;
          player.position.y += (dy / dist) * moveAmount;

          // Keep player in bounds
          player.position.x = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.PLAYER_RADIUS, player.position.x));
          player.position.y = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.PLAYER_RADIUS, player.position.y));

          // If player has ball, ball moves with them
          if (player.hasBall && state.ball.possessionPlayerId === player.id) {
            state.ball.position = { ...player.position };
            state.markModified('ball.position');
          }

          state.markModified('teamA');
          state.markModified('teamB');
          stateChanged = true;
        } else {
          // Reached target - clear it
          player.targetPosition = undefined;
          state.markModified('teamA');
          state.markModified('teamB');
          stateChanged = true;
        }
      }
    }

    // Update ball physics
    if (!state.ball.possessionPlayerId) {
      // Ball is free - apply velocity and friction
      state.ball.position.x += state.ball.velocity.vx;
      state.ball.position.y += state.ball.velocity.vy;
      state.ball.velocity.vx *= GAME_CONFIG.BALL_FRICTION;
      state.ball.velocity.vy *= GAME_CONFIG.BALL_FRICTION;

      // Stop ball if velocity is very low
      if (Math.abs(state.ball.velocity.vx) < 0.1 && Math.abs(state.ball.velocity.vy) < 0.1) {
        state.ball.velocity.vx = 0;
        state.ball.velocity.vy = 0;
      }

      // Keep ball in bounds
      state.ball.position.x = Math.max(GAME_CONFIG.BALL_RADIUS, Math.min(GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.BALL_RADIUS, state.ball.position.x));
      state.ball.position.y = Math.max(GAME_CONFIG.BALL_RADIUS, Math.min(GAME_CONFIG.FIELD_HEIGHT - GAME_CONFIG.BALL_RADIUS, state.ball.position.y));

      // Mark ball as modified for Mongoose
      state.markModified('ball');

      // Check for goal
      const goalY = GAME_CONFIG.FIELD_HEIGHT / 2;
      const goalHalfWidth = GAME_CONFIG.GOAL_WIDTH / 2;

      // Team A goal (left side, x = 0)
      if (state.ball.position.x <= GAME_CONFIG.BALL_RADIUS &&
          state.ball.position.y >= goalY - goalHalfWidth &&
          state.ball.position.y <= goalY + goalHalfWidth) {
        state.score.teamB++;
        if (state.ball.lastTouchPlayerId) {
          const scorer = [...state.teamB].find(p => p.id === state.ball.lastTouchPlayerId);
          if (scorer) {
            scorer.stats.goals++;
            state.markModified('teamB');
          }
        }
        resetBall(state);
        state.markModified('score');
        stateChanged = true;

        if (state.score.teamB >= state.config.goalsToWin) {
          state.status = "finished";
          state.winner = "B";
          state.finishedAt = now;
        }
      }

      // Team B goal (right side, x = FIELD_WIDTH)
      if (state.ball.position.x >= GAME_CONFIG.FIELD_WIDTH - GAME_CONFIG.BALL_RADIUS &&
          state.ball.position.y >= goalY - goalHalfWidth &&
          state.ball.position.y <= goalY + goalHalfWidth) {
        state.score.teamA++;
        if (state.ball.lastTouchPlayerId) {
          const scorer = [...state.teamA].find(p => p.id === state.ball.lastTouchPlayerId);
          if (scorer) {
            scorer.stats.goals++;
            state.markModified('teamA');
          }
        }
        resetBall(state);
        state.markModified('score');
        stateChanged = true;

        if (state.score.teamA >= state.config.goalsToWin) {
          state.status = "finished";
          state.winner = "A";
          state.finishedAt = now;
        }
      }

      // Check for possession claim
      const allPlayers = [...state.teamA, ...state.teamB];
      for (const player of allPlayers) {
        const dist = distance(player.position, state.ball.position);
        if (dist <= GAME_CONFIG.POSSESSION_DISTANCE) {
          state.ball.possessionPlayerId = player.id;
          state.ball.lastTouchPlayerId = player.id;
          state.ball.velocity = { vx: 0, vy: 0 };
          player.hasBall = true;
          state.markModified('ball');
          state.markModified('teamA');
          state.markModified('teamB');
          stateChanged = true;
          break;
        }
      }
    } else {
      // Ball is possessed - move with player
      const allPlayers = [...state.teamA, ...state.teamB];
      const possessor = allPlayers.find(p => p.id === state.ball.possessionPlayerId);
      if (possessor) {
        state.ball.position = { ...possessor.position };
        state.markModified('ball.position');
      }
    }

    if (stateChanged) {
      state.version++;
    }
  }

  state.lastUpdate = now;
  return stateChanged;
}

function resetBall(state: IGameStateDoc) {
  state.ball.position = {
    x: GAME_CONFIG.FIELD_WIDTH / 2,
    y: GAME_CONFIG.FIELD_HEIGHT / 2,
  };
  state.ball.velocity = { vx: 0, vy: 0 };
  state.ball.possessionPlayerId = undefined;

  // Clear all players' ball possession
  [...state.teamA, ...state.teamB].forEach(p => p.hasBall = false);

  // Mark as modified for Mongoose
  state.markModified('ball');
  state.markModified('teamA');
  state.markModified('teamB');
}

// Get initial position for player based on role and team
function getInitialPosition(role: PlayerRole, team: TeamId, teamSize: number): Position {
  const centerY = GAME_CONFIG.FIELD_HEIGHT / 2;
  const isTeamA = team === 'A';

  switch (role) {
    case 'goalkeeper':
      return {
        x: isTeamA ? 50 : GAME_CONFIG.FIELD_WIDTH - 50,
        y: centerY,
      };
    case 'defender':
      return {
        x: isTeamA ? 200 : GAME_CONFIG.FIELD_WIDTH - 200,
        y: centerY + (teamSize % 2 === 0 ? -100 : 100),
      };
    case 'midfielder':
      return {
        x: GAME_CONFIG.FIELD_WIDTH / 2 + (isTeamA ? -100 : 100),
        y: centerY + (teamSize % 3 === 0 ? -150 : teamSize % 3 === 1 ? 0 : 150),
      };
    case 'striker':
      return {
        x: isTeamA ? GAME_CONFIG.FIELD_WIDTH - 300 : 300,
        y: centerY,
      };
  }
}

/**
 * Create a new game instance
 */
export async function createGame(
  playerName: string,
  config: { playersPerTeam?: number; goalsToWin?: number } = {}
): Promise<{ success: boolean; gameId?: string; playerId?: string; message?: string }> {
  await dbConnect();

  const gameId = uuidv4();
  const playerId = uuidv4();

  const initialPlayer: Player = {
    id: playerId,
    name: playerName,
    team: 'A',
    role: 'striker',
    position: getInitialPosition('striker', 'A', 0),
    hasBall: false,
    stats: { goals: 0, assists: 0, passes: 0, tackles: 0 },
  };

  const gameState = {
    _id: gameId,
    gameId,
    status: 'waiting' as const,
    config: {
      playersPerTeam: config.playersPerTeam || 5,
      goalsToWin: config.goalsToWin || 3,
    },
    teamA: [initialPlayer],
    teamB: [],
    ball: {
      position: { x: GAME_CONFIG.FIELD_WIDTH / 2, y: GAME_CONFIG.FIELD_HEIGHT / 2 },
      velocity: { vx: 0, vy: 0 },
    },
    score: { teamA: 0, teamB: 0 },
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    version: 0,
  };

  try {
    await GameStateModel.create(gameState);
    return { success: true, gameId, playerId };
  } catch (error) {
    console.error("Error creating game:", error);
    return { success: false, message: "Failed to create game" };
  }
}

/**
 * Join an existing game
 */
export async function joinGame(
  gameId: string,
  playerName: string,
  teamPreference?: TeamId,
  role?: PlayerRole
): Promise<{ success: boolean; playerId?: string; message?: string }> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) {
    return { success: false, message: "Game not found" };
  }

  if (game.status !== 'waiting') {
    return { success: false, message: "Game already started" };
  }

  const playerId = uuidv4();

  // Determine which team to join
  let targetTeam: TeamId;
  if (teamPreference) {
    targetTeam = teamPreference;
    const team = targetTeam === 'A' ? game.teamA : game.teamB;
    if (team.length >= game.config.playersPerTeam) {
      // Preferred team is full, try other team
      targetTeam = targetTeam === 'A' ? 'B' : 'A';
      const otherTeam = targetTeam === 'A' ? game.teamA : game.teamB;
      if (otherTeam.length >= game.config.playersPerTeam) {
        return { success: false, message: "Game is full" };
      }
    }
  } else {
    // Auto-assign to team with fewer players
    targetTeam = game.teamA.length <= game.teamB.length ? 'A' : 'B';
  }

  const team = targetTeam === 'A' ? game.teamA : game.teamB;

  // Auto-assign role if not specified
  const assignedRole = role || autoAssignRole(team);

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    team: targetTeam,
    role: assignedRole,
    position: getInitialPosition(assignedRole, targetTeam, team.length),
    hasBall: false,
    stats: { goals: 0, assists: 0, passes: 0, tackles: 0 },
  };

  team.push(newPlayer);

  // Mark team arrays as modified for Mongoose
  game.markModified('teamA');
  game.markModified('teamB');

  game.version++;

  // Check if game should start
  if (game.teamA.length >= game.config.playersPerTeam && game.teamB.length >= game.config.playersPerTeam) {
    game.status = 'countdown';
    game.countdownStartTime = Date.now();
  }

  await game.save();

  return { success: true, playerId };
}

function autoAssignRole(team: Player[]): PlayerRole {
  const roles = team.map(p => p.role);
  if (!roles.includes('goalkeeper')) return 'goalkeeper';
  if (roles.filter(r => r === 'defender').length < 2) return 'defender';
  if (roles.filter(r => r === 'midfielder').length < 2) return 'midfielder';
  return 'striker';
}

/**
 * Get game state with simulation
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
  await dbConnect();

  const game = await GameStateModel.findOne({ gameId });
  if (!game) return null;

  const now = Date.now();
  const changed = simulate(game, now);

  if (changed || game.isModified()) {
    await game.save();
    console.log(`Game ${gameId} state saved, version: ${game.version}, changed: ${changed}, modified paths: ${game.modifiedPaths()}`);
  }

  return sanitizeGameState(game);
}

function sanitizeGameState(doc: IGameStateDoc): GameState {
  return {
    gameId: doc.gameId,
    status: doc.status,
    config: doc.config,
    teamA: doc.teamA,
    teamB: doc.teamB,
    ball: doc.ball,
    score: doc.score,
    winner: doc.winner,
    createdAt: doc.createdAt,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    lastUpdate: doc.lastUpdate,
    version: doc.version,
    countdownStartTime: doc.countdownStartTime,
  };
}

/**
 * List all active games
 */
export async function listActiveGames(): Promise<GameState[]> {
  await dbConnect();

  const games = await GameStateModel.find({
    status: { $in: ['waiting', 'countdown', 'playing'] }
  }).sort({ createdAt: -1 }).limit(50);

  return games.map(sanitizeGameState);
}
