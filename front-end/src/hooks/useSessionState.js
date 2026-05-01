"use client";

import { useEffect, useMemo, useState } from "react";
import { baseMessages } from "@/data/mockMessages";
import { mockRooms } from "@/data/mockRooms";
import { mockUsers, officerUsers, pendingEmployeeRequests } from "@/data/mockUsers";
import { organizationRows } from "@/features/policies";
import { SESSION_STORAGE_KEY } from "@/lib/constants";

const defaultProfiles = {
  admin: { ...mockUsers.admin },
  oso: { ...mockUsers.oso },
  internal: { ...mockUsers.internal },
  guest: { ...mockUsers.guest },
};

const defaultState = {
  role: null,
  roomId: "client-intake-jones",
  roomLocked: false,
  callView: "chat",
  guestStep: "verify",
  signupPendingRole: null,
  officerSection: "Policies",
  profiles: defaultProfiles,
  organizations: organizationRows,
  officerManagedUsers: officerUsers,
  employeeJoinRequests: pendingEmployeeRequests,
  policySettings: {
    "File Sharing": true,
    "Screen Sharing": false,
    "External Access": true,
    "Guest Verification": true,
  },
  retentionSettings: {
    "Message Retention": 30,
    "Session Expiration": 7,
  },
  messageRateLimit: 5000,
  adminAuditLogs: [
    { id: "log1", time: "2026-04-11 09:12", message: "Finance Plus status changed to suspended." },
    { id: "log2", time: "2026-04-11 08:46", message: "Northstar Legal officer account provisioned." },
    { id: "log3", time: "2026-04-11 08:15", message: "Global guest verification baseline confirmed." },
  ],
  customRooms: [],
  customOfficerAccounts: [],
  admittedGuestRooms: [],
  closedRoomIds: [],
  uploads: {},
  messagesByRoom: baseMessages,
};

