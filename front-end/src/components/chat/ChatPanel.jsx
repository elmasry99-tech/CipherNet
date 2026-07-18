"use client";

import { useMemo, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StegMessage } from "@/components/chat/StegMessage";
import { StegRevealModal } from "@/components/chat/StegRevealModal";
import { StegSendButton } from "@/components/chat/StegSendButton";
import { readJsonResponse, buildBackendUrl } from "@/lib/api";
import { getSocketClient } from "@/lib/socket";
import { useSessionState } from "@/hooks/useSessionState";


export function ChatPanel({ roomId, participants, uploadedFile, onUploadSent, messages, setMessages }) {
  const { state, request, requestBlob } = useSessionState();
  const [draft, setDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [revealBlob, setRevealBlob] = useState(null);
  const currentUser = state.user;
  const receiver = useMemo(
    () => participants.find((participant) => participant.userId && participant.userId !== currentUser?.id && participant.status === "admitted"),
    [currentUser?.id, participants],
  );


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
        setMessages((current) => current.filter((m) => m.id !== message.id));

        // AUTO-DELETE after reveal: delete from server
        try {
          await request(`/files/${message.fileId}`, { method: "DELETE" });
          // Also delete the message itself from history
          const socket = getSocketClient(state.token);
          await socket.invoke("message:delete", { messageId: message.id });
        } catch (e) {
          console.error("Auto-delete failed", e);
        }
      } else if (message.imageUrl) {
        const response = await fetch(message.imageUrl);
        const blob = await response.blob();
        setRevealBlob(blob);
        setMessages((current) => current.filter((m) => m.id !== message.id));
      }
    } catch {
      setChatError("Could not load the steg image.");
    }
  }

  async function clearChat() {
    if (!window.confirm("Are you sure you want to clear all messages in this room?")) return;
    try {
      await request(`/messages/room/${roomId}`, { method: "DELETE" });
      setMessages([]);
      setChatError("");
    } catch (error) {
      setChatError(error.message);
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
    <Card className="flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-main)]">Room Conversation</p>
        {(state.role === "admin" || state.role === "oso" || participants.find(p => p.userId === state.user?.id)?.role === "host") && (
          <Button variant="muted" size="sm" onClick={clearChat} className="h-8 text-xs">
            Clear Chat
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-x-hidden">
        {messages.map((message) => {
          if (message.type === "steg") {
            return (
              <StegMessage
                key={message.id}
                message={message}
                canReveal={message.author !== "You"}
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
