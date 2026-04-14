import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabaseClient';
import MapCanvas, { MapData, User, AvatarConfig, drawHumanSprite, Direction, InteractiveObject } from '../components/canvas/MapCanvas';
import { useAvatarMovement } from '../hooks/useAvatarMovement';
import { useWebRTC } from '../hooks/useWebRTC'; 
import { RealtimeChannel } from '@supabase/supabase-js';

// Icons using SVG directly so we don't depend on missing libs
const Icons = {
  Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  Mic: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  MicOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>,
  Video: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  CameraOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>,
  Monitor: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Smile: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Close: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Youtube: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Code: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  File: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
};

const TRANSLATIONS = {
  en: { title:"Character Creator", subtitle:"Customize your hero", preview:"PREVIEW", displayName:"Display Name", placeholder:"Enter your name...", join:"Join World", online:"ONLINE", offline:"OFFLINE", coords:"Coordinates", nearby:"Nearby", camOn:"Turn Camera ON", camOff:"Turn Camera OFF", controls:"Move: WASD / Arrows", zoom:"Zoom: Scroll", labels:{ skin:"Skin", hair:"Hair", hat:"Hat", face:"Face", shirt:"Shirt", pants:"Pants", shoes:"Shoes"} },
};

type Language = 'en';
const AVATAR_OPTIONS = {
  skin:['#fca5a5','#fcd34d','#8b5cf6','#cbd5e1','#573318','#3e2723','#ffcc80'],
  hair:['none','short','long','spiky','messy','bob'],
  hat:['none','cap','tophat','beanie','cowboy','helmet'],
  face:['smile','neutral','angry','surprised','tired','cool'],
  shirt:['#3b82f6','#ef4444','#22c55e','#64748b','#f59e0b','#8b5cf6','#000000','#ffffff'],
  pants:['#000','#1e293b','#d97706','#f1f5f9','#3f2e3e','#2e7d32'],
  shoes:['#000','#fff','#78350f','#dc2626','#3b82f6','#fbbf24']
};

const AvatarPreview: React.FC<{config:AvatarConfig}> = ({config}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewDir, setPreviewDir] = useState<Direction>('down');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewDir(prev => prev === 'down' ? 'left' : prev === 'left' ? 'up' : prev === 'up' ? 'right' : 'down');
    }, 1000);
    return()=>clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(27,24);
    drawHumanSprite(ctx, config, previewDir, true, 3);
    ctx.restore();
  }, [config, previewDir]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} width={150} height={150} className="rounded-2xl bg-white/5 border border-white/10 shadow-inner backdrop-blur-sm" />
      <p className="text-xs text-white/50 mt-3 tracking-widest uppercase">Preview Mode</p>
    </div>
  );
};

const MAP_SIZE = 200;
const CHUNK_SIZE = 40; // Users in the same 40x40 chunk share a channel.
const generateCityMap = (size:number):MapData => {
  const tiles:number[][] = [];
  for(let y=0; y<size; y++) {
    const row:number[] = [];
    for(let x=0; x<size; x++) {
      row.push((x===0||y===0||x===size-1||y===size-1) ? 1 : 0);
    }
    tiles.push(row);
  }
  return { width:size, height:size, tiles, spawnPoints:[], objects:[] };
};

const getRandomSpawn = (map:MapData) => ({ x: Math.floor(Math.random()*(map.width-20))+10, y: Math.floor(Math.random()*(map.height-20))+10 });

