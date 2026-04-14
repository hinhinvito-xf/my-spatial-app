import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

const getDistance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const useWebRTC = (channel: RealtimeChannel | null, currentUserId: string | undefined, localStream: MediaStream | null, otherUsers: {id: string}[] = []) => {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const ignoreOfferRef = useRef<Record<string, boolean>>({});

  // --- P2P WEBRTC LOGIC ---
  const createPeer = useCallback((targetId: string, isInitiator: boolean) => {
    if (!channel || !currentUserId) return null;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Force aggressive connection tunneling instantly before any tracks exist
    if (isInitiator) {
      peer.createDataChannel('spatial_signal');
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current!);
      });
    }

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { targetId, senderId: currentUserId, signal: { type: 'candidate', candidate: e.candidate } }
        });
      }
    };

    peer.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setRemoteStreams(prev => ({ ...prev, [targetId]: e.streams[0] }));
        if (!audioElementsRef.current[targetId]) {
          const audio = new Audio();
          audio.srcObject = e.streams[0];
          audio.autoplay = true;
          audio.volume = 0;
          audioElementsRef.current[targetId] = audio;
          audio.play().catch(e => console.log("Audio autoplay blocked", e));
        }
      }
    };

    peer.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[targetId] = true;
        await peer.setLocalDescription();
        if (peer.localDescription) {
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { targetId, senderId: currentUserId, signal: { type: peer.localDescription.type, sdp: peer.localDescription.sdp } }
          });
        }
      } catch (err) { console.error("Negotiation error", err); } finally { 
        makingOfferRef.current[targetId] = false; 
      }
    };

    peersRef.current[targetId] = peer;
    return peer;
  }, [channel, currentUserId]);

  // Sync peer connections organically based on Supabase Presence state
  useEffect(() => {
    if (!channel || !currentUserId) return;
    
    // Check for NEW users to open peer connection tunnels
    otherUsers.forEach(u => {
      if (!peersRef.current[u.id] && u.id !== currentUserId) {
        // Always create peer. Only one side initiates the forceful data tunnel.
        createPeer(u.id, currentUserId < u.id);
      }
    });

    // Check for DROPPED users to close peer
    const activeIds = new Set(otherUsers.map(u => u.id));
    Object.keys(peersRef.current).forEach(existingId => {
      if (!activeIds.has(existingId)) {
        peersRef.current[existingId].close();
        delete peersRef.current[existingId];
        if (audioElementsRef.current[existingId]) {
          audioElementsRef.current[existingId].pause();
          delete audioElementsRef.current[existingId];
        }
        setRemoteStreams(prev => { const next = {...prev}; delete next[existingId]; return next; });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUsers, channel, currentUserId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // --- SPATIAL AUDIO LOGIC ---
  const updateVolumes = useCallback((myPos: {x:number, y:number}, otherUsers: {id: string, x: number, y: number}[]) => {
    otherUsers.forEach(user => {
      const audioEl = audioElementsRef.current[user.id];
      if (audioEl) {
        const dist = getDistance(myPos, {x: user.x, y: user.y});
        
        // STRICT CUTOFF: Only hear if <= 6 tiles.
        if (dist <= 6) { 
           // Ramp volume based on distance
           const vol = Math.max(0, 1 - (dist / 6));
           if(Math.abs(audioEl.volume - vol) > 0.05) audioEl.volume = vol;
        } else {
           if(audioEl.volume !== 0.0) audioEl.volume = 0.0;
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!channel || !currentUserId) return;

    // User join/leave logic is now handled organically by the Presence useEffect above.

    const handleSignalEvent = async (payload: any) => {
      const { targetId, senderId, signal } = payload;
      if (targetId !== currentUserId) return; // Ignore signals not meant for us

      let peer = peersRef.current[senderId];
      if (!peer && signal.type === 'offer') {
        const newPeer = createPeer(senderId, false);
        if (!newPeer) return;
        peer = newPeer;
      }
      if (!peer) return;

      try {
        if (signal.type === 'offer' || signal.type === 'answer') {
          const isPolite = currentUserId > senderId; // If we are alphabetically larger, we yield.
          
          if (signal.type === 'offer') {
            const offerCollision = makingOfferRef.current[senderId] || peer.signalingState !== 'stable';
            ignoreOfferRef.current[senderId] = !isPolite && offerCollision;
            if (ignoreOfferRef.current[senderId]) return;
          }

          // Important: Don't set remote description if we're ignoring the offer! State handling natively manages rollbacks for polite peers.
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          
          if (signal.type === 'offer') {
            await peer.setLocalDescription();
            if (peer.localDescription) {
               channel.send({
                 type: 'broadcast', event: 'signal',
                 payload: { targetId: senderId, senderId: currentUserId, signal: { type: peer.localDescription.type, sdp: peer.localDescription.sdp } }
               });
            }
          }
        } else if (signal.type === 'candidate') {
          try { await peer.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch (e) {
             if (!ignoreOfferRef.current[senderId]) console.error("ICE error", e);
          }
        }
      } catch (e) { console.error("Signal error", e); }
    };

    // Subscribing to Supabase Realtime Broadcast events
    channel.on('broadcast', { event: 'signal' }, (payload) => handleSignalEvent(payload.payload));

    return () => {
      // Cleanup happens when channel unsubscribes outside this hook
    };
  }, [channel, currentUserId]); 

  // Handle Stream Updates (Mic/Cam toggle)
  useEffect(() => {
    const videoTrack = localStream?.getVideoTracks()[0];
    const audioTrack = localStream?.getAudioTracks()[0];

    Object.values(peersRef.current).forEach(peer => {
      const senders = peer.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      const audioSender = senders.find(s => s.track?.kind === 'audio');

      if (videoTrack) {
        if (videoSender) videoSender.replaceTrack(videoTrack).catch(console.error);
        else if (localStream) peer.addTrack(videoTrack, localStream);
      } else {
        if (videoSender) videoSender.replaceTrack(null);
      }

      if (audioTrack) {
        if (audioSender) audioSender.replaceTrack(audioTrack).catch(console.error);
        else if (localStream) peer.addTrack(audioTrack, localStream);
      } else {
        if (audioSender) audioSender.replaceTrack(null);
      }
    });
  }, [localStream]); 

  return { remoteStreams, updateVolumes };
};