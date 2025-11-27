import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import MapCanvas, { MapData, User, AvatarConfig, drawHumanSprite, Direction, InteractiveObject } from '../components/canvas/MapCanvas';
import { useAvatarMovement } from '../hooks/useAvatarMovement';
import { useWebRTC } from '../hooks/useWebRTC'; 

// ... (Keep Icons, Translations, AVATAR_OPTIONS, AvatarPreview, MAP_SIZE, generateCityMap, getRandomSpawn - SAME) ...
const Icons = { Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>, Mic: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>, MicOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>, Video: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>, CameraOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>, Monitor: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, Smile: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, Close: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>, Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, Youtube: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, Code: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>, Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, Play: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>, File: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> };
const TRANSLATIONS={en:{title:"Character Creator",subtitle:"Customize your 8-bit hero",preview:"PREVIEW",displayName:"Display Name",placeholder:"Enter your name...",join:"Join World",online:"ONLINE",offline:"OFFLINE",coords:"Coordinates",nearby:"Users Nearby",camOn:"Turn Camera ON",camOff:"Turn Camera OFF",controls:"Move: WASD / Arrows",zoom:"Zoom: Scroll",labels:{skin:"Skin",hair:"Hair",hat:"Hat",face:"Face",shirt:"Shirt",pants:"Pants",shoes:"Shoes"}},zh:{title:"角色创建",subtitle:"定制你的像素英雄",preview:"预览",displayName:"显示名称",placeholder:"输入你的名字...",join:"进入世界",online:"在线",offline:"离线",coords:"坐标",nearby:"附近用户",camOn:"开启摄像头",camOff:"关闭摄像头",controls:"移动: WASD / 方向键",zoom:"缩放: 滚动滚轮",labels:{skin:"肤色",hair:"发型",hat:"帽子",face:"表情",shirt:"上衣",pants:"裤子",shoes:"鞋子"}},ja:{title:"キャラクター作成",subtitle:"8bitヒーローをカスタマイズ",preview:"プレビュー",displayName:"表示名",placeholder:"名前を入力...",join:"ワールドに参加",online:"オンライン",offline:"オフライン",coords:"座標",nearby:"近くのユーザー",camOn:"カメラをオン",camOff:"カメラをオフ",controls:"移動: WASD / 矢印キー",zoom:"ズーム: スクロール",labels:{skin:"肌",hair:"髪",hat:"帽子",face:"顔",shirt:"シャツ",pants:"ズボン", shoes:"靴"}}}; type Language='en'|'zh'|'ja';
const AVATAR_OPTIONS={skin:['#fca5a5','#fcd34d','#8b5cf6','#cbd5e1','#573318','#3e2723','#ffcc80'],hair:['none','short','long','spiky','messy','bob'],hat:['none','cap','tophat','beanie','cowboy','helmet'],face:['smile','neutral','angry','surprised','tired','cool'],shirt:['#3b82f6','#ef4444','#22c55e','#64748b','#f59e0b','#8b5cf6','#000000','#ffffff'],pants:['#000','#1e293b','#d97706','#f1f5f9','#3f2e3e','#2e7d32'],shoes:['#000','#fff','#78350f','#dc2626','#3b82f6','#fbbf24']};
const AvatarPreview: React.FC<{config:AvatarConfig}>=({config})=>{const canvasRef=useRef<HTMLCanvasElement>(null);const[previewDir,setPreviewDir]=useState<Direction>('down');useEffect(()=>{const interval=setInterval(()=>{setPreviewDir(prev=>{if(prev==='down')return'left';if(prev==='left')return'up';if(prev==='up')return'right';return'down';});},1000);return()=>clearInterval(interval);},[]);useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(60,50);drawHumanSprite(ctx,config,previewDir,true,3);ctx.restore();},[config,previewDir]);return(<div className="flex flex-col items-center"><canvas ref={canvasRef} width={150} height={150} className="rounded-xl bg-slate-800 border-2 border-slate-600 shadow-inner"/><p className="text-xs text-slate-500 mt-2">Rotates automatically</p></div>);};
const MAP_SIZE=200;const BLOCK_SIZE=20;
const generateCityMap=(size:number):MapData=>{const tiles:number[][]=[];for(let y=0;y<size;y++){const row:number[]=[];for(let x=0;x<size;x++){let tileType=0;if(x===0||y===0||x===size-1||y===size-1)tileType=1;row.push(tileType);}tiles.push(row);}return{width:size,height:size,tiles,spawnPoints:[],objects:[]};}; 
const getRandomSpawn=(map:MapData)=>{let attempts=0;while(attempts<500){const x=Math.floor(Math.random()*(map.width-20))+10;const y=map.height-15;if(map.tiles[y][x]===0)return{x,y};attempts++;}return{x:10,y:map.height-10};};

