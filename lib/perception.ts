import { GameState, Player, PerceptionData, PlayerPerception, BallPerception, GoalPerception, ActionRecommendation, Position, GAME_CONFIG } from "@/types/game";
import { distance } from "./gameLogic";

/**
 * TECHNICAL IMPROVEMENT #3: Enhanced perception system
 * Provides contextual awareness for LLM-based agents
 */

export function generatePerception(gameState: GameState, playerId: string): PerceptionData | null {
  const allPlayers = [...gameState.teamA, ...gameState.teamB];
  const player = allPlayers.find(p => p.id === playerId);
  
  if (!player) return null;

  const teammates = allPlayers.filter(p => p.team === player.team && p.id !== playerId);
  const opponents = allPlayers.filter(p => p.team !== player.team);

  // Ball perception
  const ballDist = distance(player.position, gameState.ball.position);
  let ballPossession: 'you' | 'teammate' | 'opponent' | 'free' = 'free';
  
  if (gameState.ball.possessionPlayerId === playerId) {
    ballPossession = 'you';
  } else if (gameState.ball.possessionPlayerId) {
    const possessor = allPlayers.find(p => p.id === gameState.ball.possessionPlayerId);
    if (possessor) {
      ballPossession = possessor.team === player.team ? 'teammate' : 'opponent';
    }
  }

  const ballPerception: BallPerception = {
    position: gameState.ball.position,
    possession: ballPossession,
    distanceFromYou: ballDist,
    velocity: gameState.ball.velocity,
  };

  // Teammate perception
  const teammatePerceptions: PlayerPerception[] = teammates.map(t => {
    const dist = distance(player.position, t.position);
    const canPassTo = player.hasBall && !hasOpponentInPath(player.position, t.position, opponents);
    const isOpen = !opponents.some(opp => distance(opp.position, t.position) < 100);

    return {
      id: t.id,
      name: t.name,
      role: t.role,
      position: t.position,
      distanceFromYou: dist,
      hasBall: t.hasBall,
      canPassTo,
      isOpen,
    };
  });

  // Opponent perception
  const opponentPerceptions: PlayerPerception[] = opponents.map(opp => ({
    id: opp.id,
    name: opp.name,
    role: opp.role,
    position: opp.position,
    distanceFromYou: distance(player.position, opp.position),
    hasBall: opp.hasBall,
  }));

  // Goal perception
  const ownGoalX = player.team === 'A' ? 0 : GAME_CONFIG.FIELD_WIDTH;
  const opponentGoalX = player.team === 'A' ? GAME_CONFIG.FIELD_WIDTH : 0;
  const goalY = GAME_CONFIG.FIELD_HEIGHT / 2;

  const ownGoal: GoalPerception = {
    position: { x: ownGoalX, y: goalY },
    distanceFromYou: distance(player.position, { x: ownGoalX, y: goalY }),
  };

  const opponentGoal: GoalPerception = {
    position: { x: opponentGoalX, y: goalY },
    distanceFromYou: distance(player.position, { x: opponentGoalX, y: goalY }),
    clearShot: player.hasBall && !hasOpponentInPath(player.position, { x: opponentGoalX, y: goalY }, opponents),
    angle: calculateAngleToGoal(player.position, opponentGoalX, goalY),
  };

  // Generate recommendations
  const recommendations = generateRecommendations(
    player,
    ballPerception,
    teammatePerceptions,
    opponentPerceptions,
    opponentGoal,
    gameState
  );

  return {
    yourPlayer: player,
    ball: ballPerception,
    teammates: teammatePerceptions,
    opponents: opponentPerceptions,
    goals: {
      own: ownGoal,
      opponent: opponentGoal,
    },
    fieldBounds: {
      width: GAME_CONFIG.FIELD_WIDTH,
      height: GAME_CONFIG.FIELD_HEIGHT,
    },
    recommendations,
    gameState: {
      status: gameState.status,
      score: gameState.score,
      timeElapsed: gameState.startedAt ? Date.now() - gameState.startedAt : undefined,
    },
  };
}

