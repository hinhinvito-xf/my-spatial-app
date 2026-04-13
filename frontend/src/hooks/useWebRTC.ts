import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

const getDistance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const useWebRTC = (channel: RealtimeChannel | null, currentUserId: string | undefined, localStream: MediaStream | null) => {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

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

    const createPeer = (targetId: string, isInitiator: boolean) => {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Add local tracks
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
            audio.volume = 0; // Start MUTED so they don't hear until proximity check passes
            audioElementsRef.current[targetId] = audio;
            audio.play().catch(e => console.log("Audio autoplay blocked", e));
          }
        }
      };

      peer.onnegotiationneeded = async () => {
        try {
          if (peer.signalingState !== 'stable') return;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { targetId, senderId: currentUserId, signal: { type: 'offer', sdp: peer.localDescription } }
          });
        } catch (err) { console.error("Negotiation error", err); }
      };

      peersRef.current[targetId] = peer;
      return peer;
    };

    const handleUserJoined = (payload: any) => {
      const newUser = payload.user;
      if (newUser.id === currentUserId) return;
      if (!peersRef.current[newUser.id]) {
        // Initiator logic: Only initiate if our ID is lexically smaller to avoid duplicate offers
        if (currentUserId < newUser.id) {
          createPeer(newUser.id, true);
        }
      }
    };

    const handleSignalEvent = async (payload: any) => {
      const { targetId, senderId, signal } = payload;
      if (targetId !== currentUserId) return; // Ignore signals not meant for us

      let peer = peersRef.current[senderId];
      // If we don't have a peer and we received an offer, create one
      if (!peer && signal.type === 'offer') peer = createPeer(senderId, false);
      if (!peer) return;

      try {
        if (signal.type === 'offer') {
          if (peer.signalingState !== 'stable' && peer.signalingState !== 'have-local-offer') return;
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { targetId: senderId, senderId: currentUserId, signal: { type: 'answer', sdp: peer.localDescription } }
          });
        } else if (signal.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate') {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (e) { console.error("Signal error", e); }
    };

    const handleUserLeft = (payload: any) => {
      const { id: leftUserId } = payload;
      if (peersRef.current[leftUserId]) {
        peersRef.current[leftUserId].close();
        delete peersRef.current[leftUserId];
      }
      if (audioElementsRef.current[leftUserId]) {
        audioElementsRef.current[leftUserId].pause();
        delete audioElementsRef.current[leftUserId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
    };

    // Subscribing to Supabase Realtime Broadcast events
    channel
      .on('broadcast', { event: 'user_joined' }, (payload) => handleUserJoined(payload.payload))
      .on('broadcast', { event: 'signal' }, (payload) => handleSignalEvent(payload.payload))
      .on('broadcast', { event: 'user_left' }, (payload) => handleUserLeft(payload.payload));

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
        else if (localStream && peer.signalingState === 'stable') peer.addTrack(videoTrack, localStream);
      } else {
        if (videoSender) videoSender.replaceTrack(null);
      }

      if (audioTrack) {
        if (audioSender) audioSender.replaceTrack(audioTrack).catch(console.error);
        else if (localStream && peer.signalingState === 'stable') peer.addTrack(audioTrack, localStream);
      } else {
        if (audioSender) audioSender.replaceTrack(null);
      }
    });
  }, [localStream]); 

  return { remoteStreams, updateVolumes };
};