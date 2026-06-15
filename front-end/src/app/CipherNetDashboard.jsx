import React, { useMemo, useState } from "react";

const roleOptions = [
  { id: "systemAdmin", label: "System Administrator" },
  { id: "orgOfficer", label: "Organization Security Officer" },
  { id: "internalUser", label: "Internal Secure End-User" },
  { id: "guestUser", label: "Guest User" },
];

const dashboardData = {
  systemAdmin: {
    title: "System Administrator Dashboard",
    summary: "Platform-wide administration, monitoring, tenant management, and security defaults.",
    stats: [
      { label: "Organizations", value: 42 },
      { label: "Active Rooms", value: 128 },
      { label: "Open Incidents", value: 3 },
      { label: "Announcements", value: 2 },
    ],
    actions: [
      "Create organization",
      "Suspend organization",
      "Reactivate organization",
      "Rotate integration credentials",
      "Update global security defaults",
      "Configure rate limits",
      "Send system announcement",
    ],
    tables: {
      organizations: [
        { id: "ORG-1001", name: "Northwind Legal", status: "Active", tier: "Enterprise", adminEmail: "admin@northwind.com" },
        { id: "ORG-1002", name: "Apex HR", status: "Suspended", tier: "Business", adminEmail: "security@apexhr.com" },
        { id: "ORG-1003", name: "Helix Health", status: "Active", tier: "Enterprise", adminEmail: "ops@helixhealth.com" },
      ],
      incidents: [
        { id: "INC-01", type: "Service Health", severity: "High", status: "Investigating" },
        { id: "INC-02", type: "Rate Limit Spike", severity: "Medium", status: "Open" },
        { id: "INC-03", type: "Suspicious Login Pattern", severity: "High", status: "Escalated" },
      ],
      auditLogs: [
        { time: "10:12", actor: "sysadmin@ciphernet.com", action: "Created organization", target: "Northwind Legal" },
        { time: "10:44", actor: "sysadmin@ciphernet.com", action: "Updated global policy", target: "MFA Required" },
        { time: "11:03", actor: "sysadmin@ciphernet.com", action: "Sent announcement", target: "Scheduled maintenance" },
      ],
    },
  },
  orgOfficer: {
    title: "Organization Security Officer Dashboard",
    summary: "Tenant-level compliance, user approvals, room oversight, and policy configuration.",
    stats: [
      { label: "Pending Approvals", value: 7 },
      { label: "Active Rooms", value: 19 },
      { label: "Policy Violations", value: 2 },
      { label: "Exports Today", value: 4 },
    ],
    actions: [
      "Approve member",
      "Deny member",
      "Update org policies",
      "Set retention rules",
      "Force re-verification",
      "Disable user",
      "Force-close room",
      "Export compliance report",
    ],
    tables: {
      approvals: [
        { id: "USR-201", name: "Huda Salem", email: "huda@northwind.com", department: "Legal", status: "Pending" },
        { id: "USR-202", name: "Rami Noor", email: "rami@northwind.com", department: "HR", status: "Pending" },
        { id: "USR-203", name: "Maya Adel", email: "maya@northwind.com", department: "Compliance", status: "Pending" },
      ],
      activeRooms: [
        { id: "ROOM-81", name: "Client Intake A", owner: "Ahmad", guests: 1, locked: false, status: "Active" },
        { id: "ROOM-82", name: "HR Review", owner: "Sarah", guests: 0, locked: true, status: "Active" },
        { id: "ROOM-83", name: "Legal Escalation", owner: "Omar", guests: 2, locked: false, status: "Flagged" },
      ],
      activityLogs: [
        { time: "09:20", event: "Login", actor: "ahmad@northwind.com", room: "-" },
        { time: "09:32", event: "Room Join", actor: "fatima.guest", room: "Client Intake A" },
        { time: "09:41", event: "File Upload", actor: "fatima.guest", room: "Client Intake A" },
      ],
    },
  },
  internalUser: {
    title: "Internal Secure End-User Dashboard",
    summary: "Secure rooms, calls, chat, file sharing, activity, and room-owner controls.",
    stats: [
      { label: "My Rooms", value: 5 },
      { label: "Unread Messages", value: 14 },
      { label: "Pending Guests", value: 2 },
      { label: "Shared Files", value: 9 },
    ],
    actions: [
      "Create room",
      "Join room",
      "Start call",
      "Send message",
      "Share file",
      "Enable Cipher Expert Mode",
      "Admit guest",
      "Export my activity",
    ],
    tables: {
      myRooms: [
        { id: "ROOM-81", name: "Client Intake A", type: "Intake", participants: 3, status: "Active" },
        { id: "ROOM-84", name: "Case Review", type: "Group", participants: 5, status: "Active" },
        { id: "ROOM-91", name: "1:1 with Omar", type: "Direct", participants: 2, status: "Ended" },
      ],
      pendingGuests: [
        { id: "GST-01", name: "Fatima", room: "Client Intake A", verification: "Verified", status: "Waiting" },
        { id: "GST-02", name: "Yousef", room: "Case Review", verification: "Pending", status: "Waiting" },
      ],
      recentActivity: [
        { time: "10:05", event: "Room Created", detail: "Client Intake A" },
        { time: "10:09", event: "Cipher Expert Mode Used", detail: "Image payload sent" },
        { time: "10:16", event: "Call Started", detail: "Client Intake A" },
      ],
    },
  },
  guestUser: {
    title: "Guest Dashboard",
    summary: "Invite-based access, lobby waiting, room participation, uploads, and temporary session state.",
    stats: [
      { label: "Invite Status", value: "Valid" },
      { label: "Lobby Position", value: 1 },
      { label: "Uploads", value: 2 },
      { label: "Session State", value: "Waiting" },
    ],
    actions: [
      "Enter invite code",
      "Complete verification",
      "Create temporary profile",
      "Wait in lobby",
      "Join call",
      "Send message",
      "Upload documents",
      "Leave session",
    ],
    tables: {
      sessionInfo: [
        { field: "Room", value: "Client Intake A" },
        { field: "Host", value: "Ahmad" },
        { field: "Verification", value: "Completed" },
        { field: "Access", value: "Room-only" },
      ],
      uploads: [
        { id: "UP-1", file: "national-id.jpg", status: "Uploaded" },
        { id: "UP-2", file: "incident-photo.png", status: "Uploaded" },
      ],
      notices: [
        { message: "You cannot browse organization directories." },
        { message: "Your access is temporary and ends automatically when the session closes." },
        { message: "Files and messages are only visible inside this room." },
      ],
    },
  },
};

