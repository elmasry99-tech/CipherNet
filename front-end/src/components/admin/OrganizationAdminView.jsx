"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppScaffold } from "@/components/common/AppScaffold";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useSessionState } from "@/hooks/useSessionState";

export function OrganizationAdminView({ pathname }) {
  const { state, request, setOfficerSection, signOut } = useSessionState();
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const section = state.officerSection;

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizationData() {
      if (!state.user?.orgId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [orgData, userData, roomData] = await Promise.all([
          request("/orgs"),
          request(`/orgs/${state.user.orgId}/users`),
          request("/rooms"),
        ]);

        if (!cancelled) {
          setOrganization((orgData.organizations || [])[0] || null);
          setUsers(userData.users || []);
          setRooms(roomData.rooms || []);
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

    loadOrganizationData();
    return () => {
      cancelled = true;
    };
  }, [request, state.user?.orgId]);

  const pendingUsers = useMemo(
    () => users.filter((user) => user.status === "pending"),
    [users],
  );

  const managedUsers = useMemo(
    () => users.filter((user) => user.role !== "oso"),
    [users],
  );

  async function updateOrgPolicies(policies) {
    if (!organization) return;

    try {
      const data = await request(`/orgs/${organization._id || organization.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          policies: {
            ...organization.policies,
            ...policies,
          },
        }),
      });
      setOrganization(data.organization);
      setScreenError("");
    } catch (error) {
      setScreenError(error.message);
    }
  }

  async function updateUserStatus(userId, status) {
    try {
      const data = await request(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setUsers((current) =>
        current.map((user) =>
          user._id === userId || user.id === userId
            ? { ...user, status: data.user.status }
            : user,
        ),
      );
      setScreenError("");
    } catch (error) {
      setScreenError(error.message);
    }
  }

  const deleteUser = useCallback(async (userId) => {
    try {
      await request(`/users/${userId}`, { method: "DELETE" });
      setUsers((current) => current.filter((u) => (u._id || u.id) !== userId));
      setConfirmDeleteId(null);
      setScreenError("");
    } catch (error) {
      setScreenError(error.message);
    }
  }, [request]);

  async function toggleRoomClosed(room) {
    try {
      const nextStatus = room.status === "closed" ? "open" : "closed";
      const data = await request(`/rooms/${room.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setRooms((current) => current.map((entry) => (entry.id === room.id ? data.room : entry)));
    } catch (error) {
      setScreenError(error.message);
    }
  }

  return (
    <AppScaffold
      role="oso"
      title={organization?.name || "Organization"}
      subtitle="Organization Security Officer"
      pathname={pathname}
      onLogout={signOut}
      actions={<StatusPill tone="accent">Tenant APIs connected</StatusPill>}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {["Policies", "Retention", "Users", "Rooms"].map((label) => (
          <Button
            key={label}
            variant={section === label ? "primary" : "secondary"}
            onClick={() => setOfficerSection(label)}
          >
            {label}
          </Button>
        ))}
      </div>

      {screenError ? <p className="mb-4 text-sm text-[#bf5460]">{screenError}</p> : null}

      {loading ? <Card className="p-5 text-sm text-[var(--text-soft)]">Loading organization data...</Card> : null}

      {!loading && section === "Policies" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["File Sharing", "fileSharing"],
            ["Screen Sharing", "screenSharing"],
            ["Guest Access", "guestAccess"],
          ].map(([label, key]) => (
            <Card key={key} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-medium text-[var(--text-main)]">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">Backed by the real organization policy document.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateOrgPolicies({ [key]: !organization?.policies?.[key] })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                    organization?.policies?.[key] ? "bg-[var(--accent-strong)]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                      organization?.policies?.[key] ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && section === "Retention" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["Message Retention", "retentionDays"],
            ["Session Expiration", "sessionExpiry"],
            ["Message Rate Limit", "messageRateLimit"],
          ].map(([label, key]) => (
            <Card key={key} className="p-5">
              <p className="text-base font-medium text-[var(--text-main)]">{label}</p>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">Value</span>
                <input
                  type="number"
                  min="1"
                  value={organization?.policies?.[key] || ""}
                  onChange={(event) => updateOrgPolicies({ [key]: Number(event.target.value) || 0 })}
                  className="h-12 w-full rounded-[14px] border border-[var(--border-light)] bg-white px-4 text-sm text-[var(--text-main)] outline-none"
                />
              </label>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && section === "Users" ? (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-medium text-[var(--text-main)]">Pending Account Requests</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Review internal employee sign-up requests for this organization.
                </p>
              </div>
              <StatusPill tone="warning">{pendingUsers.length} Pending</StatusPill>
            </div>
            <div className="mt-4 space-y-3">
              {pendingUsers.length ? (
                pendingUsers.map((user) => (
                  <div
                    key={user._id || user.id}
                    className="flex flex-col gap-4 rounded-[16px] border border-[var(--border-light)] bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-main)]">{user.name}</p>
                      <p className="text-sm text-[var(--text-soft)]">{user.email}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Requested access: {user.role}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => updateUserStatus(user._id || user.id, "disabled")}>
                        Deny
                      </Button>
                      <Button onClick={() => updateUserStatus(user._id || user.id, "active")}>Accept</Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[16px] border border-[var(--border-light)] bg-white p-4 text-sm text-[var(--text-soft)]">
                  No pending employee account requests.
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-3">
            {managedUsers.map((user) => {
              const uid = user._id || user.id;
              return (
                <Card key={uid} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-base font-medium text-[var(--text-main)]">{user.name}</p>
                      <p className="text-sm text-[var(--text-soft)]">{user.role}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={user.status === "disabled" ? "danger" : user.status === "pending" ? "warning" : "active"}>
                        {user.status}
                      </StatusPill>
                      {confirmDeleteId === uid ? (
                        <>
                          <span className="text-sm font-medium text-red-600">Delete this user?</span>
                          <Button variant="danger" onClick={() => deleteUser(uid)}>Yes, Delete</Button>
                          <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button variant="danger" onClick={() => setConfirmDeleteId(uid)}>Delete Account</Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && section === "Rooms" ? (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-medium text-[var(--text-main)]">{room.name}</p>
                  <p className="text-sm text-[var(--text-soft)]">Room code {room.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={room.status === "open" ? "active" : "warning"}>{room.status}</StatusPill>
                  <Button variant="secondary" onClick={() => toggleRoomClosed(room)}>
                    {room.status === "closed" ? "Reopen Room" : "Force Close"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </AppScaffold>
  );
}
