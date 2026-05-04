"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { roles } from "@/features/auth/index";
import { BrandMark } from "@/components/common/BrandMark";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSessionState } from "@/hooks/useSessionState";
import { ROUTES, getDefaultRouteForRole, getRoomRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

function Field({ label, type = "text", placeholder, name, value, onChange, error }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn(
          "h-12 w-full rounded-[14px] border px-4 text-sm text-[var(--text-main)] outline-none",
          error ? "border-[#bf5460]" : "border-[var(--border-light)]",
        )}
      />
      {error ? <p className="mt-2 text-sm text-[#bf5460]">{error}</p> : null}
    </label>
  );
}

export function AuthGateway() {
  const router = useRouter();
  const { hydrated, state, login, signup, setSignupPendingRole } = useSessionState();
  const joiningRoomRef = useRef(false);

  useEffect(() => {
    if (hydrated && state.isAuthenticated && !joiningRoomRef.current) {
      router.replace(getDefaultRouteForRole(state.role));
    }
  }, [hydrated, state.isAuthenticated, state.role, router]);
  const [mode, setMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("internal");
  const [organizations, setOrganizations] = useState([]);
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [showOrganizationMenu, setShowOrganizationMenu] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState({
    fullName: "",
    jobTitle: "",
    workEmail: "",
    password: "",
    confirmPassword: "",
    roomCode: "",
  });

  const visibleRoles = useMemo(
    () => roles.filter((role) => role.id !== "admin" && role.id !== "guest"),
    [],
  );

  const filteredOrganizations = useMemo(() => {
    return organizations.filter((organization) =>
      organization.name.toLowerCase().includes(organizationQuery.toLowerCase()),
    );
  }, [organizationQuery, organizations]);

  const selectedOrganization = organizations.find(
    (organization) => organization.name.toLowerCase() === organizationQuery.trim().toLowerCase(),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizations() {
      try {
        const response = await fetch("/orgs/public");
        const data = await response.json();
        if (!cancelled) {
          setOrganizations(data.organizations || []);
        }
      } catch {
        if (!cancelled) {
          setOrganizations([]);
        }
      }
    }

    loadOrganizations();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateValue(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", organizationName: key === "organizationName" ? "" : current.organizationName }));
    setSubmitError("");
    setSuccessMessage("");
  }

  function validateForm() {
    const nextErrors = {};

    if (mode === "login") {
      if (!formValues.workEmail.trim()) nextErrors.workEmail = "Work email is required.";
      if (!formValues.password.trim()) nextErrors.password = "Password is required.";
    }

    if (mode === "guest") {
      if (!formValues.fullName.trim()) nextErrors.fullName = "Name is required.";
      if (!formValues.roomCode.trim()) nextErrors.roomCode = "Room Code is required.";
    }

    if (mode === "signup") {
      if (!formValues.fullName.trim()) nextErrors.fullName = "Full name is required.";
      if ((selectedRole === "oso" || selectedRole === "internal") && !organizationQuery.trim()) {
        nextErrors.organizationName = "Organization name is required.";
      }
      if (!formValues.jobTitle.trim()) nextErrors.jobTitle = "Job title is required.";
      if (!formValues.workEmail.trim()) nextErrors.workEmail = "Work email is required.";
      if (!formValues.password.trim()) {
        nextErrors.password = "Password is required.";
      } else if (formValues.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters.";
      } else if (!/[A-Z]/.test(formValues.password)) {
        nextErrors.password = "Password must include at least one uppercase letter.";
      } else if (!/[^a-zA-Z0-9]/.test(formValues.password)) {
        nextErrors.password = "Password must include at least one special character.";
      }
      if (!formValues.confirmPassword.trim()) nextErrors.confirmPassword = "Confirm password is required.";
      if (formValues.password.trim() && formValues.confirmPassword.trim() && formValues.password !== formValues.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitError("");
    setSuccessMessage("");

    try {
      if (mode === "login") {
        const result = await login({
          email: formValues.workEmail.trim(),
          password: formValues.password,
        });

        router.replace(getDefaultRouteForRole(result.user.role));
        return;
      }

      if (mode === "guest") {
        joiningRoomRef.current = true;
        try {
          const generatedEmail = `guest_${Date.now()}@guest.local`;
          const generatedPassword = `Guest123!${Math.random().toString(36).substring(2, 10)}`;

          await signup({
            name: formValues.fullName.trim(),
            email: generatedEmail,
            password: generatedPassword,
            role: "guest",
          });

          const loginResult = await login({
            email: generatedEmail,
            password: generatedPassword,
          });

          const joinResponse = await fetch("/rooms/join", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${loginResult.token}`,
            },
            body: JSON.stringify({ code: formValues.roomCode.trim() }),
          });

          if (!joinResponse.ok) {
            const errData = await joinResponse.json().catch(() => ({}));
            throw new Error(errData.error || "Invalid room code or room is closed.");
          }

          const joinData = await joinResponse.json();
          router.replace(getRoomRoute(joinData.room.id));
          return;
        } finally {
          joiningRoomRef.current = false;
        }
      }

      const payload = {
        name: formValues.fullName.trim(),
        email: formValues.workEmail.trim(),
        password: formValues.password,
        role: selectedRole,
        orgName: (selectedRole === "oso" || selectedRole === "internal") ? organizationQuery.trim() : undefined,
      };

      const result = await signup(payload);
      if (result.status === "pending") {
        setSignupPendingRole(selectedRole);
        router.replace(ROUTES.authPending);
        return;
      }

      setSuccessMessage("Account created. You can sign in now.");
      setMode("login");
      setFormValues((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    } catch (error) {
      setSubmitError(error.message || "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-[linear-gradient(135deg,#09121d_0%,#0d1b2b_45%,#13263e_100%)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-between px-6 py-8 text-white sm:px-8 lg:px-12">
        <div>
          <BrandMark />
          <div className="mt-12 max-w-[520px]">
            <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              Protected Collaboration
            </p>
            <h2 className="mt-6 text-4xl font-medium leading-tight sm:text-5xl">
              Real-time rooms, secure messaging, and controlled access from one gateway.
            </h2>
            <p className="mt-5 max-w-[440px] text-sm leading-7 text-slate-300 sm:text-base">
              Sign in with your issued account or request access to your organization workspace.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            "Encrypted room messaging with audit-aware access controls",
            "Socket-connected collaboration with moderated guest entry",
            "Steganography-ready secure image exchange for approved participants",
          ].map((item) => (
            <div
              key={item}
              className="rounded-[18px] border border-[var(--border-dark)] bg-white/5 p-4 text-sm leading-6 text-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface-light)] p-4 sm:p-6 lg:p-8">
        <Card className="p-5 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2 text-[var(--text-main)]">
            <Lock className="h-5 w-5 text-[var(--accent-strong)]" />
            <h1 className="text-[24px] font-medium">
              {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Join as Guest"}
            </h1>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            Choose your access role, then continue into the workspace designed for that flow.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>
              Sign In
            </Button>
            <Button
              variant={mode === "signup" ? "primary" : "secondary"}
              onClick={() => {
                setMode("signup");
                setErrors({});
                setSubmitError("");
                setSuccessMessage("");
              }}
            >
              Sign Up
            </Button>
            <Button variant={mode === "guest" ? "primary" : "secondary"} onClick={() => setMode("guest")}>
              Join as Guest
            </Button>
          </div>

          {mode === "signup" && (
            <div className="mt-6 space-y-3">
              {visibleRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "w-full rounded-[18px] border p-4 text-left transition",
                  selectedRole === role.id
                    ? "border-[rgba(23,147,170,0.38)] bg-[rgba(60,195,214,0.08)] shadow-[0_10px_24px_rgba(23,147,170,0.12)]"
                    : "border-[var(--border-light)] bg-white hover:border-[rgba(23,147,170,0.24)]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-main)]">{role.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{role.description}</p>
                  </div>
                  <span
                    className={cn(
                      "mt-1 h-4 w-4 rounded-full border",
                      selectedRole === role.id
                        ? "border-[var(--accent-strong)] bg-[var(--accent-strong)]"
                        : "border-slate-300 bg-white",
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {mode === "signup" || mode === "guest" ? (
              <Field
                label={mode === "guest" ? "Your Name" : "Full Name"}
                placeholder={mode === "guest" ? "Enter your name" : "Enter your full name"}
                name="fullName"
                value={formValues.fullName}
                onChange={(event) => updateValue("fullName", event.target.value)}
                error={errors.fullName}
              />
            ) : null}

            {mode === "guest" ? (
              <Field
                label="Room Code"
                placeholder="e.g. CN-A1B2C3"
                name="roomCode"
                value={formValues.roomCode}
                onChange={(event) => updateValue("roomCode", event.target.value)}
                error={errors.roomCode}
              />
            ) : null}

            {mode === "signup" && (selectedRole === "oso" || selectedRole === "internal") ? (
              <Field
                label="Organization Name"
                placeholder="Enter your organization name"
                name="organizationName"
                value={organizationQuery}
                onChange={(event) => {
                  setOrganizationQuery(event.target.value);
                  setErrors((current) => ({ ...current, organizationName: "" }));
                }}
                error={errors.organizationName}
              />
            ) : null}

            {mode === "signup" ? (
              <Field
                label="Job Title"
                placeholder="Enter your title"
                name="jobTitle"
                value={formValues.jobTitle}
                onChange={(event) => updateValue("jobTitle", event.target.value)}
                error={errors.jobTitle}
              />
            ) : null}

            {mode !== "guest" && (
              <>
                <Field
                  label="Work Email"
                  type="email"
                  placeholder="name@organization.com"
                  name="workEmail"
                  value={formValues.workEmail}
                  onChange={(event) => updateValue("workEmail", event.target.value)}
                  error={errors.workEmail}
                />

                <Field
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  name="password"
                  value={formValues.password}
                  onChange={(event) => updateValue("password", event.target.value)}
                  error={errors.password}
                />
              </>
            )}

            {mode === "signup" ? (
              <Field
                label="Confirm Password"
                type="password"
                placeholder="Confirm your password"
                name="confirmPassword"
                value={formValues.confirmPassword}
                onChange={(event) => updateValue("confirmPassword", event.target.value)}
                error={errors.confirmPassword}
              />
            ) : null}

            {submitError ? <p className="text-sm text-[#bf5460]">{submitError}</p> : null}
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Enter Workspace" : "Submit Request"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
