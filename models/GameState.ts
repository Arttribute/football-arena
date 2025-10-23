import { Schema, model, models } from "mongoose";
import type { GameState as IGameState, Player, Ball, TeamId } from "@/types/game";

export interface IGameStateDoc extends Omit<IGameState, '_id'> {
  _id: string;
}

const PlayerSchema = new Schema({
  id: { type: String, required: true },
  name: String,
  team: { type: String, enum: ['A', 'B'], required: true },
  role: { type: String, enum: ['goalkeeper', 'defender', 'midfielder', 'striker'], required: true },
  position: {
    x: Number,
    y: Number,
  },
  hasBall: Boolean,
  lastActionTime: Number,
  stats: {
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    passes: { type: Number, default: 0 },
    tackles: { type: Number, default: 0 },
  },
}, { _id: false });

const BallSchema = new Schema({
  position: {
    x: Number,
    y: Number,
  },
  velocity: {
    vx: Number,
    vy: Number,
  },
  possessionPlayerId: String,
  lastTouchPlayerId: String,
}, { _id: false });

const GameStateSchema = new Schema<IGameStateDoc>({
  _id: { type: String, required: true }, // gameId
  gameId: { type: String, required: true },
  status: {
    type: String,
    enum: ['waiting', 'countdown', 'playing', 'finished'],
    default: 'waiting',
  },
  config: {
    playersPerTeam: { type: Number, default: 5 },
    goalsToWin: { type: Number, default: 3 },
  },
  teamA: { type: [PlayerSchema], default: [] },
  teamB: { type: [PlayerSchema], default: [] },
  ball: { type: BallSchema, required: true },
  score: {
    teamA: { type: Number, default: 0 },
    teamB: { type: Number, default: 0 },
  },
  winner: { type: String, enum: ['A', 'B'] },
  createdAt: { type: Number, default: () => Date.now() },
  startedAt: Number,
  finishedAt: Number,
  lastUpdate: { type: Number, default: () => Date.now() },
  version: { type: Number, default: 0 },
  countdownStartTime: Number,
});

// Create indexes for efficient queries
GameStateSchema.index({ gameId: 1 }, { unique: true });
GameStateSchema.index({ status: 1, createdAt: -1 });

export const GameStateModel = models.GameState || model<IGameStateDoc>("GameState", GameStateSchema);

