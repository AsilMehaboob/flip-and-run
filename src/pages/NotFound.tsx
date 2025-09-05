import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center game-bg">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <Button asChild variant="default" className="neon-glow">
          <a href="/">Return to Game</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
