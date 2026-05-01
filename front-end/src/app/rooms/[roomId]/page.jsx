"use client";

import { useParams, usePathname } from "next/navigation";
import { RoomWorkspace } from "@/components/room/RoomWorkspace";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";

export default function RoomPage() {
  const params = useParams();
  const pathname = usePathname();
  const { hydrated } = useRoleRedirect(["internal"]);
  const roomId = Array.isArray(params?.roomId) ? params.roomId[0] : params?.roomId;

  if (!hydrated) return null;
  if (!roomId) return null;

  return <RoomWorkspace pathname={pathname} roomId={roomId} />;
}
