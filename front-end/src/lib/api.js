"use client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://cyphernet-backend.onrender.com";

export function getBackendUrl() {
  return BACKEND_URL;
}

export function buildBackendUrl(path) {
  return `/api${path}`;
}

export async function readJsonResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error || data?.message || "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(fileOrBlob);
  });
}

export function formatTimestamp(value) {
  if (!value) return "Now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
