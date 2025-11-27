import React, { useRef, useEffect, useState } from 'react';

// --- Types ---
export interface AvatarConfig { hat: string; hair: string; face: string; shirt: string; pants: string; shoes: string; skin: string; }
export interface Position { x: number; y: number; }
export type Direction = 'down' | 'up' | 'left' | 'right';
export interface User { id: string; displayName: string; x: number; y: number; avatarConfig?: AvatarConfig; isSpeaking?: boolean; direction?: Direction; isCameraOn?: boolean; }
export interface MapObject { id: string; type: 'decor' | 'url_iframe' | 'doc_link'; x: number; y: number; width: number; height: number; color?: string; }
export interface MapData { width: number; height: number; tiles: number[][]; spawnPoints: Position[]; objects: MapObject[]; }

export interface InteractiveObject {
  id: string;
  type: 'image' | 'video' | 'iframe';
  x: number; 
  y: number; 
  width: number; 
  height: number;
  src: string;
}

interface MapCanvasProps {
  mapData: MapData | null; 
  currentUser: User; 
  otherUsers: User[];
  onInteract?: (object: MapObject) => void;
  localVideo?: HTMLVideoElement | null; 
  remoteVideos?: Record<string, HTMLVideoElement>;
  backgroundImage?: string | null;
  interactiveObjects?: InteractiveObject[];
  onUpdateObject?: (obj: InteractiveObject) => void;
  onDeleteObject?: (id: string) => void; // NEW PROP
}

const TILE_SIZE = 48;

