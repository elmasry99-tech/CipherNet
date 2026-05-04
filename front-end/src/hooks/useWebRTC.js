"use client";

import { useEffect, useRef, useState } from "react";
import { getSocketClient } from "@/lib/socket";
import { buildBackendUrl } from "@/lib/api";

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useWebRTC({ token, roomId, currentUserId, participants }) {
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamsRef = useRef(new Map());
  const [iceServers, setIceServers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [muted, setMuted] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadIceServers() {
      if (!token) return;

      try {
        const response = await fetch(buildBackendUrl("/ice-servers"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!cancelled) {
          setIceServers(data.iceServers || []);
        }
      } catch {
        if (!cancelled) {
          setIceServers([{ urls: "stun:stun.l.google.com:19302" }]);
        }
      }
    }

    loadIceServers();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !roomId || !currentUserId) return undefined;

    const socket = getSocketClient(token);
    socketRef.current = socket;
    let cancelled = false;

    const channel = socket.subscribe(`room-${roomId}`);

    async function watchChannel() {
      for await (const payload of channel) {
        if (cancelled) break;
        if (!payload || !payload.event) continue;

        try {
          if (payload.event === "call:offer") {
            if (payload?.roomId !== roomId || payload?.targetUserId !== currentUserId) continue;
            const existingPeer = peersRef.current.get(payload.fromUserId);
            if (existingPeer && existingPeer.signalingState !== "stable") {
              existingPeer.close();
              peersRef.current.delete(payload.fromUserId);
            }
            const peer = getPeerConnection(payload.fromUserId);
            await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.transmit("call:answer", {
              roomId,
              targetUserId: payload.fromUserId,
              answer,
            });
          } else if (payload.event === "call:answer") {
            if (payload?.roomId !== roomId || payload?.targetUserId !== currentUserId) continue;
            const peer = peersRef.current.get(payload.fromUserId);
            if (!peer || peer.signalingState !== "have-local-offer") continue;
            await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } else if (payload.event === "call:ice-candidate") {
            if (payload?.roomId !== roomId || payload?.targetUserId !== currentUserId) continue;
            const peer = peersRef.current.get(payload.fromUserId);
            if (peer && payload.candidate) {
              await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
          } else if (payload.event === "call:end") {
            if (payload?.roomId !== roomId) continue;
            const peer = peersRef.current.get(payload.fromUserId);
            peer?.close();
            peersRef.current.delete(payload.fromUserId);
            removeRemoteStream(payload.fromUserId);
          } else if (payload.event === "presence") {
            const senderId = payload.fromUserId || payload.userId;
            if (payload?.roomId !== roomId || senderId === currentUserId || payload?.state !== "online") continue;
            const ep = peersRef.current.get(senderId);
            if (ep && ep.signalingState !== "closed") continue;
            if (currentUserId < senderId) {
              await makeOffer(senderId);
            }
          }
        } catch (err) {
          console.warn("[useWebRTC] signaling error:", err.message);
        }
      }
    }

    watchChannel();

    socket.transmit("presence", { roomId, state: "online" });

    // Re-announce periodically so late joiners discover us
    const presenceInterval = setInterval(() => {
      socket.transmit("presence", { roomId, state: "online" });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(presenceInterval);
      socket.transmit("presence", { roomId, state: "offline" });
    };
  }, [currentUserId, iceServers, participants, roomId, token]);

  useEffect(() => () => {
    stopStream(localStreamRef.current);
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
  }, []);

  function removeRemoteStream(userId) {
    remoteStreamsRef.current.delete(userId);
    setRemoteStreams([...remoteStreamsRef.current.values()]);
  }

  function getPeerConnection(userId) {
    if (peersRef.current.has(userId)) return peersRef.current.get(userId);

    const peer = new RTCPeerConnection({ iceServers });

    // Pre-allocate transceivers so the connection has media slots from the start
    peer.addTransceiver("audio", { direction: "sendrecv" });
    peer.addTransceiver("video", { direction: "sendrecv" });

    peer.onnegotiationneeded = () => {
      makeOffer(userId);
    };

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.transmit("call:ice-candidate", {
          roomId,
          targetUserId: userId,
          candidate,
        });
      }
    };

    peer.ontrack = ({ streams, track }) => {
      const stream = streams[0] || new MediaStream([track]);
      const participant = participants?.find((p) => p.userId === userId);
      remoteStreamsRef.current.set(userId, {
        userId,
        name: participant?.name || "Participant",
        stream,
      });
      setRemoteStreams([...remoteStreamsRef.current.values()]);
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === track.kind)?.sender;
      if (sender) {
        sender.replaceTrack(track);
      } else {
        peer.addTrack(track, localStreamRef.current);
      }
    });

    peersRef.current.set(userId, peer);
    return peer;
  }

  async function makeOffer(userId) {
    const peer = getPeerConnection(userId);
    if (peer.signalingState !== "stable") return;
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.transmit("call:offer", {
        roomId,
        targetUserId: userId,
        fromUserId: currentUserId,
        offer,
      });
    } catch (err) {
      console.warn("[useWebRTC] makeOffer error:", err.message);
    }
  }

  async function ensureAudio() {
    let stream = localStreamRef.current;
    
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      cameraStreamRef.current = stream;
    } else if (stream.getAudioTracks().length === 0) {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const [newAudioTrack] = audioStream.getAudioTracks();
      if (newAudioTrack) {
        stream.addTrack(newAudioTrack);
      }
    }

    const [audioTrack] = stream.getAudioTracks();
    if (audioTrack) {
      audioTrack.enabled = true;
      peersRef.current.forEach((peer) => {
        const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "audio")?.sender;
        if (sender) {
          sender.replaceTrack(audioTrack);
        } else {
          peer.addTrack(audioTrack, stream);
        }
      });
    }

    setLocalStream(stream);
    setMuted(false);
    return stream;
  }

  async function toggleMic() {
    try {
      if (!localStreamRef.current || muted) {
        await ensureAudio();
        setMediaError("");
        return;
      }

      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMuted(localStreamRef.current.getAudioTracks().every((track) => !track.enabled));
    } catch {
      setMediaError("Microphone access was blocked by the browser.");
    }
  }

  async function toggleCamera() {
    try {
      if (!localStreamRef.current || !cameraOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !localStreamRef.current });
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = stream;
        } else if (videoTrack) {
          localStreamRef.current.addTrack(videoTrack);
        }

        if (videoTrack) {
          peersRef.current.forEach((peer) => {
            const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "video")?.sender;
            if (sender) {
              sender.replaceTrack(videoTrack);
            } else {
              peer.addTrack(videoTrack, localStreamRef.current);
            }
          });
        }
        
        if (audioTrack && !muted) {
          peersRef.current.forEach((peer) => {
            const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "audio")?.sender;
            if (sender) {
              sender.replaceTrack(audioTrack);
            } else {
              peer.addTrack(audioTrack, localStreamRef.current);
            }
          });
        } else if (audioTrack) {
          // If we got an audio track but we are supposed to be muted, ensure it's disabled initially
          audioTrack.enabled = false;
        }

        cameraStreamRef.current = stream;
        setLocalStream(localStreamRef.current);
        setCameraOn(true);
        setMuted(localStreamRef.current.getAudioTracks().every((track) => !track.enabled));
        setMediaError("");
        setIsReady(true);
        socketRef.current?.transmit("presence", { roomId, state: "online" });
        return;
      }

      const [videoTrack] = localStreamRef.current.getVideoTracks();
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }

      peersRef.current.forEach((peer) => {
        const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "video")?.sender;
        if (sender) {
          sender.replaceTrack(null);
        }
      });

      setLocalStream(localStreamRef.current);
      setCameraOn(false);
    } catch {
      setMediaError("Camera access was blocked by the browser.");
    }
  }

  async function toggleScreenShare() {
    try {
      if (sharing) {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
        peersRef.current.forEach((peer) => {
          const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "video")?.sender;
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
        setSharing(false);
        setLocalStream(localStreamRef.current);
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      screenStreamRef.current = displayStream;

      peersRef.current.forEach((peer) => {
        const sender = peer.getTransceivers().find(t => t.receiver?.track?.kind === "video")?.sender;
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else if (localStreamRef.current) {
          peer.addTrack(screenTrack, localStreamRef.current);
        }
      });

      if (screenTrack) {
        screenTrack.addEventListener("ended", () => {
          toggleScreenShare().catch(() => {});
        }, { once: true });
      }

      setSharing(true);
      setLocalStream(displayStream);
      setMediaError("");
    } catch {
      setMediaError("Screen sharing was cancelled or blocked.");
    }
  }

  function leaveCall() {
    socketRef.current?.transmit("call:end", { roomId });
    stopStream(localStreamRef.current);
    stopStream(cameraStreamRef.current);
    stopStream(screenStreamRef.current);
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    localStreamRef.current = null;
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams([]);
    setMuted(true);
    setCameraOn(false);
    setSharing(false);
    setIsReady(false);
  }

  return {
    localStream,
    remoteStreams,
    muted,
    cameraOn,
    sharing,
    mediaError,
    isReady,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    leaveCall,
  };
}