function hasOpponentInPath(from: Position, to: Position, opponents: Player[]): boolean {
  const pathDist = distance(from, to);
  
  for (const opp of opponents) {
    // Calculate perpendicular distance from opponent to line segment
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((opp.position.x - from.x) * dx + (opp.position.y - from.y) * dy) / (pathDist * pathDist)));
    const closestPoint = {
      x: from.x + t * dx,
      y: from.y + t * dy,
    };
    
    const distToPath = distance(opp.position, closestPoint);
    if (distToPath < GAME_CONFIG.PASS_INTERCEPT_DISTANCE) {
      return true;
    }
  }
  
  return false;
}

function calculateAngleToGoal(playerPos: Position, goalX: number, goalY: number): number {
  const dx = goalX - playerPos.x;
  const dy = goalY - playerPos.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function generateRecommendations(
  player: Player,
  ball: BallPerception,
  teammates: PlayerPerception[],
  opponents: PlayerPerception[],
  opponentGoal: GoalPerception,
  gameState: GameState
): ActionRecommendation {
  // If player has the ball
  if (ball.possession === 'you') {
    // Check if clear shot at goal
    if (opponentGoal.clearShot && opponentGoal.distanceFromYou < 400) {
      return {
        action: 'shoot',
        reason: 'You have a clear shot at goal!',
        priority: 'high',
      };
    }

    // Find open teammates for passing
    const openTeammates = teammates
      .filter(t => t.canPassTo && t.isOpen)
      .sort((a, b) => {
        // Prioritize teammates closer to goal
        const aDistToGoal = distance(a.position, opponentGoal.position);
        const bDistToGoal = distance(b.position, opponentGoal.position);
        return aDistToGoal - bDistToGoal;
      });

    if (openTeammates.length > 0) {
      return {
        action: 'pass',
        reason: 'Pass to an open teammate in a better position',
        priority: 'high',
        passTargets: openTeammates.slice(0, 3).map(t => ({
          playerId: t.id,
          playerName: t.name,
          reason: `${t.name} is open and ${Math.round(distance(t.position, opponentGoal.position))}px from goal`,
        })),
      };
    }

    // Move towards goal
    return {
      action: 'move',
      reason: 'Advance towards the opponent goal',
      priority: 'medium',
      moveTarget: {
        x: opponentGoal.position.x > player.position.x ? player.position.x + 50 : player.position.x - 50,
        y: opponentGoal.position.y,
      },
    };
  }

  // If teammate has the ball
  if (ball.possession === 'teammate') {
    // Check if you're in a good position
    const nearOpponents = opponents.filter(opp => opp.distanceFromYou < 100);
    if (nearOpponents.length === 0) {
      // Move to open space
      const targetX = opponentGoal.position.x > player.position.x ? player.position.x + 100 : player.position.x - 100;
      return {
        action: 'move',
        reason: 'Position yourself in open space to receive a pass',
        priority: 'medium',
        moveTarget: { x: targetX, y: player.position.y },
      };
    } else {
      return {
        action: 'wait',
        reason: 'Stay ready to support your teammate',
        priority: 'low',
      };
    }
  }

  // If opponent has the ball
  if (ball.possession === 'opponent') {
    const ballCarrier = opponents.find(opp => opp.hasBall);
    if (ballCarrier && ballCarrier.distanceFromYou < GAME_CONFIG.TACKLE_DISTANCE + 20) {
      return {
        action: 'tackle',
        reason: 'You\'re close enough to tackle the opponent with the ball',
        priority: 'high',
      };
    } else {
      // Move towards ball carrier or ball
      const target = ballCarrier ? ballCarrier.position : ball.position;
      return {
        action: 'move',
        reason: 'Press the opponent to win back possession',
        priority: 'high',
        moveTarget: target,
      };
    }
  }

  // Ball is free
  if (ball.distanceFromYou < 100) {
    return {
      action: 'move',
      reason: 'Move to claim the free ball',
      priority: 'high',
      moveTarget: ball.position,
    };
  } else {
    // Position defensively or offensively based on role
    let targetX: number;
    if (player.role === 'goalkeeper' || player.role === 'defender') {
      // Stay closer to own goal
      targetX = player.team === 'A' ? 200 : GAME_CONFIG.FIELD_WIDTH - 200;
    } else {
      // Move towards midfield
      targetX = GAME_CONFIG.FIELD_WIDTH / 2;
    }

    return {
      action: 'move',
      reason: `Position yourself according to your ${player.role} role`,
      priority: 'low',
      moveTarget: { x: targetX, y: player.position.y },
    };
  }
}

