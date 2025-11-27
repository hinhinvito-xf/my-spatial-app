import { useState, useEffect, useCallback } from 'react';
// We assume Direction is exported from MapCanvas, or we define it here compatible with it
type Direction = 'down' | 'up' | 'left' | 'right';

interface MapData {
  width: number;
  height: number;
  tiles: number[][];
}

export const useAvatarMovement = (
  initialX: number, 
  initialY: number, 
  mapData: MapData | null
) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [direction, setDirection] = useState<Direction>('down');

  const isWalkable = useCallback((x: number, y: number) => {
    if (!mapData) return false;
    if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return false;
    return mapData.tiles[y][x] === 0;
  }, [mapData]);

  const move = useCallback((dx: number, dy: number, newDir: Direction) => {
    setDirection(newDir); // Always update facing direction
    
    setPosition((prev) => {
      const newX = prev.x + dx;
      const newY = prev.y + dy;
      if (isWalkable(newX, newY)) {
        return { x: newX, y: newY };
      }
      return prev;
    });
  }, [isWalkable]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w','a','s','d'].includes(e.key)) {
        // e.preventDefault(); // Optional: stop scroll
      }

      switch (e.key) {
        case 'ArrowUp': case 'w':
          move(0, -1, 'up');
          break;
        case 'ArrowDown': case 's':
          move(0, 1, 'down');
          break;
        case 'ArrowLeft': case 'a':
          move(-1, 0, 'left');
          break;
        case 'ArrowRight': case 'd':
          move(1, 0, 'right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  return { x: position.x, y: position.y, direction };
};