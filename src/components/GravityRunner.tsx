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
    keys: {
      space: false
    }
  });

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;
  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const GROUND_Y = CANVAS_HEIGHT - 50;
  const CEILING_Y = 50;

  const createObstacle = useCallback(() => {
    const now = Date.now();
    if (now - gameState.current.lastObstacleTime < 2000) return;

    const isTop = Math.random() < 0.5;
    const obstacle: Obstacle = {
      id: now,
      x: CANVAS_WIDTH,
      y: isTop ? CEILING_Y : GROUND_Y - 80,
      width: 20,
      height: 80,
      isTop
    };

    gameState.current.obstacles.push(obstacle);
    gameState.current.lastObstacleTime = now;
  }, []);

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
    if (!player.gravityFlipped) {
      if (player.y + player.height >= GROUND_Y) {
        player.y = GROUND_Y - player.height;
        player.velocityY = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
    } else {
      if (player.y <= CEILING_Y) {
        player.y = CEILING_Y;
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

    // Increase game speed gradually
    state.gameSpeed = Math.min(8, 3 + state.score * 0.01);
  }, [createObstacle, createParticles, checkCollision, highScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameState.current;
    const player = state.player;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, 'hsl(220, 25%, 4%)');
    gradient.addColorStop(1, 'hsl(220, 20%, 6%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw floor and ceiling
    ctx.fillStyle = 'hsl(200, 80%, 50%)';
    ctx.shadowColor = 'hsl(200, 80%, 50%)';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 50);
    ctx.fillRect(0, 0, CANVAS_WIDTH, CEILING_Y);
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
  }, []);

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
    gameState.current = {
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
      obstacles: [],
      particles: [],
      gameSpeed: 3,
      lastObstacleTime: 0,
      score: 0,
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
    <div className="flex flex-col items-center justify-center min-h-screen game-bg p-4">
      <Card className="p-6 bg-card/90 backdrop-blur-sm border-border neon-glow">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Gravity Runner
          </h1>
          <div className="flex justify-center gap-8 text-lg">
            <div>Score: <span className="text-primary font-bold">{score}</span></div>
            <div>High Score: <span className="text-accent font-bold">{highScore}</span></div>
          </div>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-border rounded-lg cursor-pointer game-glow"
            onClick={handleTouch}
          />
          
          {!gameStarted && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-primary mb-4">Ready to Run?</h2>
                <p className="text-muted-foreground mb-4">Press SPACE or tap to flip gravity!</p>
                <Button onClick={startGame} variant="default" className="neon-glow">
                  Start Game
                </Button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-destructive mb-2">Game Over!</h2>
                <p className="text-xl text-primary mb-2">Final Score: {score}</p>
                {score === highScore && score > 0 && (
                  <p className="text-accent font-bold mb-4">🎉 NEW HIGH SCORE! 🎉</p>
                )}
                <p className="text-muted-foreground mb-4">Press SPACE or tap to play again!</p>
                <Button onClick={startGame} variant="default" className="neon-glow">
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-4 text-sm text-muted-foreground">
          <p>Use SPACE or tap to flip gravity • Avoid obstacles • Score points!</p>
        </div>
      </Card>
    </div>
  );
};

export default GravityRunner;