const GamePage = () => {
  const [userId] = useState(() => uuidv4());
  const [username, setUsername] = useState("");
  const [isGameStarted, setIsGameStarted] = useState(false);
  const language: Language = 'en';
  const t = TRANSLATIONS[language];
  const [avatar, setAvatar] = useState<AvatarConfig>({ skin: '#fca5a5', hair: 'short', hat: 'none', face: 'smile', shirt: '#3b82f6', pants: '#000', shoes: '#000' });

  const mapData = useMemo(() => generateCityMap(MAP_SIZE), []);
  const initialSpawn = useMemo(() => getRandomSpawn(mapData), [mapData]);
  const { x, y, direction } = useAvatarMovement(initialSpawn.x, initialSpawn.y, mapData);
  
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [interactiveObjects, setInteractiveObjects] = useState<InteractiveObject[]>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string, text: string, x: number, y: number, timestamp: number }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const EMOJI_LIST = ['👍', '👋', '😂', '❤️', '🔥', '🎉'];

  const sendEmoji = (emoji: string) => {
    const newEmoji = { id: uuidv4(), text: emoji, x, y, timestamp: Date.now() };
    setFloatingEmojis(prev => [...prev, newEmoji]);
    if (channel) channel.send({ type: 'broadcast', event: 'emoji', payload: newEmoji });
    setShowEmojiPicker(false);
  };
  
  // Realtime Supabase
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  // Audio / Video 
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localVideoEl, setLocalVideoEl] = useState<HTMLVideoElement | null>(null);
  
  const { remoteStreams, updateVolumes } = useWebRTC(channel, userId, localStream);
  const [remoteVideoRefs, setRemoteVideoRefs] = useState<Record<string, HTMLVideoElement>>({});

  useEffect(() => {
    if (updateVolumes && otherUsers.length > 0) updateVolumes({x, y}, otherUsers.map(u => ({id: u.id, x: u.x, y: u.y})));
  }, [x, y, otherUsers, updateVolumes, remoteStreams]);

  // Admin UI States
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<'video'|'iframe'|'image'|null>(null);
  const [modalInput, setModalInput] = useState("");
  const objectFileInputRef = useRef<HTMLInputElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const getStream = async () => {
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach(t => t.enabled = false);
      stream.getAudioTracks().forEach(t => t.enabled = false);
      setLocalStream(stream);
      if (localVideoEl) { localVideoEl.srcObject = stream; localVideoEl.play().catch(e=>e); }
      return stream;
    } catch (e) {
      console.error("Media permission error", e);
      return null;
    }
  };

  const toggleMic = async () => {
    const stream = localStream || await getStream();
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = async () => {
    const stream = localStream || await getStream();
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isCameraOn;
      setIsCameraOn(!isCameraOn);
    }
  };

  // Uploading Interactive Media via Supabase Storage
  const handleObjectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
    const { data, error } = await supabase.storage.from('spatial_media').upload(`objects/${fileName}`, file, { cacheControl: '3600', upsert: false });
    
    let url = URL.createObjectURL(file);
    if (!error && data) url = supabase.storage.from('spatial_media').getPublicUrl(`objects/${fileName}`).data.publicUrl;
    else console.warn("Supabase Storage fail. Requires auth or created bucket 'spatial_media'. Fallback to local.");
    let type: 'image' | 'video' | 'iframe' = 'iframe';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type === 'application/pdf') type = 'iframe';

    const newObj: InteractiveObject = { id: uuidv4(), type, x, y: y-4, width: 6, height: 4, src: url };
    setInteractiveObjects(prev => [...prev, newObj]);
    if (channel) channel.send({ type: 'broadcast', event: 'admin_add_object', payload: newObj });
    e.target.value = '';
    setShowAddMenu(false);
  };

  const handleClearBackground = () => { setBackgroundImage(null); if (channel) channel.send({ type: 'broadcast', event: 'admin_clear_background' }); };
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setBackgroundImage(URL.createObjectURL(file)); const fn = `bg_${Date.now()}_${file.name}`; const {data, error} = await supabase.storage.from('spatial_media').upload(`bg/${fn}`, file); const bgUrl = !error && data ? supabase.storage.from('spatial_media').getPublicUrl(`bg/${fn}`).data.publicUrl : URL.createObjectURL(file); if (channel) channel.send({ type: 'broadcast', event: 'admin_upload_background', payload: { image: bgUrl } }); };
  const handleAddObject = (type: 'video'|'iframe'|'image', src: string) => { const newObj: InteractiveObject = { id: uuidv4(), type, x, y: y-4, width: 6, height: 4, src }; setInteractiveObjects(prev => [...prev, newObj]); if (channel) channel.send({ type: 'broadcast', event: 'admin_add_object', payload: newObj }); setActiveModal(null); setModalInput(""); };
  const handleDeleteObject = (id: string) => { setInteractiveObjects(prev => prev.filter(o => o.id !== id)); if (channel) channel.send({ type: 'broadcast', event: 'admin_delete_object', payload: { id } }); };
  const handleUpdateObject = (updatedObj: InteractiveObject) => { setInteractiveObjects(prev => prev.map(o => o.id === updatedObj.id ? updatedObj : o)); if (channel) channel.send({ type: 'broadcast', event: 'admin_update_object', payload: updatedObj }); };

  // Setup Supabase Connection & Chuncking
  useEffect(() => {
    if (!isGameStarted) return;
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const roomName = `spatial_chunk_${chunkX}_${chunkY}`;
    
    // Check if we are already in the right channel
    if (channel && channel.topic === `realtime:${roomName}`) return;
    // Leave previous channel
    if (channel) supabase.removeChannel(channel);

    const newChannel = supabase.channel(roomName, { config: { presence: { key: userId } } });
    
    newChannel
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        const users: User[] = Object.keys(state).map(key => {
          const presence = state[key][0] as any;
          return {
            id: key,
            displayName: presence.displayName,
            x: presence.x,
            y: presence.y,
            direction: presence.direction,
            avatarConfig: presence.avatarConfig,
            isCameraOn: presence.isCameraOn
          };
        }).filter(u => u.id !== userId);
        setOtherUsers(users);
      })
      .on('broadcast', { event: 'admin_add_object' }, ({ payload }) => setInteractiveObjects(prev => [...prev, payload]))
      .on('broadcast', { event: 'admin_update_object' }, ({ payload }) => setInteractiveObjects(prev => prev.map(o => o.id === payload.id ? payload : o)))
      .on('broadcast', { event: 'admin_delete_object' }, ({ payload }) => setInteractiveObjects(prev => payload.id === 'ALL' ? [] : prev.filter(o => o.id !== payload.id)))
      .on('broadcast', { event: 'emoji' }, ({ payload }) => setFloatingEmojis(prev => [...prev, payload]))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          newChannel.track({ displayName: username, x, y, direction, avatarConfig: avatar, isCameraOn });
        }
      });
      
    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  // We explicitly run this when x, y crosses boundaries 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameStarted, Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)]);

  // Track position updates without rejoining channel
  useEffect(() => {
    if (isConnected && channel) {
      // Throttle presence tracking a bit internally if performance drops
      channel.track({ displayName: username, x, y, direction, avatarConfig: avatar, isCameraOn });
    }
  }, [x, y, direction, isCameraOn, isConnected, avatar, username]);


  if (!isGameStarted) {
    return ( 
      <div className="flex min-h-screen bg-[#070b14] text-white font-sans items-center justify-center p-4 selection:bg-blue-500/30"> 
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl mix-blend-screen"></div>
           <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl mix-blend-screen"></div>
        </div>
        <div className="flex flex-col md:flex-row gap-8 bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 max-h-[90vh] z-10 w-full max-w-4xl relative overflow-hidden"> 
          <div className="w-full md:w-1/3 flex flex-col items-center justify-start bg-black/40 rounded-2xl p-6 border border-white/5"> 
            <h2 className="text-xl font-bold mb-6 text-white/80 tracking-widest uppercase text-sm">{t.preview}</h2> 
            <AvatarPreview config={avatar} /> 
          </div> 
          
          <div className="w-full md:w-2/3 flex flex-col min-h-0"> 
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">{t.title}</h1> 
            <p className="text-white/40 text-sm mb-8">{t.subtitle}</p> 
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-6"> 
              {(Object.keys(AVATAR_OPTIONS) as Array<keyof typeof AVATAR_OPTIONS>).map((key) => ( 
                <div key={key}> 
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-3 tracking-widest"> {(t.labels as any)[key]} </label> 
                  <div className="flex flex-wrap gap-2"> 
                    {AVATAR_OPTIONS[key].map((opt: string) => ( 
                      <button key={opt} onClick={() => setAvatar(prev => ({...prev, [key]: opt}))} className={`w-9 h-9 rounded-xl border transition-all duration-200 ${(avatar as any)[key] === opt ? 'border-blue-400 scale-110 shadow-[0_0_15px_rgba(96,165,250,0.4)]' : 'border-white/10 hover:border-white/30 hover:scale-105'}`} style={{backgroundColor: opt.startsWith('#') ? opt : '#111827'}} title={opt}> {!opt.startsWith('#') && <span className="text-[10px] flex items-center justify-center h-full w-full text-white/40">{opt.slice(0,2).toUpperCase()}</span>} </button> 
                    ))} 
                  </div> 
                </div> 
              ))} 
            </div> 
            
            <div className="mt-8 pt-6 border-t border-white/10"> 
              <input type="text" className="w-full p-4 rounded-xl bg-black/50 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none text-white placeholder-white/30 mb-4 transition-all text-sm" placeholder={t.placeholder} value={username} onChange={e=>setUsername(e.target.value)} /> 
              <button disabled={!username} onClick={()=>setIsGameStarted(true)} className="w-full bg-blue-600 py-4 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"> {t.join} </button> 
            </div> 
          </div> 
        </div> 
      </div> 
    );
  }

  return (
    <div className="relative w-screen h-screen bg-[#020617] overflow-hidden font-sans">
      <video ref={(el) => setLocalVideoEl(el)} autoPlay playsInline muted className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" />
      {Object.entries(remoteStreams).map(([uId, stream]) => (
        <video 
          key={uId} 
          ref={(el) => { 
            if (el && el.srcObject !== stream) { el.srcObject = stream; el.play().catch(e => e); setRemoteVideoRefs(p => ({ ...p, [uId]: el })); } 
          }} 
          autoPlay 
          playsInline
          muted 
          className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" 
        />
      ))}

      <MapCanvas 
        mapData={mapData} 
        currentUser={{id: userId, displayName: username, x, y, avatarConfig: avatar, direction, isCameraOn}} 
        otherUsers={otherUsers}
        localVideo={localVideoEl} 
        remoteVideos={remoteVideoRefs}
        backgroundImage={backgroundImage}
        interactiveObjects={interactiveObjects} 
        onUpdateObject={handleUpdateObject}
        onDeleteObject={handleDeleteObject}
        floatingEmojis={floatingEmojis}
      />
      
      {/* GLASSSMORPHISM HUD TOP LEFT */}
      <div className="absolute top-6 left-6 text-white bg-[#0f172a]/90 p-5 rounded-2xl backdrop-blur-xl shadow-2xl border border-white/20 select-none pointer-events-none min-w-[200px]"> 
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10"> 
          <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500 ${isConnected ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-400 text-rose-400'}`}></div> 
          <span className="font-bold tracking-widest text-xs uppercase text-white/80">{isConnected ? t.online : t.offline}</span> 
        </div> 
        <div className="space-y-3 font-mono text-xs"> 
          <div className="flex justify-between items-center text-white/50"><span className="uppercase tracking-wider">{t.coords}</span><span className="text-white/90 bg-white/5 px-2 py-1 rounded">X:{x} Y:{y}</span></div> 
          <div className="flex justify-between items-center text-white/50"><span className="uppercase tracking-wider">{t.nearby}</span><span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded font-bold">{otherUsers.length}</span></div> 
        </div> 
      </div>
      
      {/* GLASSMORPHISM MAIN DOCK BOTTOM */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-[#0f172a]/90 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-50 border border-white/20 h-[72px]">
        
        {/* Profile */}
        <div className="relative group cursor-pointer mr-2 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-colors">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {username.slice(0,2).toUpperCase()}
          </div>
          <div className="absolute bottom-[calc(100%+16px)] left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 backdrop-blur text-white/90 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
            {username}
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 mx-2"></div>

        {/* Media Tools */}
        <button onClick={toggleMic} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${isMicOn ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}>
          {isMicOn ? <Icons.Mic /> : <Icons.MicOff />}
        </button>
        <button onClick={toggleCamera} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${isCameraOn ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}>
          {isCameraOn ? <Icons.Video /> : <Icons.CameraOff />}
        </button>

        <div className="w-px h-8 bg-white/10 mx-2"></div>

        {/* General Tools */}
        <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all duration-300"><Icons.Monitor /></button>
        
        <div className="relative">
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${showEmojiPicker ? 'bg-white/20 text-white shadow-inner' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'}`}>
            <Icons.Smile />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-[calc(100%+16px)] left-1/2 transform -translate-x-1/2 bg-[#111827]/90 backdrop-blur-md px-3 py-2 border border-white/10 rounded-xl flex gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-fade-in-up origin-bottom">
              {EMOJI_LIST.map(e => <button key={e} onClick={() => sendEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
            </div>
          )}
        </div>

        {/* Admin Tools */}
        {username === 'AdminXiangFei123' && ( 
          <> 
            <div className="w-px h-8 bg-white/10 mx-2"></div> 
            <div className="relative"> 
              <button onClick={() => setShowAddMenu(!showAddMenu)} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${showAddMenu ? 'bg-white text-black rotate-45 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'bg-white/5 hover:bg-white/10 text-white'}`}> 
                <Icons.Plus /> 
              </button> 
              {showAddMenu && ( 
                <div className="absolute bottom-[calc(100%+24px)] left-1/2 transform -translate-x-1/2 w-64 bg-[#111827]/90 backdrop-blur-2xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden py-2 text-white/90 animate-fade-in-up origin-bottom"> 
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-white/5 flex items-center gap-4 transition-colors"> <div className="text-white/40"><Icons.Upload /></div> <span>Upload Map Background</span> </button> 
                  <button onClick={handleClearBackground} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-rose-500/10 flex items-center gap-4 transition-colors text-rose-400"> <div className="text-rose-400/50"><Icons.Trash /></div> <span>Clear Map</span> </button> 
                  <div className="h-px bg-white/5 my-1"></div> 
                  <button onClick={() => objectFileInputRef.current?.click()} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-white/5 flex items-center gap-4 transition-colors"> <div className="text-white/40"><Icons.File /></div> <span>Upload Media File</span> </button>
                  <button onClick={() => { setActiveModal('video'); setShowAddMenu(false); }} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-white/5 flex items-center gap-4 transition-colors"> <div className="text-white/40"><Icons.Youtube /></div> <span>Embed Video URL</span> </button> 
                  <button onClick={() => { setActiveModal('iframe'); setShowAddMenu(false); }} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-white/5 flex items-center gap-4 transition-colors"> <div className="text-white/40"><Icons.Code /></div> <span>Embed iFrame</span> </button> 
                  <button onClick={() => { setActiveModal('image'); setShowAddMenu(false); }} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-white/5 flex items-center gap-4 transition-colors"> <div className="text-white/40"><Icons.Monitor /></div> <span>Embed Image URL</span> </button> 
                  <div className="h-px bg-white/5 my-1"></div> 
                  <button onClick={() => { setInteractiveObjects([]); if(channel) channel.send({ type:'broadcast', event:'admin_delete_object', payload:{id:'ALL'}}); setShowAddMenu(false); }} className="w-full px-5 py-3.5 text-sm font-medium text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-4 transition-colors"> <div className="text-rose-400/50"><Icons.Trash /></div> <span>Delete All Objects</span> </button> 
                </div> 
              )} 
            </div> 
          </> 
        )}
      </div>
      
      {/* Hidden Data Inputs */}
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleBackgroundUpload} />
      <input type="file" ref={objectFileInputRef} hidden accept="image/*,video/*,application/pdf" onChange={handleObjectUpload} />
      
      {/* Modal Dialog for Admin */}
      {activeModal && ( 
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100]"> 
          <div className="bg-[#111827] border border-white/10 text-white p-6 rounded-3xl w-[420px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-scale-in"> 
            <div className="flex justify-between items-center mb-6"> 
              <h3 className="text-xl font-bold tracking-wide">Add {activeModal === 'iframe' ? 'Embed' : activeModal === 'video' ? 'Video' : 'Image'}</h3> 
              <button onClick={() => setActiveModal(null)} className="text-white/30 hover:text-white p-2 bg-white/5 rounded-full transition-colors"><Icons.Close /></button> 
            </div> 
            <div className="space-y-4"> 
              <div> 
                <label className="block text-xs font-bold text-white/40 uppercase mb-2 tracking-wider">Object URL</label> 
                <input autoFocus type="text" placeholder="https://..." className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 outline-none rounded-xl p-4 text-sm transition-all" value={modalInput} onChange={e => setModalInput(e.target.value)} /> 
              </div> 
              <div className="flex justify-end gap-3 pt-6"> 
                <button onClick={() => setActiveModal(null)} className="px-6 py-3 rounded-xl text-white/60 font-medium hover:bg-white/5 transition-colors text-sm">Cancel</button> 
                <button onClick={() => handleAddObject(activeModal!, modalInput)} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-[0.98] text-sm tracking-wide">Deploy Object</button> 
              </div> 
            </div> 
          </div> 
        </div> 
      )}
    </div>
  );
};

export default GamePage;