const getYouTubeEmbed = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=0&enablejsapi=1` : null;
};

// ... (drawHumanSprite is unchanged) ...
export const drawHumanSprite = (ctx: CanvasRenderingContext2D, config: AvatarConfig | undefined, dir: Direction = 'down', isMoving: boolean = false, scale: number = 1, videoElement?: HTMLVideoElement | null) => {
  const c = config || { hat: 'none', hair: 'none', face: 'neutral', shirt: '#3b82f6', pants: '#000', shoes: '#000', skin: '#fca5a5' };
  ctx.save(); ctx.scale(scale, scale);
  const rect = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const bob = isMoving ? Math.sin(Date.now() / 150) * 1 : 0;
  const legOffset = isMoving ? Math.sin(Date.now() / 150) * 3 : 0;
  rect(c.pants, 10, 20, 5, 8); rect(c.shoes, 9, 28 + (dir === 'left' || dir === 'right' ? legOffset : 0), 7, 4); 
  rect(c.pants, 17, 20, 5, 8); rect(c.shoes, 16, 28 - (dir === 'left' || dir === 'right' ? legOffset : 0), 7, 4); 
  const bodyY = 12 + bob;
  rect(c.shirt, 8, bodyY, 16, 10); 
  if (dir === 'down') { rect(c.skin, 6, bodyY, 3, 8); rect(c.shirt, 6, bodyY, 3, 4); rect(c.skin, 23, bodyY, 3, 8); rect(c.shirt, 23, bodyY, 3, 4); } 
  else if (dir === 'up') { rect(c.shirt, 6, bodyY, 3, 8); rect(c.shirt, 23, bodyY, 3, 8); } 
  else { rect(c.shirt, 14, bodyY + 2, 4, 8); }
  const headY = 2 + bob;
  rect(c.skin, 9, headY, 14, 12); 
  if (videoElement && dir === 'down') {
    ctx.save(); ctx.beginPath(); ctx.rect(9, headY, 14, 12); ctx.clip(); try { ctx.drawImage(videoElement, 9, headY, 14, 12); } catch (e) {} ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(9.5, headY+0.5, 13, 11);
  } else {
    if (dir === 'down' || dir === 'right' || dir === 'left') {
        const eyeY = headY + 4; const mouthY = headY + 9;
        if (dir === 'down') {
          if (c.face === 'cool') { rect('#111', 9, eyeY, 14, 4); rect('#000', 10, eyeY+1, 5, 2); rect('#000', 17, eyeY+1, 5, 2); rect('#fff', 11, eyeY+1, 1, 1); rect('#fff', 18, eyeY+1, 1, 1); rect('#333', 14, mouthY, 4, 1); rect('#333', 18, mouthY-1, 1, 1); } 
          else if (c.face === 'tired') { rect('#1e293b', 11, eyeY+1, 2, 2); rect('#1e293b', 19, eyeY+1, 2, 2); rect('rgba(0,0,0,0.2)', 10, eyeY+3, 4, 1); rect('rgba(0,0,0,0.2)', 18, eyeY+3, 4, 1); rect('#333', 13, mouthY+1, 6, 1); } 
          else if (c.face === 'surprised') { rect('#1e293b', 10, eyeY, 3, 3); rect('#fff', 11, eyeY+1, 1, 1); rect('#1e293b', 19, eyeY, 3, 3); rect('#fff', 20, eyeY+1, 1, 1); rect('#111', 14, mouthY, 4, 3); } 
          else if (c.face === 'angry') { rect('#1e293b', 11, eyeY+1, 2, 2); rect('#1e293b', 19, eyeY+1, 2, 2); rect('#111', 10, eyeY-1, 4, 1); rect('#111', 18, eyeY-1, 4, 1); rect('#333', 13, mouthY+1, 6, 1); } 
          else if (c.face === 'smile') { rect('#1e293b', 11, eyeY, 2, 2); rect('#1e293b', 19, eyeY, 2, 2); rect('#f472b6', 9, eyeY+3, 2, 1); rect('#f472b6', 21, eyeY+3, 2, 1); rect('#333', 12, mouthY, 8, 1); rect('#333', 11, mouthY-1, 1, 1); rect('#333', 20, mouthY-1, 1, 1); } 
          else { rect('#1e293b', 11, eyeY, 2, 2); rect('#1e293b', 19, eyeY, 2, 2); rect('#333', 13, mouthY, 6, 1); }
        } else { const eyeX = dir === 'right' ? 20 : 10; rect('#1e293b', eyeX, eyeY, 2, 2); }
    }
  }
  if (c.hair !== 'none' && c.hat !== 'helmet') {
    const hairColor = c.hair === 'blonde' ? '#fcd34d' : c.hair === 'brown' ? '#78350f' : c.hair === 'red' ? '#ef4444' : c.hair === 'white' ? '#f1f5f9' : '#111';
    rect(hairColor, 8, headY - 2, 16, 4); 
    if (dir === 'down') { if (c.hair === 'long' || c.hair === 'messy' || c.hair === 'bob') rect(hairColor, 8, headY, 4, 8); if (c.hair === 'long' || c.hair === 'messy' || c.hair === 'bob') rect(hairColor, 20, headY, 4, 8); } 
    else if (dir === 'up') { rect(hairColor, 8, headY, 16, 12); }
    if (c.hair === 'long') rect(hairColor, 8, headY + 6, 16, 8); if (c.hair === 'spiky') rect(hairColor, 12, headY - 4, 8, 4); if (c.hair === 'bob') rect(hairColor, 8, headY + 8, 16, 2);
  }
  if (c.hat !== 'none') {
    const hatY = headY - 2;
    if (c.hat === 'cap') { rect('#ef4444', 8, hatY, 16, 4); if (dir === 'down') rect('#ef4444', 8, hatY + 2, 16, 2); if (dir === 'right') rect('#ef4444', 16, hatY + 2, 8, 2); } 
    else if (c.hat === 'tophat') { rect('#111', 8, hatY + 2, 16, 2); rect('#111', 10, hatY - 8, 12, 10); } 
    else if (c.hat === 'beanie') { rect('#3b82f6', 8, hatY, 16, 5); rect('#1d4ed8', 8, hatY + 3, 16, 2); } 
    else if (c.hat === 'cowboy') { rect('#78350f', 6, hatY + 2, 20, 2); rect('#78350f', 10, hatY - 4, 12, 6); } 
    else if (c.hat === 'helmet') { rect('#94a3b8', 8, headY - 2, 16, 14); rect('#333', 12, headY + 4, 8, 2); }
  }
  ctx.restore();
};

export const MapCanvas: React.FC<MapCanvasProps> = ({ mapData, currentUser, otherUsers, onInteract, localVideo, remoteVideos, backgroundImage, interactiveObjects = [], onUpdateObject, onDeleteObject }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectsLayerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<number>(1.0); 
  const backgroundImgRef = useRef<HTMLImageElement | null>(null);
  const mediaRefs = useRef<Record<string, HTMLVideoElement | HTMLIFrameElement>>({});
  
  const [dragState, setDragState] = useState<{ id: string, startX: number, startY: number, initX: number, initY: number, initW: number, initH: number, mode: 'move' | 'resize' } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isAdmin = currentUser.displayName === 'AdminXiangFei123';

  useEffect(() => {
    if (backgroundImage) { const img = new Image(); img.src = backgroundImage; img.onload = () => { backgroundImgRef.current = img; }; } 
    else { backgroundImgRef.current = null; }
  }, [backgroundImage]);

  // --- SPATIAL AUDIO LOGIC ---
  useEffect(() => {
    const interval = setInterval(() => {
        if (!currentUser) return;
        interactiveObjects?.forEach(obj => {
            const el = mediaRefs.current[obj.id];
            if (!el) return;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            const dist = Math.sqrt(Math.pow(currentUser.x - cx, 2) + Math.pow(currentUser.y - cy, 2));
            let vol = 0;
            if (dist < 4) vol = 100; else if (dist < 12) vol = Math.floor(100 - ((dist - 4) / 8) * 100);
            
            const isYouTube = obj.type === 'video' && (getYouTubeEmbed(obj.src) !== null);
            if (isYouTube) {
                const iframe = el as HTMLIFrameElement;
                if (iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), '*');
            } else if (obj.type === 'video') {
                (el as HTMLVideoElement).volume = vol / 100;
            }
        });
    }, 200);
    return () => clearInterval(interval);
  }, [currentUser, interactiveObjects]);

  // --- INTERACTION HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, obj: InteractiveObject, mode: 'move' | 'resize') => {
    if (!isAdmin) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedId(obj.id);
    setDragState({ id: obj.id, startX: e.clientX, startY: e.clientY, initX: obj.x, initY: obj.y, initW: obj.width, initH: obj.height, mode });
  };

  const handleContextMenu = (e: React.MouseEvent, obj: InteractiveObject) => {
    if (!isAdmin) return;
    e.preventDefault();
    setSelectedId(obj.id); 
  };

  const handleMapClick = () => { setSelectedId(null); };

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
        const zoom = zoomRef.current;
        const dx = (e.clientX - dragState.startX) / (TILE_SIZE * zoom);
        const dy = (e.clientY - dragState.startY) / (TILE_SIZE * zoom);
        let newObj = { ...interactiveObjects.find(o => o.id === dragState.id)! };
        if (dragState.mode === 'move') { newObj.x = dragState.initX + dx; newObj.y = dragState.initY + dy; } 
        else { newObj.width = Math.max(2, dragState.initW + dx); newObj.height = Math.max(2, dragState.initH + dy); }
        if (onUpdateObject) onUpdateObject(newObj);
    };
    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, interactiveObjects, onUpdateObject]);

  const render = () => {
    if (!canvasRef.current || !mapData) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.restore(); 
    const logicalW = canvasRef.current.width / dpr; const logicalH = canvasRef.current.height / dpr; const px = currentUser.x * TILE_SIZE + TILE_SIZE/2; const py = currentUser.y * TILE_SIZE + TILE_SIZE/2; const zoom = zoomRef.current;

    if (objectsLayerRef.current) {
        const tx = (logicalW / 2) - (px * zoom);
        const ty = (logicalH / 2) - (py * zoom);
        objectsLayerRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
    }

    ctx.save(); ctx.translate(logicalW / 2, logicalH / 2); ctx.scale(zoom, zoom); ctx.translate(-px, -py);

    if (backgroundImgRef.current) { const mapPixelWidth = mapData.width * TILE_SIZE; const mapPixelHeight = mapData.height * TILE_SIZE; ctx.drawImage(backgroundImgRef.current, 0, 0, mapPixelWidth, mapPixelHeight); } 
    else { const vw = logicalW/zoom; const vh = logicalH/zoom; const startCol = Math.floor((px - vw/2)/TILE_SIZE)-1; const endCol = startCol + Math.ceil(vw/TILE_SIZE)+2; const startRow = Math.floor((py - vh/2)/TILE_SIZE)-1; const endRow = startRow + Math.ceil(vh/TILE_SIZE)+2; for (let y = startRow; y < endRow; y++) { for (let x = startCol; x < endCol; x++) { if (y>=0 && y<mapData.height && x>=0 && x<mapData.width) { const tileType = mapData.tiles[y][x]; if (tileType === 0) { ctx.fillStyle = (x+y)%2===0 ? '#e2e8f0' : '#f1f5f9'; ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE); } else { ctx.fillStyle = '#1e293b'; ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE - TILE_SIZE/2, TILE_SIZE, TILE_SIZE * 1.5); } } } } }

    const allUsers = [...otherUsers, currentUser].sort((a, b) => a.y - b.y);
    allUsers.forEach(u => { const cx = u.x * TILE_SIZE + TILE_SIZE/2; const cy = u.y * TILE_SIZE + TILE_SIZE; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, cy - 4, TILE_SIZE/3, TILE_SIZE/6, 0, 0, Math.PI*2); ctx.fill(); ctx.save(); ctx.translate(cx - 16, cy - 32); let videoSource = null; if (u.isCameraOn) { if (u.id === currentUser.id) videoSource = localVideo; else if (remoteVideos && remoteVideos[u.id]) videoSource = remoteVideos[u.id]; } drawHumanSprite(ctx, u.avatarConfig, u.direction, true, 1.0, videoSource); ctx.restore(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; const w = ctx.measureText(u.displayName).width + 8; ctx.fillRect(cx - w/2, cy - 45, w, 14); ctx.fillStyle = 'white'; ctx.fillText(u.displayName, cx, cy - 35); });

    ctx.restore();
    requestAnimationFrame(render);
  };
  
  useEffect(() => { const handleResize = () => { if(containerRef.current && canvasRef.current) { const {width, height} = containerRef.current.getBoundingClientRect(); const d = window.devicePixelRatio||1; canvasRef.current.width = width * d; canvasRef.current.height = height * d; const c=canvasRef.current.getContext('2d'); if(c) { c.scale(d,d); c.imageSmoothingEnabled = false; } canvasRef.current.style.width = '100%'; canvasRef.current.style.height = '100%'; } }; window.addEventListener('resize', handleResize); handleResize(); setTimeout(handleResize, 100); return () => window.removeEventListener('resize', handleResize); }, []);
  useEffect(() => { requestAnimationFrame(render); }, [mapData, currentUser, otherUsers, backgroundImage, interactiveObjects, selectedId]); 
  useEffect(() => { const c = canvasRef.current; if(!c)return; const h = (e: WheelEvent) => { e.preventDefault(); zoomRef.current = Math.min(Math.max(zoomRef.current - e.deltaY*0.001, 0.5), 3.0); }; c.addEventListener('wheel', h, {passive:false}); return () => c.removeEventListener('wheel', h); }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-slate-900 overflow-hidden">
      <canvas ref={canvasRef} className="block absolute top-0 left-0 z-0" onMouseDown={handleMapClick} />
      
      <div ref={objectsLayerRef} className="absolute top-0 left-0 z-10 origin-top-left pointer-events-none" style={{ width: 0, height: 0 }}>
        {interactiveObjects?.map(obj => {
          const youtubeEmbed = (obj.type === 'video') ? getYouTubeEmbed(obj.src) : null;
          const isSelected = isAdmin && selectedId === obj.id;

          return (
            <div 
              key={obj.id}
              onContextMenu={(e) => handleContextMenu(e, obj)}
              className={`absolute pointer-events-auto bg-black group ${isSelected ? 'ring-4 ring-blue-500 z-50 shadow-2xl' : ''}`}
              style={{
                left: `${obj.x * TILE_SIZE}px`,
                top: `${obj.y * TILE_SIZE}px`,
                width: `${obj.width * TILE_SIZE}px`,
                height: `${obj.height * TILE_SIZE}px`,
              }}
            >
              {/* ADMIN HEADER WITH DELETE BUTTON */}
              {isAdmin && (
                <div 
                  className={`absolute -top-6 left-0 w-full h-6 bg-blue-600 rounded-t-md flex items-center justify-between px-1 cursor-move transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onMouseDown={(e) => handleMouseDown(e, obj, 'move')}
                >
                  <div className="w-4"></div> {/* Spacer */}
                  <div className="w-8 h-1 bg-white/50 rounded-full"></div> {/* Grip */}
                  <div 
                    className="w-4 h-4 text-white hover:text-red-200 cursor-pointer flex items-center justify-center"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (onDeleteObject) onDeleteObject(obj.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </div>
                </div>
              )}

              <div className="w-full h-full bg-black overflow-hidden relative">
                {youtubeEmbed ? (
                  <iframe 
                    src={youtubeEmbed} 
                    className="w-full h-full border-0" 
                    allow="autoplay; encrypted-media" 
                    ref={el => { if(el) mediaRefs.current[obj.id] = el; }} 
                  />
                ) : obj.type === 'image' ? (
                  <img src={obj.src} className="w-full h-full object-contain" draggable={false} />
                ) : obj.type === 'video' ? (
                  <video 
                    src={obj.src} 
                    controls 
                    className="w-full h-full"
                    ref={el => { if(el) mediaRefs.current[obj.id] = el; }} 
                  />
                ) : (
                  <iframe src={obj.src} className="w-full h-full bg-white" />
                )}

                {isSelected && (
                  <div 
                    className="absolute inset-0 bg-transparent cursor-move"
                    onMouseDown={(e) => handleMouseDown(e, obj, 'move')}
                  />
                )}
              </div>

              {isSelected && (
                <div 
                  onMouseDown={(e) => handleMouseDown(e, obj, 'resize')}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize z-50 rounded-tl-lg border-2 border-white"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapCanvas;