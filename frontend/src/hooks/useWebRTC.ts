import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const getDistance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const useWebRTC = (socket: Socket | null, localStream: MediaStream | null) => {
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
        
        // STRICT CUTOFF: Only hear if <= 2 grids (using 2.2 for slight diagonal allowance)
        if (dist <= 2.2) { 
           // Ramp volume up? Or just full. User requested "only allow... if 2 grids"
           if(audioEl.volume !== 1.0) audioEl.volume = 1.0;
        } else {
           if(audioEl.volume !== 0.0) audioEl.volume = 0.0;
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

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
          socket.emit('signal', { targetId, signal: { type: 'candidate', candidate: e.candidate } });
        }
      };

      peer.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          setRemoteStreams(prev => ({ ...prev, [targetId]: e.streams[0] }));
          
          // Create Audio Element for Spatial Sound if not exists
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
          socket.emit('signal', { targetId, signal: { type: 'offer', sdp: peer.localDescription } });
        } catch (err) { console.error("Negotiation error", err); }
      };

      peersRef.current[targetId] = peer;
      return peer;
    };

    const handleUserJoined = (newUser: any) => {
      const peer = createPeer(newUser.id, true);
      peer.createDataChannel("presence"); 
    };

    const handleSignal = async ({ senderId, signal }: { senderId: string, signal: any }) => {
      let peer = peersRef.current[senderId];
      if (!peer && signal.type === 'offer') peer = createPeer(senderId, false);
      if (!peer) return;

      try {
        if (signal.type === 'offer') {
          if (peer.signalingState !== 'stable' && peer.signalingState !== 'have-local-offer') return;
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('signal', { targetId: senderId, signal: { type: 'answer', sdp: peer.localDescription } });
        } else if (signal.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate') {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (e) { console.error("Signal error", e); }
    };

    const handleUserLeft = (userId: string) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      if (audioElementsRef.current[userId]) {
        audioElementsRef.current[userId].pause();
        delete audioElementsRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on('user_joined', handleUserJoined);
    socket.on('signal', handleSignal);
    socket.on('user_left', handleUserLeft);

    return () => {
      socket.off('user_joined', handleUserJoined);
      socket.off('signal', handleSignal);
      socket.off('user_left', handleUserLeft);
    };
  }, [socket]); 

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