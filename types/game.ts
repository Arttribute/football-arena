// Game configuration and types

export const GAME_CONFIG = {
  FIELD_WIDTH: 1200,
  FIELD_HEIGHT: 800,
  GOAL_WIDTH: 150,
  GOAL_HEIGHT: 20,
  PLAYER_RADIUS: 15,
  BALL_RADIUS: 8,
  
  // Game mechanics
  PLAYER_SPEED: 4, // pixels per simulation step
  BALL_SPEED_BASE: 8,
  BALL_FRICTION: 0.95, // velocity multiplier per step
  PASS_SPEED: 6,
  SHOOT_SPEED: 10,
  
  // Action cooldowns (milliseconds)
  PASS_COOLDOWN: 500,
  SHOOT_COOLDOWN: 1000,
  TACKLE_COOLDOWN: 2000,
  MOVE_COOLDOWN: 100,
  
  // Distances
  POSSESSION_DISTANCE: 25, // distance to claim ball
  TACKLE_DISTANCE: 30,
  PASS_INTERCEPT_DISTANCE: 20,
  
  // Probabilities
  TACKLE_SUCCESS_RATE: 0.6,
  
  // Timing
  COUNTDOWN_DURATION: 3000, // 3 seconds
  SIMULATION_STEP: 50, // ms between physics updates
} as const;

export type TeamId = 'A' | 'B';
export type PlayerRole = 'goalkeeper' | 'defender' | 'midfielder' | 'striker';
export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Player {
  id: string;
  name: string;
  team: TeamId;
  role: PlayerRole;
  position: Position;
  hasBall: boolean;
  lastActionTime?: number;
  stats: {
    goals: number;
    assists: number;
    passes: number;
    tackles: number;
  };
}

export interface Ball {
  position: Position;
  velocity: Velocity;
  possessionPlayerId?: string;
  lastTouchPlayerId?: string;
}

export interface GameConfig {
  playersPerTeam: number;
  goalsToWin: number;
}

export interface Score {
  teamA: number;
  teamB: number;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  config: GameConfig;
  teamA: Player[];
  teamB: Player[];
  ball: Ball;
  score: Score;
  winner?: TeamId;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  lastUpdate: number;
  version: number;
  countdownStartTime?: number;
}

// Perception types for agents
export interface PlayerPerception {
  id: string;
  name: string;
  role: PlayerRole;
  position: Position;
  distanceFromYou: number;
  hasBall: boolean;
  canPassTo?: boolean;
  isOpen?: boolean;
}

export interface BallPerception {
  position: Position;
  possession: 'you' | 'teammate' | 'opponent' | 'free';
  distanceFromYou: number;
  velocity?: Velocity;
}

export interface GoalPerception {
  position: Position;
  distanceFromYou: number;
  clearShot?: boolean;
  angle?: number;
}

export interface ActionRecommendation {
  action: 'move' | 'pass' | 'shoot' | 'tackle' | 'wait';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  passTargets?: Array<{
    playerId: string;
    playerName: string;
    reason: string;
  }>;
  moveTarget?: Position;
}

export interface PerceptionData {
  yourPlayer: Player;
  ball: BallPerception;
  teammates: PlayerPerception[];
  opponents: PlayerPerception[];
  goals: {
    own: GoalPerception;
    opponent: GoalPerception;
  };
  fieldBounds: {
    width: number;
    height: number;
  };
  recommendations: ActionRecommendation;
  gameState: {
    status: GameStatus;
    score: Score;
    timeElapsed?: number;
  };
}

