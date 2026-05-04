"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppScaffold } from "@/components/common/AppScaffold";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { getRoomRoute } from "@/lib/routes";
import { useSessionState } from "@/hooks/useSessionState";

function mapParticipantCount(room) {
  return room.participants?.filter((participant) => participant.status !== "denied").length || 0;
}

export function RoomsList({ pathname }) {
  const router = useRouter();
  const { state, request, signOut, setRoom } = useSessionState();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [joinError, setJoinError] = useState("");
  const [createForm, setCreateForm] = useState({ name: "" });
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!state.hydrated || !state.isAuthenticated) return;

    let cancelled = false;

    async function loadRooms() {
      try {
        setLoading(true);
        const data = await request("/rooms");
        if (!cancelled) {
          setRooms(data.rooms || []);
          setScreenError("");
        }
      } catch (error) {
        if (!cancelled) {
          setScreenError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRooms();
    return () => {
      cancelled = true;
    };
  }, [request, state.hydrated, state.isAuthenticated]);

  const orderedRooms = useMemo(() => {
    return (rooms || []).filter((room) => room.status !== "archived");
  }, [rooms]);

  function updateCreateForm(key, value) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateRoom() {
    if (!createForm.name.trim()) return;

    try {
      const data = await request("/rooms", {
        method: "POST",
        body: JSON.stringify({ name: createForm.name.trim() }),
      });

      setRooms((current) => [data.room, ...current]);
      setCreatedRoom(data.room);
      setRoom(data.room.id);
      setCreateForm({ name: "" });
    } catch (error) {
      setScreenError(error.message);
    }
  }

  async function handleJoinRoom() {
    try {
      const data = await request("/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });

      setRooms((current) => {
        const remaining = current.filter((room) => room.id !== data.room.id);
        return [data.room, ...remaining];
      });
      setRoom(data.room.id);
      setShowJoinModal(false);
      setJoinCode("");
      router.push(getRoomRoute(data.room.id));
    } catch (error) {
      setJoinError(error.message);
    }
  }

  return (
    <AppScaffold
      role={state.role}
      title="Secure Rooms"
      subtitle="Connected to live room APIs"
      pathname={pathname}
      onLogout={signOut}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowJoinModal(true)}>
            Join a Room
          </Button>
          {state.role !== "guest" && (
            <Button variant="dark" onClick={() => setShowCreateModal(true)}>
              Create Room
            </Button>
          )}
        </div>
      }
    >
      {showCreateModal ? (
        <div className="mb-6 rounded-[24px] border border-[var(--border-light)] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-medium text-[var(--text-main)]">Create a New Secure Room</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                A room code will be generated automatically by the backend.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Close
            </Button>
          </div>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">Room Name</span>
            <input
              type="text"
              value={createForm.name}
              onChange={(event) => updateCreateForm("name", event.target.value)}
              className="h-12 w-full rounded-[14px] border border-[var(--border-light)] px-4 text-sm text-[var(--text-main)] outline-none"
              placeholder="Example: Finance Review Session"
            />
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handleCreateRoom}>Create and Generate Code</Button>
            {createdRoom ? (
              <Button variant="secondary" onClick={() => router.push(getRoomRoute(createdRoom.id))}>
                Open Room
              </Button>
            ) : null}
          </div>
          {createdRoom ? (
            <div className="mt-5 rounded-[16px] bg-slate-50 p-4">
              <p className="text-sm font-medium text-[var(--text-main)]">{createdRoom.name} created successfully.</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Room Code: <span className="font-medium text-[var(--accent-strong)]">{createdRoom.code}</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showJoinModal ? (
        <div className="mb-6 rounded-[24px] border border-[var(--border-light)] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-medium text-[var(--text-main)]">Join a Room</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Enter the room code shared with you to join an existing secure room.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
              Close
            </Button>
          </div>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">Room Code</span>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(event.target.value.toUpperCase());
                setJoinError("");
              }}
              className="h-12 w-full rounded-[14px] border border-[var(--border-light)] px-4 text-sm uppercase text-[var(--text-main)] outline-none"
              placeholder="Example: CN-AB12CD"
            />
          </label>
          {joinError ? <p className="mt-3 text-sm text-[#bf5460]">{joinError}</p> : null}
          <div className="mt-5">
            <Button onClick={handleJoinRoom}>Join Room</Button>
          </div>
        </div>
      ) : null}

      {screenError ? <p className="mb-4 text-sm text-[#bf5460]">{screenError}</p> : null}

      {loading ? (
        <Card className="p-5 text-sm text-[var(--text-soft)]">Loading rooms...</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedRooms.map((room) => (
            <Card key={room.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-medium text-[var(--text-main)]">{room.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Host-controlled secure workspace</p>
                </div>
                <StatusPill tone={room.status === "open" ? "active" : "warning"}>{room.status}</StatusPill>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                {mapParticipantCount(room)} participants in this room.
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Room Code: <span className="font-medium text-[var(--accent-strong)]">{room.code}</span>
              </p>
              <Link
                href={getRoomRoute(room.id)}
                onClick={() => setRoom(room.id)}
                className="mt-5 inline-flex rounded-[14px] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2 text-sm font-medium text-slate-950"
              >
                Open Room
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppScaffold>
  );
}
