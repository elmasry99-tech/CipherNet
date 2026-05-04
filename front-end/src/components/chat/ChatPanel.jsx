"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StegMessage } from "@/components/chat/StegMessage";
import { StegRevealModal } from "@/components/chat/StegRevealModal";
import { StegSendButton } from "@/components/chat/StegSendButton";
import { formatTimestamp, readJsonResponse, fileToDataUrl, buildBackendUrl } from "@/lib/api";
import { getSocketClient } from "@/lib/socket";
import { useSessionState } from "@/hooks/useSessionState";

function normalizeMessage(message, participants, currentUser) {
  const senderId = typeof message.senderId === "object" ? message.senderId?._id : message.senderId;
  const senderName = typeof message.senderId === "object"
    ? message.senderId?.name
    : (participants.find((participant) => participant.userId === senderId)?.name || (senderId === currentUser?.id ? "You" : "Participant"));

  if (message.type === "file") {
    const content = JSON.parse(message.content);
    return {
      id: message._id || message.id,
      type: "file",
      author: senderId === currentUser?.id ? "You" : senderName,
      time: formatTimestamp(message.createdAt),
      fileId: content.fileId,
      fileName: content.fileName,
      fileType: content.fileType,
    };
  }

  if (message.type === "steg") {
    const content = JSON.parse(message.content);
    return {
      id: message._id || message.id,
      type: "steg",
      author: senderId === currentUser?.id ? "You" : senderName,
      time: formatTimestamp(message.createdAt),
      imageUrl: content.imageUrl,
      fileId: content.fileId,
    };
  }

  return {
    id: message._id || message.id,
    type: message.type || "text",
    author: senderId === currentUser?.id ? "You" : senderName,
    time: formatTimestamp(message.createdAt),
    body: message.content,
  };
}