function StatList({ stats }) {
  return (
    <section>
      <h2>Overview</h2>
      <ul>
        {stats.map((stat) => (
          <li key={stat.label}>
            <strong>{stat.label}:</strong> {String(stat.value)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionPanel({ actions, onRunAction }) {
  return (
    <section>
      <h2>Quick Actions</h2>
      <div>
        {actions.map((action) => (
          <button key={action} type="button" onClick={() => onRunAction(action)}>
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function DataTable({ title, rows }) {
  if (!rows || rows.length === 0) {
    return null;
  }

  const columns = Object.keys(rows[0]);

  return (
    <section>
      <h2>{title}</h2>
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || `${title}-${rowIndex}`}>
              {columns.map((column) => (
                <td key={`${row.id || rowIndex}-${column}`}>{String(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Filters({ query, onQueryChange, sessionStateFilter, onSessionStateFilterChange }) {
  return (
    <section>
      <h2>Filters</h2>
      <div>
        <label>
          Search:{" "}
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search dashboard data"
          />
        </label>
      </div>
      <div>
        <label>
          Status filter:{" "}
          <select value={sessionStateFilter} onChange={(e) => onSessionStateFilterChange(e.target.value)}>
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Waiting">Waiting</option>
            <option value="Flagged">Flagged</option>
            <option value="Suspended">Suspended</option>
            <option value="Ended">Ended</option>
            <option value="Uploaded">Uploaded</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function applyFilters(rows, query, sessionStateFilter) {
  return rows.filter((row) => {
    const text = Object.values(row).join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesStatus =
      sessionStateFilter === "all" ||
      Object.values(row).some((value) => String(value) === sessionStateFilter);

    return matchesQuery && matchesStatus;
  });
}

export default function CipherNetDashboard() {
  const [selectedRole, setSelectedRole] = useState("systemAdmin");
  const [query, setQuery] = useState("");
  const [sessionStateFilter, setSessionStateFilter] = useState("all");
  const [notifications, setNotifications] = useState([
    "Welcome to the CipherNet dashboard.",
    "This is the dashboard layer only. Authentication is intentionally excluded.",
  ]);
  const [announcement, setAnnouncement] = useState("");

  const currentDashboard = dashboardData[selectedRole];

  const filteredTables = useMemo(() => {
    return Object.fromEntries(
      Object.entries(currentDashboard.tables).map(([key, rows]) => [
        key,
        applyFilters(rows, query, sessionStateFilter),
      ])
    );
  }, [currentDashboard, query, sessionStateFilter]);

  const handleRunAction = (action) => {
    const timestamp = new Date().toLocaleTimeString();

    if (action === "Send system announcement") {
      if (!announcement.trim()) {
        setNotifications((prev) => [`${timestamp}: Announcement cannot be empty.`, ...prev]);
        return;
      }

      setNotifications((prev) => [`${timestamp}: Announcement sent: ${announcement}`, ...prev]);
      setAnnouncement("");
      return;
    }

    setNotifications((prev) => [`${timestamp}: Action executed -> ${action}`, ...prev]);
  };

  return (
    <main>
      <header>
        <h1>CipherNet Dashboard</h1>
        <p>{currentDashboard.summary}</p>
      </header>

      <section>
        <h2>Dashboard Role</h2>
        <label>
          View as:{" "}
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2>Current Dashboard</h2>
        <p>
          <strong>{currentDashboard.title}</strong>
        </p>
      </section>

      <Filters
        query={query}
        onQueryChange={setQuery}
        sessionStateFilter={sessionStateFilter}
        onSessionStateFilterChange={setSessionStateFilter}
      />

      <StatList stats={currentDashboard.stats} />

      <ActionPanel actions={currentDashboard.actions} onRunAction={handleRunAction} />

      {selectedRole === "systemAdmin" && (
        <section>
          <h2>Announcement Composer</h2>
          <textarea
            rows="4"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Write a maintenance or security announcement"
          />
          <div>
            <button type="button" onClick={() => handleRunAction("Send system announcement")}>
              Publish Announcement
            </button>
          </div>
        </section>
      )}

      {selectedRole === "guestUser" && (
        <section>
          <h2>Guest Session State</h2>
          <p>
            Guests should only see room-scoped information and should lose access automatically when the session ends.
          </p>
          <button type="button" onClick={() => handleRunAction("Join call")}>Join Call</button>
          <button type="button" onClick={() => handleRunAction("Upload documents")}>Upload Documents</button>
          <button type="button" onClick={() => handleRunAction("Leave session")}>Leave Session</button>
        </section>
      )}

      {Object.entries(filteredTables).map(([key, rows]) => (
        <DataTable key={key} title={key} rows={rows} />
      ))}

      <section>
        <h2>Notifications</h2>
        <ul>
          {notifications.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
