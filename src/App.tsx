import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  Lock, 
  Trophy, 
  Bike, 
  Mountain, 
  Route, 
  AlertTriangle,
  Home,
  Coins,
  Star,
  Volume2,
  VolumeX,
  Music
} from 'lucide-react';
import { PathType, GameState, LevelConfig, Coin } from './types';
import { PATHS, LEVEL_CONFIGS, LEVELS_PER_PATH } from './constants';

// --- Sound Manager ---
const playSound = (type: 'coin' | 'win' | 'click' | 'jump', enabled: boolean) => {
  if (!enabled) return;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  
  if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'win') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1);
    osc.frequency.setValueAtTime(659.25, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
    osc.start(now);
    osc.stop(now + 1);
  } else if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'jump') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

// --- Game Component ---
const GameView: React.FC<{
  path: PathType;
  level: number;
  soundEnabled: boolean;
  onComplete: (coins: number) => void;
  onGameOver: () => void;
  onExit: () => void;
}> = ({ path, level, soundEnabled, onComplete, onGameOver, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coins, setCoinsCollected] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);

  const config = LEVEL_CONFIGS[path][level - 1];
  
  // Input state
  const inputs = useRef({
    jump: false,
    accelerate: false
  });

  // Game state refs for the loop
  const gameState = useRef({
    x: 100,
    y: 300,
    vy: 0,
    vx: 0,
    rotation: 0,
    distance: 0,
    obstacles: [] as { x: number; type: 'small_stone' | 'big_stone' | 'pothole' | 'barrier' }[],
    coins: [] as Coin[],
    terrain: [] as number[],
    lastObstacleX: 400,
    lastCoinX: 200,
  });

  const requestRef = useRef<number>(null);

  useEffect(() => {
    // Initialize terrain
    const terrain = [];
    for (let i = 0; i < 2000; i++) {
      if (path === 'mountain') {
        terrain.push(Math.sin(i * 0.02) * 40 * (config.terrainRoughness || 1));
      } else {
        terrain.push(0);
      }
    }
    gameState.current.terrain = terrain;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        inputs.current.jump = true;
      }
      if (e.code === 'ArrowRight') {
        inputs.current.accelerate = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        inputs.current.jump = false;
      }
      if (e.code === 'ArrowRight') {
        inputs.current.accelerate = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [path, config]);

  const update = () => {
    if (isPaused || gameOver || levelComplete) return;

    const state = gameState.current;
    
    // Handle Inputs
    if (inputs.current.jump) {
      if (state.y >= 300 + (state.terrain[Math.floor(state.x / 10) % 2000] || 0) - 5) {
        state.vy = -10;
        playSound('jump', soundEnabled);
        inputs.current.jump = false; // Prevent auto-jump
      }
    }

    if (inputs.current.accelerate) {
      state.vx = Math.min(state.vx + 0.5, 8 * config.speedMultiplier);
    }

    // Physics
    state.vx *= 0.99; // Friction
    state.vy += 0.5; // Gravity
    
    state.distance += state.vx;
    setDistance(Math.floor(state.distance / 10));
    setScore(Math.floor(state.distance / 5));

    // Terrain height at current distance
    const terrainIdx = Math.floor((state.distance + state.x) / 10) % 2000;
    const groundY = 350 + (state.terrain[terrainIdx] || 0);

    state.y += state.vy;

    if (state.y > groundY - 40) {
      state.y = groundY - 40;
      state.vy = 0;
      // Rotation based on terrain slope
      const nextIdx = (terrainIdx + 1) % 2000;
      const slope = (state.terrain[nextIdx] - state.terrain[terrainIdx]);
      state.rotation = Math.atan2(slope, 10);
    } else {
      state.rotation *= 0.95;
    }

    // Obstacles
    if (path === 'hurdle' && state.distance > state.lastObstacleX - 400) {
      if (Math.random() < (config.hurdleFrequency || 0.02)) {
        const type = Math.random() > 0.5 ? 'big_stone' : 'small_stone';
        state.obstacles.push({ x: state.distance + 800, type });
        state.lastObstacleX = state.distance + 800;
      }
    }

    // Coins
    if (state.distance > state.lastCoinX - 200) {
      const coinValue = Math.floor(Math.random() * 5) + 1; // Different amounts
      const terrainIdx = Math.floor((state.distance + 800) / 10) % 2000;
      const coinY = 350 + (state.terrain[terrainIdx] || 0) - 50 - Math.random() * 50;
      state.coins.push({ x: state.distance + 800, y: coinY, value: coinValue, collected: false });
      state.lastCoinX = state.distance + 800;
    }

    // Collision with obstacles
    state.obstacles = state.obstacles.filter(obs => {
      const screenX = obs.x - state.distance;
      if (screenX < -100) return false;
      
      const obstacleWidth = obs.type === 'big_stone' ? 40 : 20;
      const obstacleHeight = obs.type === 'big_stone' ? 30 : 15;
      const groundY = 350 + (state.terrain[Math.floor(obs.x / 10) % 2000] || 0);

      if (Math.abs(screenX - state.x) < (obstacleWidth / 2 + 15) && 
          state.y > groundY - 40 - obstacleHeight) {
        setGameOver(true);
        onGameOver();
      }
      return true;
    });

    // Collection of coins
    state.coins = state.coins.filter(coin => {
      if (coin.collected) return false;
      const screenX = coin.x - state.distance;
      if (screenX < -100) return false;

      const dist = Math.sqrt(Math.pow(screenX - state.x, 2) + Math.pow(coin.y - state.y, 2));
      if (dist < 40) {
        coin.collected = true;
        setCoinsCollected(prev => prev + coin.value);
        playSound('coin', soundEnabled);
        return false;
      }
      return true;
    });

    // Win condition
    if (state.distance / 10 >= config.targetDistance) {
      setLevelComplete(true);
      playSound('win', soundEnabled);
      onComplete(coins);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const state = gameState.current;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // --- Sky Gradient ---
    const skyGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    if (path === 'mountain') {
      skyGradient.addColorStop(0, '#0f172a'); // Deep night/dusk
      skyGradient.addColorStop(1, '#1e293b');
    } else if (path === 'plain') {
      skyGradient.addColorStop(0, '#0ea5e9'); // Bright sky
      skyGradient.addColorStop(1, '#bae6fd');
    } else {
      skyGradient.addColorStop(0, '#334155'); // Overcast
      skyGradient.addColorStop(1, '#94a3b8');
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // --- Sun / Moon with Glow ---
    const sunX = ctx.canvas.width - 150;
    const sunY = 100;
    const sunRadius = path === 'mountain' ? 30 : 45;
    
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = path === 'mountain' ? '#fde047' : '#fbbf24';
    ctx.fillStyle = path === 'mountain' ? '#fef08a' : '#fcd34d';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Parallax Layer 1: Distant Mountains/Hills ---
    ctx.fillStyle = path === 'mountain' ? '#1e293b' : path === 'plain' ? '#14532d' : '#334155';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, ctx.canvas.height);
    for (let i = 0; i <= ctx.canvas.width; i += 50) {
      const x = i;
      const parallaxDist = state.distance * 0.1;
      const height = 150 + Math.sin((x + parallaxDist) * 0.005) * 60 + Math.cos((x + parallaxDist) * 0.01) * 30;
      ctx.lineTo(x, ctx.canvas.height - height);
    }
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- Parallax Layer 2: Mid-ground Scenery (Clouds/Trees) ---
    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 5; i++) {
      const cloudX = ((i * 300 - state.distance * 0.2) % (ctx.canvas.width + 200)) - 100;
      const cloudY = 50 + (i * 30) % 100;
      if (cloudX > -200 && cloudX < ctx.canvas.width + 100) {
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 20, 0, Math.PI * 2);
        ctx.arc(cloudX + 25, cloudY - 10, 25, 0, Math.PI * 2);
        ctx.arc(cloudX + 50, cloudY, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mid-ground Hills
    ctx.fillStyle = path === 'mountain' ? '#334155' : path === 'plain' ? '#166534' : '#475569';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, ctx.canvas.height);
    for (let i = 0; i <= ctx.canvas.width; i += 20) {
      const x = i;
      const parallaxDist = state.distance * 0.3;
      const height = 100 + Math.sin((x + parallaxDist) * 0.01) * 40;
      ctx.lineTo(x, ctx.canvas.height - height);
    }
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- Foreground Terrain ---
    ctx.beginPath();
    ctx.moveTo(0, ctx.canvas.height);
    for (let i = 0; i < ctx.canvas.width; i += 10) {
      const terrainIdx = Math.floor((state.distance + i) / 10) % 2000;
      const y = 350 + (state.terrain[terrainIdx] || 0);
      ctx.lineTo(i, y);
    }
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
    
    // Terrain styling
    const terrainGradient = ctx.createLinearGradient(0, 300, 0, 500);
    if (path === 'mountain') {
      terrainGradient.addColorStop(0, '#78350f');
      terrainGradient.addColorStop(1, '#451a03');
    } else if (path === 'plain') {
      terrainGradient.addColorStop(0, '#166534');
      terrainGradient.addColorStop(1, '#064e3b');
    } else {
      terrainGradient.addColorStop(0, '#4b5563');
      terrainGradient.addColorStop(1, '#1f2937');
    }
    ctx.fillStyle = terrainGradient;
    ctx.fill();

    // Add some "grass" or "texture" to the terrain top
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < ctx.canvas.width; i += 20) {
      const terrainIdx = Math.floor((state.distance + i) / 10) % 2000;
      const y = 350 + (state.terrain[terrainIdx] || 0);
      ctx.moveTo(i, y);
      ctx.lineTo(i, y + 5);
    }
    ctx.stroke();

    // --- Obstacles ---
    state.obstacles.forEach(obs => {
      const screenX = obs.x - state.distance;
      const groundY = 350 + (state.terrain[Math.floor(obs.x / 10) % 2000] || 0);
      
      ctx.save();
      ctx.translate(screenX, groundY);
      
      if (obs.type === 'big_stone' || obs.type === 'small_stone') {
        const size = obs.type === 'big_stone' ? 1.5 : 0.8;
        ctx.scale(size, size);
        
        // Draw Stone
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-10, -15);
        ctx.lineTo(5, -20);
        ctx.lineTo(15, -10);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.fill();
        
        // Highlights
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, -15);
        ctx.lineTo(0, -10);
        ctx.lineTo(5, -20);
        ctx.stroke();
      } else {
        // Fallback for other types
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-10, -20, 20, 20);
      }
      
      ctx.restore();
    });

    // --- Coins ---
    state.coins.forEach(coin => {
      if (!coin.collected) {
        const screenX = coin.x - state.distance;
        ctx.save();
        ctx.translate(screenX, coin.y);
        
        // Coin Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
        
        // Coin Body
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Coin Border
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Coin Symbol ($)
        ctx.fillStyle = '#d97706';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(coin.value.toString(), 0, 0);
        
        ctx.restore();
      }
    });

    // --- Cycle + Boy ---
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.rotate(state.rotation);

    // Realistic Cycle Frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Main frame
    ctx.beginPath();
    ctx.moveTo(-20, 0); // Rear wheel hub
    ctx.lineTo(-5, -25); // Seat post top
    ctx.lineTo(15, -25); // Handlebar stem top
    ctx.lineTo(20, 0); // Front wheel hub
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-5, -25);
    ctx.lineTo(5, 0); // Bottom bracket
    ctx.lineTo(15, -25);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();

    // Seat
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(-8, -27, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Handlebars
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, -25);
    ctx.lineTo(22, -28);
    ctx.stroke();

    // Wheels with realistic tires
    const wheelRotation = (state.distance / 10) % (Math.PI * 2);
    
    const drawWheel = (x: number) => {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(wheelRotation);
      
      // Tire
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
      
      // Rim
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      
      // Spokes
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * Math.PI / 4) * 12, Math.sin(i * Math.PI / 4) * 12);
        ctx.stroke();
      }
      ctx.restore();
    };

    drawWheel(-20);
    drawWheel(20);

    // Realistic Boy (Cyclist)
    const pedalAngle = (state.distance / 20) % (Math.PI * 2);
    const legOffset = Math.sin(pedalAngle) * 8;
    
    ctx.strokeStyle = '#1e293b'; // Jersey/Pants color
    ctx.lineWidth = 6;
    
    // Torso (leaning forward)
    ctx.beginPath();
    ctx.moveTo(-5, -28); // On seat
    ctx.lineTo(10, -50); // Shoulder
    ctx.stroke();
    
    // Head with Helmet
    ctx.fillStyle = '#fca5a5'; // Skin
    ctx.beginPath();
    ctx.arc(12, -58, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ef4444'; // Helmet
    ctx.beginPath();
    ctx.arc(12, -62, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(3, -62, 18, 4);

    // Arms (reaching for bars)
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, -50);
    ctx.lineTo(20, -28);
    ctx.stroke();

    // Legs (pedaling realistically)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    
    // Left Leg
    ctx.beginPath();
    ctx.moveTo(-5, -28);
    ctx.lineTo(5 + Math.cos(pedalAngle) * 5, -10 + legOffset);
    ctx.stroke();
    
    // Right Leg
    ctx.beginPath();
    ctx.moveTo(-5, -28);
    ctx.lineTo(5 + Math.cos(pedalAngle + Math.PI) * 5, -10 - legOffset);
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      update();
      draw(ctx);
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, gameOver, levelComplete]);

  return (
    <div className="relative w-full h-[500px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full h-full"
      />
      
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white">
          <div className="text-xs uppercase tracking-widest opacity-70">Distance</div>
          <div className="text-2xl font-bold font-mono">{distance} / {config.targetDistance}m</div>
          <div className="flex justify-between gap-4 mt-2">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-70">Score</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{score}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest opacity-70">Coins</div>
              <div className="text-xl font-bold font-mono text-amber-400 flex items-center gap-1">
                <Coins size={16} /> {coins}
              </div>
            </div>
          </div>
          <div className="mt-4 text-[10px] uppercase tracking-widest opacity-50 hidden md:flex flex-col gap-1">
            <div className="flex items-center gap-2"><span className="bg-white/20 px-1 rounded">SPACE / UP</span> JUMP</div>
            <div className="flex items-center gap-2"><span className="bg-white/20 px-1 rounded">RIGHT</span> ACCELERATE</div>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/10 text-white transition-all"
          >
            {isPaused ? <Play size={24} /> : <Pause size={24} />}
          </button>
        </div>
      </div>

      {/* Bottom Operating Buttons (Mobile & Desktop) */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between items-center px-6 pointer-events-none">
        {/* Back Button */}
        <button 
          onClick={onExit}
          className="w-16 h-16 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/10 text-white flex flex-col items-center justify-center pointer-events-auto active:bg-slate-700 transition-all shadow-lg"
        >
          <Home size={24} />
          <span className="text-[10px] font-bold mt-1">BACK</span>
        </button>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onPointerDown={() => inputs.current.jump = true}
            onPointerUp={() => inputs.current.jump = false}
            className="w-20 h-20 bg-emerald-500/80 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col items-center justify-center text-white pointer-events-auto active:bg-emerald-400 transition-all shadow-lg"
          >
            <ChevronRight size={32} className="-rotate-90" />
            <span className="text-xs font-black mt-1">JUMP</span>
          </button>
          <button 
            onPointerDown={() => inputs.current.accelerate = true}
            onPointerUp={() => inputs.current.accelerate = false}
            className="w-20 h-20 bg-amber-500/80 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col items-center justify-center text-white pointer-events-auto active:bg-amber-400 transition-all shadow-lg"
          >
            <ChevronRight size={32} />
            <span className="text-xs font-black mt-1">RUN</span>
          </button>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {isPaused && !gameOver && !levelComplete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white"
          >
            <h2 className="text-4xl font-bold mb-6">Game Paused</h2>
            <button 
              onClick={() => setIsPaused(false)}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-full font-bold flex items-center gap-2 transition-all transform hover:scale-105"
            >
              <Play size={20} /> Resume
            </button>
          </motion.div>
        )}

        {gameOver && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-rose-950/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center"
          >
            <AlertTriangle size={64} className="text-rose-400 mb-4" />
            <h2 className="text-4xl font-bold mb-2">Game Over!</h2>
            <p className="text-rose-200 mb-8 max-w-xs">You hit an obstacle. Don't give up, try again!</p>
            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-full font-bold flex items-center gap-2 transition-all"
              >
                <RotateCcw size={20} /> Restart
              </button>
              <button 
                onClick={onExit}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold flex items-center gap-2 transition-all border border-white/20"
              >
                Menu
              </button>
            </div>
          </motion.div>
        )}

        {levelComplete && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-white p-8 text-center overflow-hidden"
          >
            {/* Party Poppers / Confetti Effect */}
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: i % 2 === 0 ? -400 : 400, 
                  y: 400, 
                  rotate: 0,
                  opacity: 1,
                  scale: 1
                }}
                animate={{ 
                  x: (Math.random() - 0.5) * 800,
                  y: -200 - Math.random() * 400, 
                  rotate: 720,
                  opacity: 0,
                  scale: 0.5
                }}
                transition={{ 
                  duration: 2 + Math.random() * 2, 
                  repeat: Infinity,
                  delay: Math.random() * 0.5,
                  ease: "easeOut"
                }}
                className="absolute w-3 h-3 rounded-sm"
                style={{ 
                  backgroundColor: ['#fbbf24', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#ec4899'][i % 6] 
                }}
              />
            ))}

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative z-10"
            >
              <div className="flex justify-center gap-4 mb-6">
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Star size={48} className="text-amber-400 fill-amber-400" />
                </motion.div>
                <Trophy size={80} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Star size={48} className="text-amber-400 fill-amber-400" />
                </motion.div>
              </div>

              <h2 className="text-6xl font-black mb-2 tracking-tighter italic">
                CONGRATULATIONS!
              </h2>
              <p className="text-2xl text-emerald-200 mb-8 font-medium">
                You've conquered Level {level}!
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10 max-w-sm mx-auto">
                <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                  <div className="text-xs uppercase tracking-widest opacity-60 mb-1">Total Score</div>
                  <div className="text-3xl font-bold text-emerald-400">{score}</div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                  <div className="text-xs uppercase tracking-widest opacity-60 mb-1">Coins Earned</div>
                  <div className="text-3xl font-bold text-amber-400 flex items-center justify-center gap-2">
                    <Coins size={24} /> {coins}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  playSound('click', soundEnabled);
                  onExit();
                }}
                className="group px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full font-black text-xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              >
                CONTINUE <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem('cycle-quest-save');
    return saved ? JSON.parse(saved) : {
      path: null,
      currentLevel: 1,
      unlockedLevels: { plain: 1, mountain: 1, hurdle: 1 },
      score: 0,
      distance: 0,
      coinsCollected: 0,
      isPaused: false,
      isGameOver: false,
      isLevelComplete: false,
      soundEnabled: true,
      musicEnabled: true,
    };
  });

  const [view, setView] = useState<'path' | 'level' | 'game'>('path');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (gameState.musicEnabled) {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 0.2;
      }
      audioRef.current.play().catch(() => {
        console.log('Autoplay blocked');
      });
    } else {
      audioRef.current?.pause();
    }
    return () => audioRef.current?.pause();
  }, [gameState.musicEnabled]);

  useEffect(() => {
    localStorage.setItem('cycle-quest-save', JSON.stringify(gameState));
  }, [gameState]);

  const selectPath = (path: PathType) => {
    playSound('click', gameState.soundEnabled);
    setGameState(prev => ({ ...prev, path }));
    setView('level');
  };

  const selectLevel = (level: number) => {
    playSound('click', gameState.soundEnabled);
    setGameState(prev => ({ ...prev, currentLevel: level }));
    setView('game');
  };

  const handleLevelComplete = (levelCoins: number) => {
    if (gameState.path) {
      const nextLevel = gameState.currentLevel + 1;
      const currentUnlocked = gameState.unlockedLevels[gameState.path];
      
      setGameState(prev => ({
        ...prev,
        coinsCollected: prev.coinsCollected + levelCoins,
        unlockedLevels: {
          ...prev.unlockedLevels,
          [gameState.path!]: Math.max(currentUnlocked, Math.min(nextLevel, LEVELS_PER_PATH))
        }
      }));
    }
  };

  const toggleSound = () => {
    setGameState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
    playSound('click', !gameState.soundEnabled);
  };

  const toggleMusic = () => {
    setGameState(prev => ({ ...prev, musicEnabled: !prev.musicEnabled }));
    playSound('click', gameState.soundEnabled);
  };

  return (
    <div className="min-h-screen relative text-slate-200 font-sans selection:bg-emerald-500/30 overflow-hidden">
      {/* Realistic Background Image */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{ 
          backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80')`,
          filter: view === 'game' ? 'brightness(0.3) blur(4px)' : 'brightness(0.6)'
        }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-900/80" />

      {/* Decorative Stones on Home Page */}
      <div className="fixed bottom-0 left-0 right-0 h-32 z-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-4 left-[10%] w-24 h-16 bg-slate-700 rounded-full blur-sm opacity-40 transform -rotate-12" />
        <div className="absolute bottom-8 left-[15%] w-16 h-12 bg-slate-600 rounded-full blur-sm opacity-30 transform rotate-45" />
        <div className="absolute bottom-2 right-[20%] w-32 h-20 bg-slate-800 rounded-full blur-sm opacity-50 transform rotate-12" />
        <div className="absolute bottom-6 right-[10%] w-20 h-14 bg-slate-700 rounded-full blur-sm opacity-40 transform -rotate-45" />
        
        {/* SVG Stones for more detail */}
        <svg className="absolute bottom-0 left-0 w-full h-full opacity-60" viewBox="0 0 800 100">
          <path d="M50,100 L70,80 L100,75 L130,85 L150,100 Z" fill="#4b5563" />
          <path d="M200,100 L220,90 L250,88 L280,95 L300,100 Z" fill="#374151" />
          <path d="M600,100 L630,70 L670,65 L710,80 L750,100 Z" fill="#4b5563" />
          <path d="M450,100 L470,92 L500,90 L530,96 L550,100 Z" fill="#1f2937" />
        </svg>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex justify-center gap-4 mb-8">
            <button 
              onClick={toggleSound}
              className={`p-3 rounded-2xl border transition-all ${gameState.soundEnabled ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}
            >
              {gameState.soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
            <button 
              onClick={toggleMusic}
              className={`p-3 rounded-2xl border transition-all ${gameState.musicEnabled ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}
            >
              <Music size={24} className={gameState.musicEnabled ? 'animate-pulse' : ''} />
            </button>
          </div>
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 mb-4"
          >
            <Bike size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Cycle Quest</span>
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4 italic">
            RIDE THE <span className="text-emerald-500">LIMIT</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Master the terrain, dodge obstacles, and become the ultimate cycle champion across 15 challenging levels.
          </p>
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-8 inline-flex items-center gap-4 px-6 py-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400"
          >
            <div className="flex items-center gap-2">
              <Coins size={24} className="animate-pulse" />
              <span className="text-sm uppercase tracking-widest font-bold">Total Coins</span>
            </div>
            <div className="text-3xl font-black font-mono">{gameState.coinsCollected}</div>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'path' && (
            <motion.div 
              key="path-selection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {PATHS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPath(p.id)}
                  className="group relative overflow-hidden rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 transition-all p-8 text-left"
                >
                  <div className={`w-16 h-16 rounded-2xl ${p.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    {p.id === 'plain' && <Route className="text-white" size={32} />}
                    {p.id === 'mountain' && <Mountain className="text-white" size={32} />}
                    {p.id === 'hurdle' && <AlertTriangle className="text-white" size={32} />}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{p.label}</h3>
                  <p className="text-slate-400 text-sm mb-6">{p.description}</p>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    Select Path <ChevronRight size={16} />
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    {p.id === 'plain' && <Route size={80} />}
                    {p.id === 'mountain' && <Mountain size={80} />}
                    {p.id === 'hurdle' && <AlertTriangle size={80} />}
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {view === 'level' && gameState.path && (
            <motion.div 
              key="level-selection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-slate-800/30 rounded-[2.5rem] p-8 md:p-12 border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <button 
                    onClick={() => setView('path')}
                    className="text-slate-400 hover:text-white flex items-center gap-2 text-sm mb-2 transition-colors"
                  >
                    <ChevronRight size={16} className="rotate-180" /> Back to Paths
                  </button>
                  <h2 className="text-3xl font-bold text-white">Select Level</h2>
                </div>
                <div className="px-4 py-2 bg-slate-700/50 rounded-2xl border border-slate-600 text-slate-300 text-sm font-medium">
                  Path: <span className="text-white font-bold capitalize">{gameState.path}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Array.from({ length: LEVELS_PER_PATH }).map((_, i) => {
                  const levelNum = i + 1;
                  const isUnlocked = levelNum <= gameState.unlockedLevels[gameState.path!];
                  
                  return (
                    <button
                      key={levelNum}
                      disabled={!isUnlocked}
                      onClick={() => selectLevel(levelNum)}
                      className={`
                        aspect-square rounded-3xl flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden
                        ${isUnlocked 
                          ? 'bg-slate-700 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/20' 
                          : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-700/50'}
                      `}
                    >
                      <span className="text-3xl font-black">{levelNum}</span>
                      {!isUnlocked && <Lock size={16} />}
                      {isUnlocked && <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">Level</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'game' && gameState.path && (
            <motion.div 
              key="game-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <GameView 
                path={gameState.path}
                level={gameState.currentLevel}
                soundEnabled={gameState.soundEnabled}
                onComplete={handleLevelComplete}
                onGameOver={() => {}}
                onExit={() => {
                  playSound('click', gameState.soundEnabled);
                  setView('level');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-sm tracking-widest uppercase font-medium">
            Developed by <span className="text-slate-300 font-bold">Dhanashri Hajare</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