export function ChatPanel({ roomId, participants, uploadedFile, onUploadSent, messages, setMessages }) {
  const { state, request, requestBlob } = useSessionState();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [revealBlob, setRevealBlob] = useState(null);
  const currentUser = state.user;
  const currentUserRef = useRef(currentUser);
  const participantsRef = useRef(participants);
  currentUserRef.current = currentUser;
  participantsRef.current = participants;

  const receiver = useMemo(
    () => participants.find((participant) => participant.userId && participant.userId !== currentUser?.id && participant.status === "admitted"),
    [currentUser?.id, participants],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        const data = await request(`/messages/${roomId}`);
        if (!cancelled) {
          setMessages((data.messages || []).map((message) => normalizeMessage(message, participantsRef.current, currentUserRef.current)));
          setChatError("");
        }
      } catch (error) {
        if (!cancelled) {
          setChatError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [request, roomId]);

  useEffect(() => {
    if (!state.token) return undefined;

    const socket = getSocketClient(state.token);
    const channel = socket.subscribe(`room-${roomId}`);
    let cancelled = false;

    async function watchChannel() {
      for await (const payload of channel) {
        if (cancelled) break;
        if (payload?.event) continue;
        setMessages((current) => {
          // Prevent duplicates if history load and socket message overlap
          if (current.some(m => m.id === payload._id || m.id === payload.id)) return current;
          return [
            ...current,
            normalizeMessage(payload, participants, currentUser),
          ];
        });
      }
    }

    watchChannel();
    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [currentUser, participants, roomId, state.token]);

  async function sendTextMessage() {
    const trimmed = draft.trim();
    if (!trimmed || !state.token) return;

    try {
      const socket = getSocketClient(state.token);
      await socket.invoke("message:send", {
        roomId,
        content: trimmed,
        type: "text",
      });
      setDraft("");
      setChatError("");
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function handleStegSend(stegBlob) {
    if (!state.token) return;

    try {
      const formData = new FormData();
      formData.append("roomId", roomId);
      formData.append("file", new File([stegBlob], "steg-message.png", { type: "image/png" }));
      const response = await fetch(buildBackendUrl("/files/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData,
      });
      if (!response.ok) {
        const errData = await readJsonResponse(response);
        throw new Error(errData.error || "Failed to upload steg image");
      }
      const data = await readJsonResponse(response);

      const socket = getSocketClient(state.token);
      await socket.invoke("message:send", {
        roomId,
        type: "steg",
        content: JSON.stringify({ fileId: data.file._id }),
      });
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function downloadFile(message) {
    try {
      const blob = await requestBlob(`/files/${message.fileId}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = message.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function revealMessage(message) {
    try {
      if (message.fileId) {
        const blob = await requestBlob(`/files/${message.fileId}`);
        setRevealBlob(blob);
      } else if (message.imageUrl) {
        const response = await fetch(message.imageUrl);
        const blob = await response.blob();
        setRevealBlob(blob);
      }
    } catch {
      setChatError("Could not load the steg image.");
    }
  }

  async function sendUploadedFile() {
    if (!uploadedFile || !state.token) return;

    try {
      const formData = new FormData();
      formData.append("roomId", roomId);
      formData.append("file", uploadedFile.file);
      const response = await fetch(buildBackendUrl("/files/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData,
      });
      const data = await readJsonResponse(response);

      const socket = getSocketClient(state.token);
      await socket.invoke("message:send", {
        roomId,
        type: "file",
        content: JSON.stringify({
          fileId: data.file._id,
          fileName: uploadedFile.name,
          fileType: uploadedFile.type,
        }),
      });

      onUploadSent?.();
      setChatError("");
    } catch (error) {
      setChatError(error.message);
    }
  }

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex-1 space-y-4 overflow-x-hidden">
        {loading ? <p className="text-sm text-[var(--text-soft)]">Loading conversation...</p> : null}
        {messages.map((message) => {
          if (message.type === "steg") {
            return (
              <StegMessage
                key={message.id}
                message={message}
                canReveal
                onReveal={() => revealMessage(message)}
                requestBlob={requestBlob}
              />
            );
          }

          return (
            <div key={message.id} className="max-w-full sm:max-w-[460px]">
              <p className="mb-1 px-3 text-xs text-[var(--text-soft)]">{message.author}</p>
              <div className="rounded-[18px] border border-[var(--border-light)] bg-white px-4 py-3 text-sm leading-6 text-[var(--text-main)] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {message.type === "file" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-[14px] bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--accent-strong)]">
                      <Paperclip className="h-4 w-4" />
                      {message.fileName}
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadFile(message)}
                      className="rounded-[14px] border border-[var(--border-light)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-main)]"
                    >
                      Download
                    </button>
                  </div>
                ) : (
                  <p>{message.body}</p>
                )}
              </div>
              <p className="mt-1 px-3 text-xs text-[var(--text-muted)]">{message.time}</p>
            </div>
          );
        })}
      </div>

      {uploadedFile ? (
        <div className="mt-4 rounded-[16px] border border-[var(--border-light)] bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-main)]">Ready to send</p>
              <p className="text-xs text-[var(--text-soft)]">{uploadedFile.name}</p>
            </div>
            <Button variant="secondary" onClick={sendUploadedFile}>
              Send to Chat
            </Button>
          </div>
        </div>
      ) : null}

      {chatError ? <p className="mt-4 text-sm text-[#bf5460]">{chatError}</p> : null}

      <div className="mt-5 flex items-center gap-2 rounded-[18px] border border-[var(--border-light)] bg-white p-4">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your message..."
          className="flex-1 text-base text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {receiver ? <StegSendButton receiverId={receiver.userId} onSend={handleStegSend} /> : null}
        <Button type="button" onClick={sendTextMessage} className="flex h-11 w-11 items-center justify-center px-0">
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {revealBlob ? <StegRevealModal imageBlob={revealBlob} onClose={() => setRevealBlob(null)} /> : null}
    </Card>
  );
}
