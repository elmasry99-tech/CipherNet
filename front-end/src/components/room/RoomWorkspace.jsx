"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Trash2, UserMinus, Users, Video, X } from "lucide-react";
import { AppScaffold } from "@/components/common/AppScaffold";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CallPanel } from "@/components/call/CallPanel";
import { FileDropCard } from "@/components/files/FileDropCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useSessionState } from "@/hooks/useSessionState";
import { getSocketClient } from "@/lib/socket";
import { ROUTES } from "@/lib/routes";

function normalizeParticipants(room, currentUser) {
  return (room.participants || []).map((participant) => {
    const rawId = participant.userId?._id || participant.userId;
    const userId = rawId?.toString();
    return {
      userId,
      name: participant.name || (userId === currentUser?.id ? currentUser.name : "Participant"),
      role: participant.role,
      status: participant.status,
    };
  });
}

function normalizeMessage(message, participants, currentUser) {
  const rawId = message.senderId?._id || message.senderId;
  const senderId = rawId?.toString();
  const senderName = typeof message.senderId === "object" && message.senderId?.name
    ? message.senderId?.name
    : (participants.find((p) => p.userId?.toString() === senderId)?.name || (senderId === currentUser?.id ? "You" : "Participant"));

  if (message.type === "file") {
    const content = JSON.parse(message.content);
    return {
      id: message._id || message.id,
      type: "file",
      author: senderId === currentUser?.id ? "You" : senderName,
      time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt || Date.now())),
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
      time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt || Date.now())),
      imageUrl: content.imageUrl,
      fileId: content.fileId,
    };
  }

  return {
    id: message._id || message.id,
    type: message.type || "text",
    author: senderId === currentUser?.id ? "You" : senderName,
    time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt || Date.now())),
    body: message.content,
  };
}

