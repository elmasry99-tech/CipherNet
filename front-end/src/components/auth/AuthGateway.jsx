"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { roles } from "@/features/auth/index";
import { BrandMark } from "@/components/common/BrandMark";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSessionState } from "@/hooks/useSessionState";
import { ROUTES, getDefaultRouteForRole } from "@/lib/routes";
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
  const { signIn, addPendingAccountRequest, setSignupPendingRole, state } = useSessionState();
  const [mode, setMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("internal");
  const visibleRoles = mode === "signup" ? roles.filter((role) => role.id !== "guest" && role.id !== "admin") : roles.filter((role) => role.id !== "admin");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [showOrganizationMenu, setShowOrganizationMenu] = useState(false);
  const [errors, setErrors] = useState({});
  const [formValues, setFormValues] = useState({
    fullName: "",
    organizationName: "",
    jobTitle: "",
    workEmail: "",
    organizationCode: "",
    inviteCode: "CN-INTAKE-2048",
    password: "",
    confirmPassword: "",
    verificationToken: "",
  });
  const filteredOrganizations = state.organizations.filter((organization) =>
    organization.name.toLowerCase().includes(organizationQuery.toLowerCase()),
  );
  const hasMatchingOrganization = state.organizations.some(
    (organization) => organization.name.toLowerCase() === organizationQuery.trim().toLowerCase(),
  );

  function updateValue(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", organizationName: key === "organizationName" ? "" : current.organizationName }));
  }

  function validateForm() {
    const nextErrors = {};

    if (mode === "login") {
      if (selectedRole === "guest") {
        if (!formValues.inviteCode.trim()) nextErrors.inviteCode = "Invite code is required.";
        if (!formValues.verificationToken.trim()) nextErrors.verificationToken = "Verification token is required.";
      } else {
        if (!formValues.workEmail.trim()) nextErrors.workEmail = "Work email is required.";
        if (!formValues.password.trim()) nextErrors.password = "Password is required.";
      }
    }

    if (mode === "signup") {
      if (!formValues.fullName.trim()) nextErrors.fullName = "Full name is required.";
      if ((selectedRole === "oso" || selectedRole === "internal") && !organizationQuery.trim()) {
        nextErrors.organizationName = "Organization name is required.";
      }
      if ((selectedRole === "oso" || selectedRole === "internal") && !hasMatchingOrganization) {
        nextErrors.organizationName = "Select an existing organization from the list.";
      }
      if (!formValues.jobTitle.trim()) nextErrors.jobTitle = "Job title is required.";
      if (!formValues.workEmail.trim()) nextErrors.workEmail = "Work email is required.";
      if (selectedRole === "internal" && !formValues.organizationCode.trim()) {
        nextErrors.organizationCode = "Organization invite code is required.";
      }
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

  function onSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    if (mode === "signup" && (selectedRole === "oso" || selectedRole === "internal") && selectedRole !== "general") {
      addPendingAccountRequest({
        name: formValues.fullName.trim(),
        email: formValues.workEmail.trim(),
        organization: organizationQuery.trim(),
        requestedRole: selectedRole === "oso" ? "Organization Security Officer" : "Internal Employee",
        requestedTitle: formValues.jobTitle.trim(),
      });
      setSignupPendingRole(selectedRole);
      router.push(ROUTES.authPending);
      return;
    }
    signIn(selectedRole);
    router.push(getDefaultRouteForRole(selectedRole));
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--border-dark)] bg-[rgba(11,24,43,0.82)] shadow-[0_28px_90px_rgba(2,6,23,0.38)] backdrop-blur sm:rounded-[26px]">
      <div className="grid min-h-[calc(100vh-4rem)] lg:min-h-[780px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(180deg,#0d1b31,#132741)] p-6 sm:p-8 lg:p-10">
          <div>
            <BrandMark large />
            <div className="mt-6">
              <p className="text-[28px] font-medium leading-tight text-white sm:text-[34px]">CypherNet</p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                Secure communications for organizations that need controlled access,
                role-based oversight, protected files, and real-time collaboration.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Platform-wide tenant oversight and security controls",
              "Organization-level policy, compliance, and room monitoring",
              "Secure internal rooms with messaging, calls, and file sharing",
              "Invite-only guest access with verification and moderated entry",
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
                {mode === "login" ? "Sign In" : "Create Account"}
              </h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              Choose your access role, then continue into the workspace designed for that flow.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>
                Sign In
              </Button>
              <Button
                variant={mode === "signup" ? "primary" : "secondary"}
                onClick={() => {
                  setMode("signup");
                  if (selectedRole === "guest" || selectedRole === "admin") {
                    setSelectedRole("general");
                  }
                  setErrors({});
                }}
              >
                Sign Up
              </Button>
            </div>

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

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {selectedRole === "guest" ? (
                <></>
              ) : (
                <>
                  {mode === "signup" ? (
                    <Field
                      label="Full Name"
                      placeholder="Enter your full name"
                      name="fullName"
                      value={formValues.fullName}
                      onChange={(event) => updateValue("fullName", event.target.value)}
                      error={errors.fullName}
                    />
                  ) : null}
                  {mode === "signup" && (selectedRole === "oso" || selectedRole === "internal") ? (
                    <div className="relative">
                      <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">Organization Name</span>
                      <div className="relative">
                        <input
                          name="organizationName"
                          type="text"
                          value={organizationQuery}
                          onFocus={() => setShowOrganizationMenu(true)}
                          onChange={(event) => {
                            setOrganizationQuery(event.target.value);
                            updateValue("organizationName", event.target.value);
                            setShowOrganizationMenu(true);
                          }}
                          placeholder="Type to search or choose an organization"
                          autoComplete="off"
                          className={cn(
                            "h-12 w-full rounded-[14px] border px-4 pr-10 text-sm text-[var(--text-main)] outline-none",
                            errors.organizationName ? "border-[#bf5460]" : "border-[var(--border-light)]",
                          )}
                        />
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
                      </div>
                      {showOrganizationMenu ? (
                        <div className="absolute z-10 mt-2 max-h-48 w-full overflow-auto rounded-[16px] border border-[var(--border-light)] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                          {filteredOrganizations.length ? (
                            filteredOrganizations.map((organization) => (
                              <button
                                key={organization.slug}
                                type="button"
                                onClick={() => {
                                  setOrganizationQuery(organization.name);
                                  updateValue("organizationName", organization.name);
                                  setShowOrganizationMenu(false);
                                }}
                                className="block w-full rounded-[12px] px-3 py-2 text-left text-sm text-[var(--text-main)] hover:bg-slate-50"
                              >
                                {organization.name}
                              </button>
                            ))
                          ) : (
                            <div className="rounded-[12px] px-3 py-2 text-sm text-[var(--text-soft)]">
                              No matching organizations found.
                            </div>
                          )}
                        </div>
                      ) : null}
                      {errors.organizationName ? (
                        <p className="mt-2 text-sm text-[#bf5460]">{errors.organizationName}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {mode === "signup" ? (
                    <Field
                      label="Job Title"
                      placeholder="Enter your role or title"
                      name="jobTitle"
                      value={formValues.jobTitle}
                      onChange={(event) => updateValue("jobTitle", event.target.value)}
                      error={errors.jobTitle}
                    />
                  ) : null}
                  <Field
                    label="Work Email"
                    type="email"
                    placeholder="name@organization.com"
                    name="workEmail"
                    value={formValues.workEmail}
                    onChange={(event) => updateValue("workEmail", event.target.value)}
                    error={errors.workEmail}
                  />
                </>
              )}

              {mode === "signup" && selectedRole === "internal" ? (
                <Field
                  label="Organization Invite Code"
                  placeholder="Enter your organization code"
                  name="organizationCode"
                  value={formValues.organizationCode}
                  onChange={(event) => updateValue("organizationCode", event.target.value)}
                  error={errors.organizationCode}
                />
              ) : null}

              {selectedRole === "guest" && mode === "login" ? (
                <>
                  <Field
                    label="Invite Code"
                    placeholder="Enter your invite code"
                    name="inviteCode"
                    value={formValues.inviteCode}
                    onChange={(event) => updateValue("inviteCode", event.target.value)}
                    error={errors.inviteCode}
                  />
                  <Field
                    label="Verification Token"
                    type="password"
                    placeholder="Enter your verification token"
                    name="verificationToken"
                    value={formValues.verificationToken}
                    onChange={(event) => updateValue("verificationToken", event.target.value)}
                    error={errors.verificationToken}
                  />
                </>
              ) : (
                <Field
                  label="Password"
                  type="password"
                  placeholder="Enter a secure credential"
                  name="password"
                  value={formValues.password}
                  onChange={(event) => updateValue("password", event.target.value)}
                  error={errors.password}
                />
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

              <Button type="submit" className="h-12 w-full">
                {mode === "login" ? `Continue as ${roleLabel(selectedRole)}` : "Create Account"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role) {
  const match = roles.find((entry) => entry.id === role);
  return match?.short || role;
}
