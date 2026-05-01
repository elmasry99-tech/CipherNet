export const ROUTES = {
  home: "/",
  auth: "/auth",
  authPending: "/auth/pending",
  dashboard: "/dashboard",
  rooms: "/rooms",
  guest: "/guest",
  adminPlatform: "/admin/platform",
  adminPlatformNew: "/admin/platform/new",
  adminOrganization: "/admin/organization",
  reports: "/reports",
  profile: "/profile",
};

export function getRoomRoute(roomId) {
  return `/rooms/${roomId}`;
}

export function getAdminPlatformEditRoute(orgSlug) {
  return `/admin/platform/${orgSlug}/edit`;
}

export function getDefaultRouteForRole(role) {
  switch (role) {
    case "admin":
      return ROUTES.adminPlatform;
    case "oso":
      return ROUTES.adminOrganization;
    case "internal":
      return ROUTES.rooms;
    case "guest":
      return ROUTES.guest;
    case "general":
      return ROUTES.rooms;
    default:
      return ROUTES.home;
  }
}
