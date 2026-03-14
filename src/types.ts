export type PathType = 'plain' | 'mountain' | 'hurdle';

export interface LevelConfig {
  id: number;
  targetDistance: number;
  speedMultiplier: number;
  hurdleFrequency?: number;
  terrainRoughness?: number;
}

export interface GameState {
  path: PathType | null;
  currentLevel: number;
  unlockedLevels: Record<PathType, number>;
  score: number;
  distance: number;
  coinsCollected: number;
  isPaused: boolean;
  isGameOver: boolean;
  isLevelComplete: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface Coin {
  x: number;
  y: number;
  value: number;
  collected: boolean;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'small_stone' | 'big_stone' | 'pothole' | 'barrier';
}
