import { ROUTES } from "./routes";

export const APP_NAME = "CypherNet";
export const SESSION_STORAGE_KEY = "cyphernet.session";

export const ROLE_LABELS = {
  admin: "System Administrator",
  oso: "Organization Security Officer",
  internal: "Internal Secure End-User",
  guest: "Guest User",
  general: "General User",
};

export const ROLE_DESCRIPTIONS = {
  admin:
    "Manage organizations, security baselines, incident visibility, and platform operations.",
  oso:
    "Control tenant policies, compliance, retention, users, and active rooms.",
  internal:
    "Create secure rooms, collaborate, send files, and manage invited participants.",
  guest:
    "Join with invite verification, wait for approval, and access room-scoped communication.",
  general:
    "Sign up and log in freely without organization affiliation or approval.",
};

export const APP_NAV = {
  admin: [
    { label: "Dashboard", href: ROUTES.adminPlatform },
    { label: "Profile", href: ROUTES.profile },
  ],
  oso: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Organization", href: ROUTES.adminOrganization },
    { label: "Profile", href: ROUTES.profile },
  ],
  internal: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Rooms", href: ROUTES.rooms },
    { label: "Profile", href: ROUTES.profile },
  ],
  guest: [
    { label: "Guest Session", href: ROUTES.guest },
  ],
  general: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Rooms", href: ROUTES.rooms },
    { label: "Profile", href: ROUTES.profile },
  ],
};
