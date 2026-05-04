"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { generateKeyPair } from "@/lib/crypto";
import { readJsonResponse, buildBackendUrl } from "@/lib/api";
import { closeSocketClient } from "@/lib/socket";
import { SESSION_STORAGE_KEY } from "@/lib/constants";

const defaultState = {
  hydrated: false,
  token: null,
  user: null,
  signupPendingRole: null,
  roomId: null,
  roomLocked: false,
  callView: "chat",
  guestStep: "verify",
  officerSection: "Policies",
};

let store = { ...defaultState };
let initialized = false;
let keypairPromise = null;
const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function writeStore(nextState) {
  store = nextState;
  emitChange();
}

function persistStore() {
  if (typeof window === "undefined") return;

  const payload = {
    token: store.token,
    user: store.user,
    signupPendingRole: store.signupPendingRole,
    roomId: store.roomId,
    roomLocked: store.roomLocked,
    callView: store.callView,
    guestStep: store.guestStep,
    officerSection: store.officerSection,
  };

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

function initializeStore() {
  if (initialized || typeof window === "undefined") return;

  initialized = true;

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      store = {
        ...defaultState,
        ...parsed,
        hydrated: true,
      };
      return;
    }
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  store = {
    ...defaultState,
    hydrated: true,
  };
}

function updateStore(patch) {
  const nextState = {
    ...store,
    ...(typeof patch === "function" ? patch(store) : patch),
  };
  writeStore(nextState);
  persistStore();
}

function clearStore() {
  store = {
    ...defaultState,
    hydrated: true,
  };

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem("cyphernet.privateKey");
  }

  closeSocketClient();
  emitChange();
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (store.token) {
    headers.set("Authorization", `Bearer ${store.token}`);
  }

  const response = await fetch(buildBackendUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStore();
  }

  return response;
}

async function ensureStegKeys() {
  if (typeof window === "undefined" || !store.token) return;
  if (window.localStorage.getItem("cyphernet.privateKey")) return;
  if (!keypairPromise) {
    keypairPromise = generateKeyPair().catch((error) => {
      keypairPromise = null;
      throw error;
    });
  }
  await keypairPromise;
}

export function useSessionState() {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => store,
    () => defaultState,
  );

  useEffect(() => {
    initializeStore();
    emitChange();
  }, []);

  useEffect(() => {
    if (!state.hydrated || !state.token) return;
    ensureStegKeys().catch(() => {});
  }, [state.hydrated, state.token]);

  const actions = useMemo(() => ({
    async login(credentials) {
      const response = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      const data = await readJsonResponse(response);

      updateStore({
        token: data.token,
        user: data.user,
        signupPendingRole: null,
        roomId: null,
      });

      return data;
    },

    async signup(payload) {
      const response = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse(response);
      updateStore({ signupPendingRole: payload.role });
      return data;
    },

    async request(path, options = {}) {
      const response = await request(path, options);
      return readJsonResponse(response);
    },

    async requestBlob(path, options = {}) {
      const response = await request(path, options);
      if (!response.ok) {
        const data = await readJsonResponse(response);
        throw new Error(data.error || "Request failed");
      }
      return response.blob();
    },

    signIn(session) {
      updateStore({
        token: session.token,
        user: session.user,
        signupPendingRole: null,
      });
    },

    signOut() {
      clearStore();
    },

    setOfficerSection(officerSection) {
      updateStore({ officerSection });
    },

    setRoom(roomId) {
      updateStore({ roomId });
    },

    toggleRoomLock() {
      updateStore((current) => ({ roomLocked: !current.roomLocked }));
    },

    setCallView(callView) {
      updateStore({ callView });
    },

    setGuestStep(guestStep) {
      updateStore({ guestStep });
    },

    setSignupPendingRole(signupPendingRole) {
      updateStore({ signupPendingRole });
    },
  }), []);

  return {
    hydrated: state.hydrated,
    sessionUser: state.user,
    state: {
      ...state,
      role: state.user?.role || null,
      isAuthenticated: Boolean(state.token),
    },
    ...actions,
  };
}