export function RoomWorkspace({ pathname, roomId }) {
  const router = useRouter();
  const { state, request, toggleRoomLock, setCallView, signOut } = useSessionState();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [messages, setMessages] = useState([]);

  const participants = useMemo(
    () => normalizeParticipants(room || {}, state.user),
    [room, state.user],
  );
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  useEffect(() => {
    if (!state.hydrated || !state.isAuthenticated) return;

    let cancelled = false;

    async function loadRoom(showLoading = false) {
      try {
        if (showLoading) setLoading(true);
        const data = await request(`/rooms/${roomId}`);
        if (!cancelled) {
          setRoom(data.room);
          setWorkspaceError("");
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error.message);
        }
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false);
        }
      }
    }

    loadRoom(true);

    async function loadMessages() {
      try {
        const data = await request(`/messages/${roomId}`);
        if (!cancelled) {
          setMessages((data.messages || []).map((msg) => normalizeMessage(msg, participantsRef.current, state.user)));
        }
      } catch {
        // Silent — new messages still arrive via WebSocket
      }
    }
    loadMessages();

    const socket = getSocketClient(state.token);
    const channel = socket.subscribe(`room-${roomId}`);

    (async () => {
      for await (const payload of channel) {
        if (cancelled) break;

        if (payload.event === "message:delete") {
          setMessages((current) => current.filter((m) => m.id !== payload.messageId));
          continue;
        }

        if (payload.event === "message:clear") {
          setMessages([]);
          continue;
        }

        if (payload?.type) {
          setMessages((current) => {
            const exists = current.some((m) => m.id === payload._id || m.id === payload.id);
            if (exists) return current;
            return [...current, normalizeMessage(payload, participantsRef.current, state.user)];
          });
        }
      }
    })();

    const pollInterval = setInterval(() => loadRoom(false), 5000);

    return () => {
      cancelled = true;
      socket.unsubscribe(`room-${roomId}`);
      clearInterval(pollInterval);
    };
  }, [request, roomId, state.hydrated, state.isAuthenticated, state.token, state.user]);

  const canManageRoom = useMemo(() => {
    if (!room || !state.user) return false;
    return state.role === "admin"
      || state.role === "oso"
      || room.hostId?.toString() === state.user.id;
  }, [room, state.role, state.user]);

  async function updateParticipantStatus(userId, status) {
    try {
      const data = await request(`/rooms/${roomId}/admit`, {
        method: "POST",
        body: JSON.stringify({ userId, status }),
      });
      setRoom(data.room);
      setWorkspaceError("");
    } catch (error) {
      setWorkspaceError(error.message);
    }
  }

  async function removeParticipant(userId) {
    if (!userId) {
      setWorkspaceError("User ID is missing. Cannot remove participant.");
      return;
    }
    try {
      const data = await request(`/rooms/${roomId}/participants/${userId}`, {
        method: "DELETE",
      });
      setRoom(data.room);
      setWorkspaceError("");
    } catch (error) {
      setWorkspaceError(error.message);
    }
  }

  async function deleteRoom() {
    if (!window.confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
    try {
      await request(`/rooms/${roomId}`, { method: "DELETE" });
      router.push(ROUTES.rooms);
    } catch (error) {
      setWorkspaceError(error.message);
    }
  }

  if (loading) {
    return (
      <AppScaffold
        role={state.role}
        title="Loading Room"
        subtitle="Fetching room state"
        pathname={pathname}
        onLogout={signOut}
      >
        <Card className="p-6 text-sm text-[var(--text-soft)]">Loading room...</Card>
      </AppScaffold>
    );
  }

  if (!room) {
    return (
      <AppScaffold
        role={state.role}
        title="Room Not Found"
        subtitle="The requested room is unavailable."
        pathname={pathname}
        onLogout={signOut}
      >
        <Card className="p-6 text-sm text-[#bf5460]">{workspaceError || "This room could not be loaded."}</Card>
      </AppScaffold>
    );
  }

  return (
    <AppScaffold
      role={state.role}
      title={room.name}
      subtitle="Live room workspace"
      pathname={pathname}
      onLogout={signOut}
      actions={
        <Button
          variant="secondary"
          onClick={() => router.push(ROUTES.rooms)}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rooms
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-medium text-[var(--text-main)]">{room.name}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Room Code {room.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill tone={room.status === "open" ? "active" : "warning"}>{room.status}</StatusPill>
              <Button variant="muted" onClick={toggleRoomLock}>
                {state.roomLocked ? "Unlock Room" : "Lock Room"}
              </Button>
            </div>
          </div>

          {workspaceError ? <p className="text-sm text-[#bf5460]">{workspaceError}</p> : null}

          {state.callView === "video" ? (
            <CallPanel
              roomId={room.id}
              participants={participants.filter((participant) => participant.status === "admitted")}
              onLeave={() => setCallView("chat")}
            />
          ) : (
            <ChatPanel
              roomId={room.id}
              participants={participants}
              uploadedFile={uploadedFile}
              onUploadSent={() => setUploadedFile(null)}
              messages={messages}
              setMessages={setMessages}
            />
          )}
        </div>

        <div className="space-y-4">
          <FileDropCard
            title="Share protected files with room participants"
            subtitle="PDF, DOCX, PNG up to 10MB"
            uploadedFile={uploadedFile}
            onUpload={(file) => file && setUploadedFile(file)}
            onSend={null}
          />

          <Card className="p-5">
            <p className="text-sm font-medium text-[var(--text-main)]">Participants</p>
            <div className="mt-4 space-y-3">
              {participants.map((person) => (
                <div key={`${person.userId}-${person.role}`} className="rounded-[16px] border border-[var(--border-light)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--text-main)]">{person.name}</p>
                      <p className="text-xs text-[var(--text-soft)]">{person.role}</p>
                    </div>
                    <StatusPill tone={person.status === "waiting" ? "warning" : person.status === "admitted" ? "active" : "danger"}>
                      {person.status}
                    </StatusPill>
                  </div>
                  {canManageRoom && person.status === "waiting" ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => updateParticipantStatus(person.userId, "admitted")}
                      >
                        <Check className="h-4 w-4" />
                        Admit
                      </Button>
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2"
                        onClick={() => updateParticipantStatus(person.userId, "denied")}
                      >
                        <X className="h-4 w-4" />
                        Deny
                      </Button>
                    </div>
                  ) : null}
                  {canManageRoom && person.role !== "host" && person.status !== "waiting" ? (
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="inline-flex items-center gap-2 text-[#bf5460] border-[#bf5460]/30 hover:bg-[#bf5460]/10"
                        onClick={() => removeParticipant(person.userId)}
                      >
                        <UserMinus className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium text-[var(--text-main)]">Room Controls</p>
            <div className="mt-4 grid gap-3">
              <Button
                variant="secondary"
                className="inline-flex items-center justify-center gap-2"
                onClick={() => setCallView(state.callView === "video" ? "chat" : "video")}
              >
                <Video className="h-4 w-4" />
                {state.callView === "video" ? "Return to Chat" : "Join Live Call"}
              </Button>
              <div className="rounded-[16px] border border-[var(--border-light)] bg-slate-50 p-4 text-sm text-[var(--text-soft)]">
                <div className="inline-flex items-center gap-2 text-[var(--text-main)]">
                  <Users className="h-4 w-4" />
                  {participants.filter((participant) => participant.status === "admitted").length} admitted participants
                </div>
              </div>
              {canManageRoom ? (
                <Button
                  variant="secondary"
                  className="inline-flex items-center justify-center gap-2 text-[#bf5460] border-[#bf5460]/30 hover:bg-[#bf5460]/10"
                  onClick={deleteRoom}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Room
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppScaffold>
  );
}