export function useSessionState() {
  const [state, setState] = useState(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          ...defaultState,
          ...parsed,
          profiles: parsed.profiles || defaultProfiles,
          organizations: parsed.organizations || organizationRows,
          officerManagedUsers: parsed.officerManagedUsers || officerUsers,
          employeeJoinRequests: parsed.employeeJoinRequests || pendingEmployeeRequests,
          policySettings: parsed.policySettings || defaultState.policySettings,
          retentionSettings: parsed.retentionSettings || defaultState.retentionSettings,
          messageRateLimit: parsed.messageRateLimit || defaultState.messageRateLimit,
          adminAuditLogs: parsed.adminAuditLogs || defaultState.adminAuditLogs,
          messagesByRoom: {
            ...baseMessages,
            ...(parsed.messagesByRoom || {}),
          },
        });
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const sessionUser = useMemo(() => {
    if (!state.role) return null;
    return state.profiles[state.role] || mockUsers[state.role];
  }, [state.profiles, state.role]);

  function update(patch) {
    setState((current) => ({ ...current, ...patch }));
  }

  function getTimestamp() {
    const now = new Date();
    return now.toISOString().slice(0, 16).replace("T", " ");
  }

  function appendAuditLog(message) {
    return {
      id: `log-${Date.now()}`,
      time: getTimestamp(),
      message,
    };
  }

  function signIn(role) {
    const nextState = {
      ...state,
      role,
      roomId: state.roomId || "client-intake-jones",
      signupPendingRole: null,
    };
    setState(nextState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextState));
    }
  }

  function signOut() {
    setState(defaultState);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  function setOfficerSection(section) {
    update({ officerSection: section });
  }

  function setRoom(roomId) {
    update({ roomId });
  }

  function toggleRoomLock() {
    setState((current) => ({ ...current, roomLocked: !current.roomLocked }));
  }

  function setCallView(callView) {
    update({ callView });
  }

  function setGuestStep(guestStep) {
    update({ guestStep });
  }

  function setSignupPendingRole(signupPendingRole) {
    update({ signupPendingRole });
  }

  function toggleOrganizationStatus(name) {
    setState((current) => ({
      ...current,
      organizations: current.organizations.map((organization) =>
        organization.name === name
          ? {
              ...organization,
              status: organization.status === "suspended" ? "active" : "suspended",
            }
          : organization,
      ),
      adminAuditLogs: [
        appendAuditLog(
          `${name} status changed to ${
            current.organizations.find((organization) => organization.name === name)?.status === "suspended"
              ? "active"
              : "suspended"
          }.`,
        ),
        ...current.adminAuditLogs,
      ],
    }));
  }

  function createRoom() {
    const roomNumber = state.customRooms.length + 4;
    const roomCode = `CN-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const roomName = `Secure Room ${roomNumber}`;
    const room = {
      id: `secure-room-${Date.now()}`,
      name: roomName,
      kind: "Ad hoc secure workspace",
      roomCode,
      unread: 0,
      participants: [
        { name: "You", state: "Present" },
        { name: "Assigned Guest", state: "Waiting" },
      ],
    };

    setState((current) => ({
      ...current,
      roomId: room.id,
      customRooms: [room, ...current.customRooms],
      messagesByRoom: {
        ...current.messagesByRoom,
        [room.id]: [
          {
            id: Date.now(),
            author: "CypherNet",
            body: `Room created. Share code ${roomCode} to let approved participants join this secure session.`,
            time: "Now",
          },
        ],
      },
    }));

    return room.id;
  }

  function createRoomWithDetails(details) {
    const roomCode = `CN-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const room = {
      id: `secure-room-${Date.now()}`,
      name: details.name.trim(),
      kind: details.kind.trim() || "Ad hoc secure workspace",
      roomCode,
      unread: 0,
      participants: [
        { name: "You", state: "Present" },
        ...(details.allowGuest ? [{ name: "Waiting Guest", state: "Waiting" }] : []),
      ],
    };

    setState((current) => ({
      ...current,
      roomId: room.id,
      customRooms: [room, ...current.customRooms],
      messagesByRoom: {
        ...current.messagesByRoom,
        [room.id]: [
          {
            id: Date.now(),
            author: "CypherNet",
            body: `Room created. Share code ${roomCode} to let approved participants join this secure session.`,
            time: "Now",
          },
        ],
      },
    }));

    return room;
  }

  function joinRoomByCode(code) {
    const normalizedCode = code.trim().toUpperCase();
    const allRooms = [...state.customRooms, ...mockRooms];
    const room = allRooms.find((entry) => entry.roomCode?.toUpperCase() === normalizedCode);
    if (!room) return null;
    setState((current) => ({ ...current, roomId: room.id }));
    return room;
  }

  function createOrganization(organization, officerAccount) {
    setState((current) => ({
      ...current,
      organizations: organization ? [organization, ...current.organizations] : current.organizations,
      customOfficerAccounts: officerAccount
        ? [officerAccount, ...current.customOfficerAccounts]
        : current.customOfficerAccounts,
      adminAuditLogs: organization
        ? [
            appendAuditLog(`Organization ${organization.name} created and default officer account provisioned.`),
            ...current.adminAuditLogs,
          ]
        : current.adminAuditLogs,
    }));
  }

  function updateOrganizationBySlug(orgSlug, updates) {
    setState((current) => ({
      ...current,
      organizations: current.organizations.map((organization) =>
        organization.slug === orgSlug ? { ...organization, ...updates } : organization,
      ),
      adminAuditLogs: [
        appendAuditLog(`Organization ${updates.name || orgSlug} details updated.`),
        ...current.adminAuditLogs,
      ],
    }));
  }

  function toggleOfficerUserStatus(userId) {
    setState((current) => ({
      ...current,
      officerManagedUsers: current.officerManagedUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              accountStatus: user.accountStatus === "disabled" ? "active" : "disabled",
            }
          : user,
      ),
    }));
  }

  function approveEmployeeRequest(requestId) {
    setState((current) => {
      const request = current.employeeJoinRequests.find((entry) => entry.id === requestId);
      if (!request) return current;

      return {
        ...current,
        employeeJoinRequests: current.employeeJoinRequests.filter((entry) => entry.id !== requestId),
        officerManagedUsers: [
          {
            id: `u-${Date.now()}`,
            name: request.name,
            email: request.email,
            role: request.requestedTitle,
            organization: request.organization,
            state: "Active",
            accountStatus: "active",
          },
          ...current.officerManagedUsers,
        ],
      };
    });
  }

  function denyEmployeeRequest(requestId) {
    setState((current) => ({
      ...current,
      employeeJoinRequests: current.employeeJoinRequests.filter((entry) => entry.id !== requestId),
    }));
  }

  function addPendingAccountRequest(request) {
    setState((current) => ({
      ...current,
      employeeJoinRequests: [
        {
          id: `req-${Date.now()}`,
          ...request,
          requestedAt: getTimestamp().slice(11),
        },
        ...current.employeeJoinRequests,
      ],
    }));
  }

  function updateProfile(role, updates) {
    setState((current) => ({
      ...current,
      profiles: {
        ...current.profiles,
        [role]: {
          ...current.profiles[role],
          ...updates,
        },
      },
    }));
  }

  function togglePolicySetting(policyName) {
    setState((current) => ({
      ...current,
      policySettings: {
        ...current.policySettings,
        [policyName]: !current.policySettings[policyName],
      },
    }));
  }

  function updateRetentionSetting(settingTitle, value) {
    const parsedValue = Number(value);
    setState((current) => ({
      ...current,
      retentionSettings: {
        ...current.retentionSettings,
        [settingTitle]: Number.isNaN(parsedValue) ? current.retentionSettings[settingTitle] : parsedValue,
      },
    }));
  }

  function setMessageRateLimit(value) {
    const parsedValue = Number(value);
    if (Number.isNaN(parsedValue)) return;

    setState((current) => ({
      ...current,
      messageRateLimit: parsedValue,
      adminAuditLogs: [
        appendAuditLog(`Global monthly message rate limit set to ${parsedValue}.`),
        ...current.adminAuditLogs,
      ],
    }));
  }

  function admitGuest(roomId) {
    setState((current) => ({
      ...current,
      admittedGuestRooms: current.admittedGuestRooms.includes(roomId)
        ? current.admittedGuestRooms
        : [...current.admittedGuestRooms, roomId],
    }));
  }

  function toggleRoomClosed(roomId) {
    setState((current) => ({
      ...current,
      closedRoomIds: current.closedRoomIds.includes(roomId)
        ? current.closedRoomIds.filter((id) => id !== roomId)
        : [...current.closedRoomIds, roomId],
    }));
  }

  function sendMessage(roomId, body) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setState((current) => ({
      ...current,
      messagesByRoom: {
        ...current.messagesByRoom,
        [roomId]: [
          ...(current.messagesByRoom[roomId] || []),
          { id: Date.now(), author: "You", body: trimmed, time: "Now" },
        ],
      },
    }));
  }

  function addUpload(roomId, fileData) {
    setState((current) => ({
      ...current,
      uploads: {
        ...current.uploads,
        [roomId]: fileData,
      },
    }));
  }

  function sendUploadAsMessage(roomId) {
    setState((current) => {
      const fileData = current.uploads[roomId];
      if (!fileData) return current;

      return {
        ...current,
        uploads: {
          ...current.uploads,
          [roomId]: null,
        },
        messagesByRoom: {
          ...current.messagesByRoom,
          [roomId]: [
            ...(current.messagesByRoom[roomId] || []),
            {
              id: Date.now(),
              author: "You",
              body: "Shared a secure attachment",
              fileName: fileData.name,
              fileType: fileData.type,
              filePreview: fileData.preview,
              kind: "file",
              time: "Now",
            },
          ],
        },
      };
    });
  }

  return {
    hydrated,
    sessionUser,
    state,
    signIn,
    signOut,
    setOfficerSection,
    setRoom,
    toggleRoomLock,
    setCallView,
    setGuestStep,
    setSignupPendingRole,
    toggleOrganizationStatus,
    createRoom,
    createRoomWithDetails,
    joinRoomByCode,
    createOrganization,
    updateOrganizationBySlug,
    toggleOfficerUserStatus,
    approveEmployeeRequest,
    denyEmployeeRequest,
    addPendingAccountRequest,
    togglePolicySetting,
    updateRetentionSetting,
    setMessageRateLimit,
    updateProfile,
    admitGuest,
    toggleRoomClosed,
    sendMessage,
    addUpload,
    sendUploadAsMessage,
  };
}
