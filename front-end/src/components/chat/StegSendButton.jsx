"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { importPublicKey, encryptMessage } from "@/lib/crypto";
import { embedInImage } from "@/lib/steg";

export function StegSendButton({ receiverId, onSend }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | picking | working | error
  const [error, setError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [secretText, setSecretText] = useState("");

  function handleButtonClick() {
    setError(null);
    fileRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingFile(file);
    setSecretText("");
    setShowPrompt(true);
  }

  async function handleSend() {
    if (!secretText.trim()) return;
    setShowPrompt(false);
    setStatus("working");
    try {
      const session = JSON.parse(localStorage.getItem("cyphernet.session") || "{}");
      const token = session.token;

      const res = await fetch(`/users/${receiverId}/public-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch receiver public key");
      const { publicKey: pubBase64 } = await res.json();

      const pubKey = await importPublicKey(pubBase64);
      const ciphertext = await encryptMessage(pubKey, secretText.trim());
      const cipherBytes = new TextEncoder().encode(ciphertext);

      const stegBlob = await embedInImage(pendingFile, cipherBytes);
      setStatus("idle");
      onSend(stegBlob);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={status === "working"}
        title="Send hidden message in image"
        className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[var(--border-light)] bg-white text-[var(--text-soft)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:opacity-50"
      >
        {status === "working" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>

      {status === "error" && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-[18px] border border-[var(--border-light)] bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text-main)]">Hidden message</h3>
            <p className="mb-3 text-xs text-[var(--text-soft)]">
              This message will be encrypted and embedded inside <strong>{pendingFile?.name}</strong>.
            </p>
            <textarea
              autoFocus
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
              placeholder="Type your secret message…"
              rows={4}
              className="w-full resize-none rounded-[14px] border border-[var(--border-light)] bg-slate-50 px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowPrompt(false); setPendingFile(null); }}
                className="rounded-[14px] border border-[var(--border-light)] bg-white px-4 py-2 text-sm text-[var(--text-main)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!secretText.trim()}
                className="rounded-[14px] bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Embed &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
