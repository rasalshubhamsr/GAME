import { PathType, LevelConfig } from './types';

export const PATHS: { id: PathType; label: string; description: string; color: string }[] = [
  { id: 'plain', label: 'Plain Road', description: 'Smooth and easy ride.', color: 'bg-emerald-500' },
  { id: 'mountain', label: 'Mountains', description: 'Hilly terrain with steep climbs.', color: 'bg-amber-600' },
  { id: 'hurdle', label: 'Hurdles', description: 'Watch out for obstacles!', color: 'bg-rose-500' },
];

export const LEVELS_PER_PATH = 5;

export const LEVEL_CONFIGS: Record<PathType, LevelConfig[]> = {
  plain: [
    { id: 1, targetDistance: 500, speedMultiplier: 1 },
    { id: 2, targetDistance: 1000, speedMultiplier: 1.1 },
    { id: 3, targetDistance: 1500, speedMultiplier: 1.2 },
    { id: 4, targetDistance: 2000, speedMultiplier: 1.3 },
    { id: 5, targetDistance: 3000, speedMultiplier: 1.5 },
  ],
  mountain: [
    { id: 1, targetDistance: 400, speedMultiplier: 0.9, terrainRoughness: 0.5 },
    { id: 2, targetDistance: 800, speedMultiplier: 1.0, terrainRoughness: 0.7 },
    { id: 3, targetDistance: 1200, speedMultiplier: 1.1, terrainRoughness: 0.9 },
    { id: 4, targetDistance: 1600, speedMultiplier: 1.2, terrainRoughness: 1.1 },
    { id: 5, targetDistance: 2500, speedMultiplier: 1.4, terrainRoughness: 1.3 },
  ],
  hurdle: [
    { id: 1, targetDistance: 400, speedMultiplier: 1, hurdleFrequency: 0.01 },
    { id: 2, targetDistance: 800, speedMultiplier: 1.1, hurdleFrequency: 0.015 },
    { id: 3, targetDistance: 1200, speedMultiplier: 1.2, hurdleFrequency: 0.02 },
    { id: 4, targetDistance: 1600, speedMultiplier: 1.3, hurdleFrequency: 0.025 },
    { id: 5, targetDistance: 2500, speedMultiplier: 1.5, hurdleFrequency: 0.03 },
  ],
};

export const GRAVITY = 0.5;
export const JUMP_FORCE = -10;
export const ACCELERATION = 0.2;
export const FRICTION = 0.98;
export const MAX_SPEED = 8;