const GamePage = () => {
  const [username, setUsername] = useState("");
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const t = TRANSLATIONS[language];
  const [avatar, setAvatar] = useState<AvatarConfig>({ skin: '#fca5a5', hair: 'short', hat: 'none', face: 'smile', shirt: '#3b82f6', pants: '#000', shoes: '#000' });

  const socketRef = useRef<Socket | null>(null);
  const mapData = useMemo(() => generateCityMap(MAP_SIZE), []);
  const initialSpawn = useMemo(() => getRandomSpawn(mapData), [mapData]);
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [interactiveObjects, setInteractiveObjects] = useState<InteractiveObject[]>([]);
  
  const { x, y, direction } = useAvatarMovement(initialSpawn.x, initialSpawn.y, mapData);
  
  // --- CAMERA & MIC ---
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localVideoEl, setLocalVideoEl] = useState<HTMLVideoElement | null>(null);
  
  const { remoteStreams, updateVolumes } = useWebRTC(socketRef.current, localStream);
  const [remoteVideoRefs, setRemoteVideoRefs] = useState<Record<string, HTMLVideoElement>>({});

  useEffect(() => {
    if (updateVolumes && otherUsers.length > 0) {
      const othersPos = otherUsers.map(u => ({id: u.id, x: u.x, y: u.y}));
      updateVolumes({x, y}, othersPos);
    }
  }, [x, y, otherUsers, updateVolumes, remoteStreams]);

  // Admin UI States
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<'video'|'iframe'|'image'|null>(null);
  const [modalInput, setModalInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const objectFileInputRef = useRef<HTMLInputElement>(null); // NEW: File Input for Objects

  const getStream = async () => {
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach(t => t.enabled = false);
      stream.getAudioTracks().forEach(t => t.enabled = false);
      setLocalStream(stream);
      if (localVideoEl) { 
        localVideoEl.srcObject = stream; 
        localVideoEl.play().catch(e => console.error("Local play error", e)); 
      }
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
      if (socketRef.current) {
        socketRef.current.emit('move', { x, y, direction, isCameraOn: !isCameraOn });
      }
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const base64 = reader.result as string; setBackgroundImage(base64); if (socketRef.current) socketRef.current.emit('admin_upload_background', { image: base64 }); }; reader.readAsDataURL(file); };
  const handleClearBackground = () => { setBackgroundImage(null); if (socketRef.current) socketRef.current.emit('admin_clear_background'); };
  
  // NEW: Handle Generic Object Upload (Images, Videos, PDFs)
  const handleObjectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const spawnX = x;
      const spawnY = y - 4;
      
      let type: 'image' | 'video' | 'iframe' = 'iframe';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'application/pdf') type = 'iframe'; // PDF renders in iframe
      
      const newObj: InteractiveObject = {
        id: Date.now().toString(),
        type,
        x: spawnX, y: spawnY, width: 6, height: 4,
        src: base64
      };
      
      setInteractiveObjects(prev => [...prev, newObj]);
      if (socketRef.current) socketRef.current.emit('admin_add_object', newObj);
      e.target.value = ''; // Reset input
      setShowAddMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddObject = (type: 'video'|'iframe'|'image', src: string) => { const spawnX = x; const spawnY = y - 4; const newObj: InteractiveObject = { id: Date.now().toString(), type, x: spawnX, y: spawnY, width: 6, height: 4, src }; setInteractiveObjects(prev => [...prev, newObj]); if (socketRef.current) socketRef.current.emit('admin_add_object', newObj); setActiveModal(null); setModalInput(""); };
  const handleDeleteObject = (id: string) => { setInteractiveObjects(prev => prev.filter(o => o.id !== id)); if (socketRef.current) socketRef.current.emit('admin_delete_object', { id }); };
  const handleUpdateObject = (updatedObj: InteractiveObject) => { setInteractiveObjects(prev => prev.map(o => o.id === updatedObj.id ? updatedObj : o)); if (socketRef.current) { socketRef.current.emit('admin_update_object', updatedObj); } };

  useEffect(() => { if (!isGameStarted) return; socketRef.current = io('http://localhost:3000', { transports: ['websocket'] }); const socket = socketRef.current; socket.on('connect', () => { setIsConnected(true); socket.emit('join', { name: username, x: initialSpawn.x, y: initialSpawn.y, avatarConfig: avatar, isCameraOn: isCameraOn }); }); socket.on('existing_users', (users) => setOtherUsers(users.filter((u:any) => u.id !== socket.id))); socket.on('user_joined', (u) => setOtherUsers(p => [...p, u])); socket.on('user_moved', (d) => setOtherUsers(p => p.map(u => u.id === d.id ? { ...u, ...d } : u))); socket.on('user_left', (id) => setOtherUsers(p => p.filter(u => u.id !== id))); socket.on('map_update', (state: any) => { if (state.backgroundImage !== undefined) setBackgroundImage(state.backgroundImage); if (state.interactiveObjects) setInteractiveObjects(state.interactiveObjects); }); return () => { socket.disconnect(); }; }, [isGameStarted, initialSpawn, username, avatar]);
  useEffect(() => { if (isConnected && socketRef.current) socketRef.current.emit('move', { x, y, direction, isCameraOn }); }, [x, y, direction, isConnected, isCameraOn]);

  if (!isGameStarted) {
    return ( <div className="flex min-h-screen bg-slate-900 text-white font-sans items-center justify-center p-4"> <div className="absolute top-4 right-4 flex gap-2"> <button onClick={() => setLanguage('en')} className={`px-3 py-1 rounded ${language === 'en' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>English</button> <button onClick={() => setLanguage('zh')} className={`px-3 py-1 rounded ${language === 'zh' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>简体中文</button> <button onClick={() => setLanguage('ja')} className={`px-3 py-1 rounded ${language === 'ja' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>日本語</button> </div> <div className="flex flex-col md:flex-row gap-8 bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 max-h-[90vh]"> <div className="w-64 flex flex-col items-center justify-start pt-8 bg-slate-900 rounded-lg p-4 border border-slate-700"> <h2 className="text-xl font-bold mb-4 text-slate-400 tracking-wider">{t.preview}</h2> <AvatarPreview config={avatar} /> </div> <div className="w-80 flex flex-col"> <h1 className="text-2xl font-bold mb-1 text-blue-400">{t.title}</h1> <p className="text-slate-500 text-sm mb-6">{t.subtitle}</p> <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5"> {(Object.keys(AVATAR_OPTIONS) as Array<keyof typeof AVATAR_OPTIONS>).map((key) => ( <div key={key}> <label className="block text-xs uppercase font-bold text-slate-400 mb-2 tracking-wide"> {(t.labels as any)[key]} </label> <div className="flex flex-wrap gap-2"> {AVATAR_OPTIONS[key].map((opt: string) => ( <button key={opt} onClick={() => setAvatar(prev => ({...prev, [key]: opt}))} className={`w-8 h-8 rounded-md border-2 shadow-sm transition-all duration-150 ${(avatar as any)[key] === opt ? 'border-blue-400 scale-110 ring-2 ring-blue-500/50' : 'border-slate-600 hover:border-slate-400 hover:scale-105'}`} style={{backgroundColor: opt.startsWith('#') ? opt : '#1e293b'}} title={opt}> {!opt.startsWith('#') && <span className="text-[10px] flex items-center justify-center h-full w-full text-slate-300">{opt.slice(0,2).toUpperCase()}</span>} </button> ))} </div> </div> ))} </div> <div className="mt-6 border-t border-slate-700 pt-6"> <label className="block text-sm font-medium mb-2 text-slate-300">{t.displayName}</label> <input type="text" className="w-full p-3 rounded bg-slate-900 border border-slate-600 focus:border-blue-500 outline-none text-white placeholder-slate-500 mb-4 transition-colors" placeholder={t.placeholder} value={username} onChange={e=>setUsername(e.target.value)} /> <button disabled={!username} onClick={()=>setIsGameStarted(true)} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 hover:shadow-blue-500/40 active:transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"> {t.join} </button> </div> </div> </div> </div> );
  }

  return (
    <div className="relative w-screen h-screen bg-slate-900 overflow-hidden">
      <video ref={(el) => setLocalVideoEl(el)} autoPlay playsInline muted className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" />
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <video 
          key={userId} 
          ref={(el) => { 
            if (el && el.srcObject !== stream) { 
              el.srcObject = stream; 
              el.play().catch(e => console.error("Remote play error", e)); 
              setRemoteVideoRefs(prev => ({ ...prev, [userId]: el })); 
            } 
          }} 
          autoPlay 
          playsInline
          muted // Keep muted to avoid double audio
          className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" 
        />
      ))}

      <MapCanvas 
        mapData={mapData} 
        currentUser={{id:'me', displayName:username, x, y, avatarConfig:avatar, direction, isCameraOn}} 
        otherUsers={otherUsers}
        localVideo={localVideoEl} 
        remoteVideos={remoteVideoRefs}
        backgroundImage={backgroundImage}
        interactiveObjects={interactiveObjects} 
        onUpdateObject={handleUpdateObject}
        onDeleteObject={handleDeleteObject} // Pass delete handler
      />
      
      {/* (Keep HUD, Language, Toolbar - SAME AS BEFORE) */}
      <div className="absolute top-4 left-4 text-white bg-black/60 p-4 rounded-xl backdrop-blur-md shadow-2xl border border-white/10 select-none pointer-events-none"> <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-2"> <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500 ${isConnected ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div> <span className="font-bold tracking-wide text-sm">{isConnected ? t.online : t.offline}</span> </div> <div className="space-y-1 font-mono text-sm"> <div className="flex justify-between gap-4 text-slate-300"><span>{t.coords}:</span><span className="text-blue-400 font-bold">X:{x} Y:{y}</span></div> <div className="flex justify-between gap-4 text-slate-300"><span>{t.nearby}:</span><span className="text-green-400 font-bold">{otherUsers.length}</span></div> </div> </div>
      <div className="absolute top-4 right-4 flex gap-2 z-50"> <button onClick={() => setLanguage('en')} className={`px-2 py-1 text-xs rounded border border-white/20 ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-black/60 text-slate-300 hover:bg-black/80'}`}>EN</button> <button onClick={() => setLanguage('zh')} className={`px-2 py-1 text-xs rounded border border-white/20 ${language === 'zh' ? 'bg-blue-600 text-white' : 'bg-black/60 text-slate-300 hover:bg-black/80'}`}>中</button> <button onClick={() => setLanguage('ja')} className={`px-2 py-1 text-xs rounded border border-white/20 ${language === 'ja' ? 'bg-blue-600 text-white' : 'bg-black/60 text-slate-300 hover:bg-black/80'}`}>日</button> </div>
      
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-[#202531] px-6 py-3 rounded-full shadow-2xl z-50 border border-white/10">
        <div className="relative group cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-transparent group-hover:ring-indigo-400 transition-all">
            {username.slice(0,2).toUpperCase()}
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {username}
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 mx-2"></div>

        {/* MIC BUTTON */}
        <button 
          onClick={toggleMic} 
          className={`p-3 rounded-full transition-all shadow-lg ${
            isMicOn 
              ? 'bg-green-600 text-white shadow-green-500/20' 
              : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
          }`}
        >
          {isMicOn ? <Icons.Mic /> : <Icons.MicOff />}
        </button>

        {/* CAMERA BUTTON */}
        <button 
          onClick={toggleCamera} 
          className={`p-3 rounded-full transition-all shadow-lg ${
            isCameraOn 
              ? 'bg-green-600 text-white shadow-green-500/20' 
              : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
          }`}
        >
          {isCameraOn ? <Icons.Video /> : <Icons.CameraOff />}
        </button>

        <button className="p-3 rounded-full bg-[#2b303b] hover:bg-[#3a404d] text-slate-300 hover:text-white transition-all"><Icons.Monitor /></button>
        <button className="p-3 rounded-full bg-[#2b303b] hover:bg-[#3a404d] text-slate-300 hover:text-white transition-all"><Icons.Smile /></button>

        {username === 'AdminXiangFei123' && ( <> <div className="w-px h-8 bg-white/10 mx-2"></div> <div className="relative"> <button onClick={() => setShowAddMenu(!showAddMenu)} className={`p-3 rounded-full transition-all ${showAddMenu ? 'bg-white text-slate-900 rotate-45' : 'bg-[#2b303b] hover:bg-white hover:text-slate-900 text-slate-300'}`}> <Icons.Plus /> </button> {showAddMenu && ( <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-6 w-64 bg-white rounded-xl shadow-2xl overflow-hidden py-2 text-slate-800 animate-fade-in-up origin-bottom"> <button onClick={() => fileInputRef.current?.click()} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-slate-500"><Icons.Upload /></div> <span>Upload Map</span> </button> <button onClick={handleClearBackground} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-red-500"><Icons.Trash /></div> <span className="text-red-600">Clear Map</span> </button> <div className="h-px bg-slate-100 my-1"></div> 
                  {/* NEW: Upload File Button */}
                  <button onClick={() => objectFileInputRef.current?.click()} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-slate-500"><Icons.File /></div> <span>Upload File (Img/Vid/PDF)</span> </button>
                  <button onClick={() => { setActiveModal('video'); setShowAddMenu(false); }} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-slate-500"><Icons.Youtube /></div> <span>Video URL</span> </button> <button onClick={() => { setActiveModal('iframe'); setShowAddMenu(false); }} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-slate-500"><Icons.Code /></div> <span>Embed iFrame</span> </button> <button onClick={() => { setActiveModal('image'); setShowAddMenu(false); }} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-slate-100 flex items-center gap-4 transition-colors"> <div className="text-slate-500"><Icons.Monitor /></div> <span>Image URL</span> </button> <div className="h-px bg-slate-100 my-1"></div> <button onClick={() => { setInteractiveObjects([]); if(socketRef.current) socketRef.current.emit('admin_delete_object', {id: 'ALL'}); setShowAddMenu(false); }} className="w-full px-6 py-3 text-sm font-medium text-left hover:bg-red-50 text-red-600 flex items-center gap-4 transition-colors"> <div className="text-red-500"><Icons.Trash /></div> <span>Delete All Objects</span> </button> </div> )} </div> </> )}
      </div>
      
      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleBackgroundUpload} />
      <input type="file" ref={objectFileInputRef} hidden accept="image/*,video/*,application/pdf" onChange={handleObjectUpload} />
      
      {activeModal && ( <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"> <div className="bg-white text-slate-900 p-6 rounded-2xl w-[400px] shadow-2xl animate-scale-in"> <div className="flex justify-between items-center mb-6"> <h3 className="text-xl font-bold">Add {activeModal === 'iframe' ? 'Embed' : activeModal === 'video' ? 'Video' : 'Image'}</h3> <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600"><Icons.Close /></button> </div> <div className="space-y-4"> <div> <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL</label> <input autoFocus type="text" placeholder="https://..." className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-0 rounded-lg p-3 text-sm transition-all" value={modalInput} onChange={e => setModalInput(e.target.value)} /> </div> <div className="flex justify-end gap-2 pt-4"> <button onClick={() => setActiveModal(null)} className="px-5 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors">Cancel</button> <button onClick={() => handleAddObject(activeModal!, modalInput)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all transform active:scale-95">Place Object</button> </div> </div> </div> </div> )}
      {username === 'AdminXiangFei123' && interactiveObjects.length > 0 && ( <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur flex items-center gap-2 pointer-events-none"> <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Admin Mode Active </div> )}
    </div>
  );
};

export default GamePage;