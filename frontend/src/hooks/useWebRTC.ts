import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

const getDistance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const useWebRTC = (
  channel: RealtimeChannel | null,
  currentUserId: string | undefined,
  localStream: MediaStream | null,
  otherUsers: {id: string, x?: number, y?: number}[] = [],
  myPos: {x: number, y: number} = {x:0, y:0}
) => {
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const ignoreOfferRef = useRef<Record<string, boolean>>({});
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const myPosRef = useRef(myPos);
  const otherUsersRef = useRef(otherUsers);

  // Keep refs in sync without triggering effects
  useEffect(() => { myPosRef.current = myPos; }, [myPos.x, myPos.y]);
  useEffect(() => { otherUsersRef.current = otherUsers; }, [otherUsers]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Create a hidden DOM container — Chrome REQUIRES video elements to be in
  // the document tree to activate its hardware decoder. Off-DOM elements
  // stay at readyState 0 forever and canvas drawImage gets blank frames.
  useEffect(() => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:640px;height:480px;pointer-events:none;';
    document.body.appendChild(container);
    videoContainerRef.current = container;
    return () => { container.remove(); };
  }, []);

  // --- CREATE PEER ---
  const createPeer = useCallback((targetId: string, isInitiator: boolean) => {
    if (!channel || !currentUserId) return null;

    if (peersRef.current[targetId]) {
      peersRef.current[targetId].close();
      delete peersRef.current[targetId];
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    if (isInitiator) {
      peer.createDataChannel('init');
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current!);
      });
    }

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: 'broadcast', event: 'signal',
          payload: { targetId, senderId: currentUserId, signal: { type: 'candidate', candidate: e.candidate } }
        }).catch(() => {});
      }
    };

    // Append video element to DOM container so Chrome decodes it
    peer.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        if (!remoteVideoRefs.current[targetId]) {
          const v = document.createElement('video');
          v.autoplay = true; v.playsInline = true; v.muted = true;
          v.style.cssText = 'width:320px;height:240px;';
          v.srcObject = e.streams[0];
          videoContainerRef.current?.appendChild(v);
          v.play().catch(() => {});
          remoteVideoRefs.current[targetId] = v;
        } else {
          const v = remoteVideoRefs.current[targetId];
          if (v.srcObject !== e.streams[0]) {
            v.srcObject = e.streams[0];
            v.play().catch(() => {});
          }
        }

        if (!audioElementsRef.current[targetId]) {
          const audio = new Audio();
          audio.srcObject = e.streams[0];
          audio.autoplay = true;
          audio.volume = 0;
          audioElementsRef.current[targetId] = audio;
          audio.play().catch(() => {});
        }
      }
    };

    peer.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[targetId] = true;
        await peer.setLocalDescription();
        if (peer.localDescription) {
          channel.send({
            type: 'broadcast', event: 'signal',
            payload: { targetId, senderId: currentUserId, signal: { type: peer.localDescription.type, sdp: peer.localDescription.sdp } }
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Negotiation error", err);
      } finally {
        makingOfferRef.current[targetId] = false;
      }
    };

    peersRef.current[targetId] = peer;
    return peer;
  }, [channel, currentUserId]);

  // --- PROXIMITY CHECK (throttled to 1s interval, NOT on every position tick) ---
  useEffect(() => {
    if (!channel || !currentUserId) return;

    const checkProximity = () => {
      const pos = myPosRef.current;
      const users = otherUsersRef.current;
      const activeIds = new Set<string>();

      users.forEach(u => {
        const dist = (u.x !== undefined && u.y !== undefined)
          ? getDistance(pos, { x: u.x, y: u.y }) : 0;
        if (dist <= 12) {
          activeIds.add(u.id);
          if (!peersRef.current[u.id] && u.id !== currentUserId) {
            createPeer(u.id, currentUserId < u.id);
          }
        }
      });

      Object.keys(peersRef.current).forEach(id => {
        if (!activeIds.has(id)) {
          peersRef.current[id].close();
          delete peersRef.current[id];
          if (remoteVideoRefs.current[id]) {
            remoteVideoRefs.current[id].pause();
            remoteVideoRefs.current[id].srcObject = null;
            remoteVideoRefs.current[id].remove();
            delete remoteVideoRefs.current[id];
          }
          if (audioElementsRef.current[id]) {
            audioElementsRef.current[id].pause();
            audioElementsRef.current[id].srcObject = null;
            delete audioElementsRef.current[id];
          }
        }
      });
    };

    checkProximity();
    const interval = setInterval(checkProximity, 1000);
    return () => clearInterval(interval);
  }, [channel, currentUserId, createPeer]);

  // --- SPATIAL AUDIO ---
  const updateVolumes = useCallback((myPos: {x:number, y:number}, otherUsers: {id: string, x: number, y: number}[]) => {
    otherUsers.forEach(user => {
      const audioEl = audioElementsRef.current[user.id];
      if (audioEl) {
        const dist = getDistance(myPos, {x: user.x, y: user.y});
        if (dist <= 6) {
          const vol = Math.max(0, 1 - (dist / 6));
          if (Math.abs(audioEl.volume - vol) > 0.05) audioEl.volume = vol;
        } else {
          if (audioEl.volume !== 0.0) audioEl.volume = 0.0;
        }
      }
    });
  }, []);

  // --- SIGNALING ---
  useEffect(() => {
    if (!channel || !currentUserId) return;

    const handleSignalEvent = async (payload: any) => {
      const { targetId, senderId, signal } = payload;
      if (targetId !== currentUserId) return;

      let peer = peersRef.current[senderId];
      if (!peer && signal.type === 'offer') {
        const newPeer = createPeer(senderId, false);
        if (!newPeer) return;
        peer = newPeer;
      }
      if (!peer) return;

      try {
        if (signal.type === 'offer' || signal.type === 'answer') {
          const isPolite = currentUserId > senderId;
          if (signal.type === 'offer') {
            const offerCollision = makingOfferRef.current[senderId] || peer.signalingState !== 'stable';
            ignoreOfferRef.current[senderId] = !isPolite && offerCollision;
            if (ignoreOfferRef.current[senderId]) return;
          }
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          if (signal.type === 'offer') {
            await peer.setLocalDescription();
            if (peer.localDescription) {
              channel.send({
                type: 'broadcast', event: 'signal',
                payload: { targetId: senderId, senderId: currentUserId, signal: { type: peer.localDescription.type, sdp: peer.localDescription.sdp } }
              }).catch(() => {});
            }
          }
        } else if (signal.type === 'candidate') {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            if (!ignoreOfferRef.current[senderId]) console.error("ICE error", e);
          }
        }
      } catch (e) { console.error("Signal error", e); }
    };

    channel.on('broadcast', { event: 'signal' }, (payload) => handleSignalEvent(payload.payload));
    return () => {};
  }, [channel, currentUserId, createPeer]);

  // --- TRACK UPDATES (camera/mic toggle) ---
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
        if (videoSender) videoSender.replaceTrack(null).catch(() => {});
      }

      if (audioTrack) {
        if (audioSender) audioSender.replaceTrack(audioTrack).catch(console.error);
        else if (localStream) peer.addTrack(audioTrack, localStream);
      } else {
        if (audioSender) audioSender.replaceTrack(null).catch(() => {});
      }
    });
  }, [localStream]);

  return { remoteVideoRefs, updateVolumes };
};