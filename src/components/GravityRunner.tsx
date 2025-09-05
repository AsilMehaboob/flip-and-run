import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isTop: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const GravityRunner = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [timeAlive, setTimeAlive] = useState(0);
  const [canvasSize] = useState({ width: 360, height: 640 }); // Fixed mobile portrait
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('gravityRunnerHighScore') || '0');
  });
  
  // Game state
  const gameState = useRef({
    player: {
      x: 100,
      y: 300,
      width: 30,
      height: 30,
      velocityY: 0,
      onGround: true,
      gravityFlipped: false,
      isFlipping: false,
      flipStartTime: 0
    },
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    gameSpeed: 3,
    lastObstacleTime: 0,
    score: 0,
    distance: 0,
    startTime: 0,
    keys: {
      space: false
    }
  });

  // Fixed mobile dimensions
  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const getGroundY = () => canvasSize.height - 50;
  const getCeilingY = () => 50;
  const getPlayerSize = () => 25; // Fixed size for mobile

  // Progressive difficulty system
  const getDifficultyLevel = (score: number) => Math.floor(score / 100);
  const getObstacleSpacing = (level: number) => Math.max(800, 1500 - (level * 100));
  const getObstacleVariety = (level: number) => Math.min(4, 1 + Math.floor(level / 2));
  
  const createObstacle = useCallback(() => {
    const now = Date.now();
    const level = getDifficultyLevel(gameState.current.score);
    const spacing = getObstacleSpacing(level);
    
    if (now - gameState.current.lastObstacleTime < spacing) return;

    const variety = getObstacleVariety(level);
    const pattern = Math.floor(Math.random() * variety);
    
    // Different obstacle patterns based on difficulty
    switch (pattern) {
      case 0: // Single obstacle
        createSingleObstacle(now);
        break;
      case 1: // Double stack (top and bottom)
        createDoubleObstacle(now);
        break;
      case 2: // Narrow gap
        createNarrowGap(now);
        break;
      case 3: // Spike pattern
        createSpikePattern(now);
        break;
      default:
        createSingleObstacle(now);
    }

    gameState.current.lastObstacleTime = now;
  }, []);

  const createSingleObstacle = (id: number) => {
    const isTop = Math.random() < 0.5;
    const height = canvasSize.height * (0.15 + Math.random() * 0.15);
    const obstacle: Obstacle = {
      id,
      x: canvasSize.width,
      y: isTop ? getCeilingY() : getGroundY() - height,
      width: 20,
      height,
      isTop
    };
    gameState.current.obstacles.push(obstacle);
  };

  const createDoubleObstacle = (id: number) => {
    const gap = canvasSize.height * 0.4;
    const topHeight = canvasSize.height * 0.2;
    const bottomHeight = canvasSize.height - gap - topHeight - 100;
    
    gameState.current.obstacles.push({
      id: id,
      x: canvasSize.width,
      y: getCeilingY(),
      width: 20,
      height: topHeight,
      isTop: true
    });
    
    gameState.current.obstacles.push({
      id: id + 0.1,
      x: canvasSize.width,
      y: getGroundY() - bottomHeight,
      width: 20,
      height: bottomHeight,
      isTop: false
    });
  };

  const createNarrowGap = (id: number) => {
    const gap = Math.max(80, canvasSize.height * 0.25);
    const gapStart = getCeilingY() + 50 + Math.random() * (canvasSize.height - gap - 150);
    
    gameState.current.obstacles.push({
      id: id,
      x: canvasSize.width,
      y: getCeilingY(),
      width: 25,
      height: gapStart - getCeilingY(),
      isTop: true
    });
    
    gameState.current.obstacles.push({
      id: id + 0.1,
      x: canvasSize.width,
      y: gapStart + gap,
      width: 25,
      height: getGroundY() - (gapStart + gap),
      isTop: false
    });
  };

  const createSpikePattern = (id: number) => {
    const spikeCount = 3 + Math.floor(Math.random() * 3);
    const spacing = 15;
    
    for (let i = 0; i < spikeCount; i++) {
      const isTop = Math.random() < 0.5;
      const height = 40 + Math.random() * 60;
      
      gameState.current.obstacles.push({
        id: id + i * 0.1,
        x: canvasSize.width + i * spacing,
        y: isTop ? getCeilingY() : getGroundY() - height,
        width: 12,
        height,
        isTop
      });
    }
  };

  const createParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      const particle: Particle = {
        id: Date.now() + i,
        x: x + Math.random() * 20 - 10,
        y: y + Math.random() * 20 - 10,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1
      };
      gameState.current.particles.push(particle);
    }
  }, []);

  const checkCollision = useCallback((rect1: any, rect2: any) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }, []);

  const updateGame = useCallback(() => {
    const state = gameState.current;
    const player = state.player;

    // Update distance and time tracking
    state.distance += state.gameSpeed;
    const currentTime = Date.now();
    if (state.startTime === 0) state.startTime = currentTime;
    const timeAliveSeconds = Math.floor((currentTime - state.startTime) / 1000);
    setDistance(Math.floor(state.distance));
    setTimeAlive(timeAliveSeconds);

    // Handle gravity flip
    if (state.keys.space && !player.isFlipping) {
      player.gravityFlipped = !player.gravityFlipped;
      player.isFlipping = true;
      player.flipStartTime = Date.now();
      player.velocityY = player.gravityFlipped ? JUMP_FORCE : -JUMP_FORCE;
      createParticles(player.x + player.width/2, player.y + player.height/2);
    }

    // Update flip animation
    if (player.isFlipping && Date.now() - player.flipStartTime > 300) {
      player.isFlipping = false;
    }

    // Apply gravity
    const gravity = player.gravityFlipped ? -GRAVITY : GRAVITY;
    player.velocityY += gravity;

    // Update player position
    player.y += player.velocityY;

    // Ground/ceiling collision
    const groundY = getGroundY();
    const ceilingY = getCeilingY();
    
    if (!player.gravityFlipped) {
      if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.velocityY = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
    } else {
      if (player.y <= ceilingY) {
        player.y = ceilingY;
        player.velocityY = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
    }

    // Create obstacles
    createObstacle();

    // Update obstacles
    state.obstacles = state.obstacles.filter(obstacle => {
      obstacle.x -= state.gameSpeed;
      
      // Remove off-screen obstacles and award points
      if (obstacle.x + obstacle.width < 0) {
        state.score += 10;
        setScore(state.score);
        return false;
      }
      
      // Check collision
      if (checkCollision(player, obstacle)) {
        setGameOver(true);
        if (state.score > highScore) {
          setHighScore(state.score);
          localStorage.setItem('gravityRunnerHighScore', state.score.toString());
          toast.success("New High Score!");
        }
        return false;
      }
      
      return true;
    });

    // Update particles
    state.particles = state.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= 0.02;
      return particle.life > 0;
    });

    // Progressive speed increase - gets faster with distance and levels
    const level = getDifficultyLevel(state.score);
    const baseSpeed = 4;
    const speedMultiplier = 1 + (level * 0.3) + (state.distance * 0.0001);
    state.gameSpeed = Math.min(12, baseSpeed * speedMultiplier);
  }, [createObstacle, createParticles, checkCollision, highScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameState.current;
    const player = state.player;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height);
    gradient.addColorStop(0, 'hsl(220, 25%, 4%)');
    gradient.addColorStop(1, 'hsl(220, 20%, 6%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw floor and ceiling
    ctx.fillStyle = 'hsl(200, 80%, 50%)';
    ctx.shadowColor = 'hsl(200, 80%, 50%)';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, getGroundY(), canvasSize.width, 50);
    ctx.fillRect(0, 0, canvasSize.width, getCeilingY());
    ctx.shadowBlur = 0;

    // Draw particles
    state.particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = 'hsl(180, 100%, 80%)';
      ctx.shadowColor = 'hsl(180, 100%, 80%)';
      ctx.shadowBlur = 5;
      ctx.fillRect(particle.x, particle.y, 3, 3);
      ctx.restore();
    });

    // Draw player with flip animation
    ctx.save();
    if (player.isFlipping) {
      const flipProgress = (Date.now() - player.flipStartTime) / 300;
      const scale = 1 + Math.sin(flipProgress * Math.PI) * 0.3;
      ctx.translate(player.x + player.width/2, player.y + player.height/2);
      ctx.scale(scale, 1);
      ctx.translate(-player.width/2, -player.height/2);
    } else {
      ctx.translate(player.x, player.y);
    }
    
    ctx.fillStyle = 'hsl(280, 100%, 70%)';
    ctx.shadowColor = 'hsl(280, 100%, 70%)';
    ctx.shadowBlur = 15;
    ctx.fillRect(0, 0, player.width, player.height);
    ctx.restore();

    // Draw obstacles
    state.obstacles.forEach(obstacle => {
      ctx.fillStyle = 'hsl(0, 100%, 60%)';
      ctx.shadowColor = 'hsl(0, 100%, 60%)';
      ctx.shadowBlur = 10;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });

    ctx.shadowBlur = 0;
  }, [canvasSize]);

  const gameLoop = useCallback(() => {
    if (!gameOver && gameStarted) {
      updateGame();
      draw();
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, gameOver, updateGame, draw]);

  const startGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setDistance(0);
    setTimeAlive(0);
    
    const playerSize = getPlayerSize();
    const startY = canvasSize.height / 2;
    
    gameState.current = {
      player: {
        x: canvasSize.width * 0.15,
        y: startY,
        width: playerSize,
        height: playerSize,
        velocityY: 0,
        onGround: true,
        gravityFlipped: false,
        isFlipping: false,
        flipStartTime: 0
      },
      obstacles: [],
      particles: [],
      gameSpeed: 4,
      lastObstacleTime: 0,
      score: 0,
      distance: 0,
      startTime: 0,
      keys: { space: false }
    };
    toast.success("Game Started! Press SPACE to flip gravity!");
  }, []);

  const resetGame = useCallback(() => {
    setGameStarted(false);
    setGameOver(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameStarted && !gameOver) {
          startGame();
        } else if (gameStarted && !gameOver) {
          gameState.current.keys.space = true;
        } else if (gameOver) {
          startGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        gameState.current.keys.space = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, gameOver, startGame]);

  // Touch controls
  const handleTouch = useCallback(() => {
    if (!gameStarted && !gameOver) {
      startGame();
    } else if (gameStarted && !gameOver) {
      gameState.current.keys.space = true;
      setTimeout(() => {
        gameState.current.keys.space = false;
      }, 100);
    } else if (gameOver) {
      startGame();
    }
  }, [gameStarted, gameOver, startGame]);

  // Initialize canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }
  }, []);

  // Start game loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStarted, gameOver, gameLoop]);

  return (
    <div className="fixed inset-0 game-bg flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4">
        <div className="text-center">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Gravity Runner
          </h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="text-center">
              <div className="text-primary font-bold text-lg">{score}</div>
              <div className="text-muted-foreground">Score</div>
            </div>
            <div className="text-center">
              <div className="text-accent font-bold text-lg">{distance}m</div>
              <div className="text-muted-foreground">Distance</div>
            </div>
            <div className="text-center">
              <div className="text-secondary font-bold text-lg">{timeAlive}s</div>
              <div className="text-muted-foreground">Time</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-bold text-lg">{highScore}</div>
              <div className="text-muted-foreground">Best</div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Canvas Container - Fixed Mobile Portrait */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="relative aspect-[9/16] w-full max-w-sm max-h-full">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="w-full h-full border border-border rounded-lg cursor-pointer game-glow bg-game-bg object-contain"
            onClick={handleTouch}
            style={{ touchAction: 'none' }}
          />
          
          {!gameStarted && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="text-center p-4">
                <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4">Ready to Run?</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">Press SPACE or tap to flip gravity!</p>
                <Button onClick={startGame} variant="default" className="neon-glow">
                  Start Game
                </Button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg">
              <div className="text-center p-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-destructive mb-2">Game Over!</h2>
                <p className="text-lg sm:text-xl text-primary mb-2">Final Score: {score}</p>
                {score === highScore && score > 0 && (
                  <p className="text-accent font-bold mb-4">🎉 NEW HIGH SCORE! 🎉</p>
                )}
                <p className="text-sm sm:text-base text-muted-foreground mb-4">Press SPACE or tap to play again!</p>
                <Button onClick={startGame} variant="default" className="neon-glow">
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="flex-shrink-0 p-2">
        <div className="text-center text-xs sm:text-sm text-muted-foreground">
          <p>Use SPACE or tap to flip gravity • Avoid obstacles • Score points!</p>
        </div>
      </div>
    </div>
  );
};

export default GravityRunner;