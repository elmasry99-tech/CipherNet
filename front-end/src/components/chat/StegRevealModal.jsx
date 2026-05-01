"use client";

import { useEffect, useState } from "react";
import { X, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { decryptMessage, loadPrivateKey } from "@/lib/crypto";
import { extractFromImage } from "@/lib/steg";

export function StegRevealModal({ imageBlob, onClose }) {
  const [state, setState] = useState("loading"); // loading | success | error
  const [plaintext, setPlaintext] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function reveal() {
      try {
        const cipherBytes = await extractFromImage(imageBlob);
        const base64Ciphertext = btoa(String.fromCharCode(...cipherBytes));
        const privKey = await loadPrivateKey();
        const message = await decryptMessage(privKey, base64Ciphertext);
        if (!cancelled) {
          setPlaintext(message);
          setState("success");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setState("error");
        }
      }
    }

    reveal();
    return () => { cancelled = true; };
  }, [imageBlob]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-[18px] border border-[var(--border-light)] bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-main)]">Hidden message</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting and decrypting…
          </div>
        )}

        {state === "success" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
              Decrypted successfully
            </div>
            <div className="rounded-[14px] border border-[var(--border-light)] bg-slate-50 px-3 py-3 text-sm leading-6 text-[var(--text-main)] whitespace-pre-wrap">
              {plaintext}
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-red-500">
              <ShieldAlert className="h-4 w-4" />
              Could not reveal message
            </div>
            <p className="text-xs text-[var(--text-soft)]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-[14px] border border-[var(--border-light)] bg-white py-2 text-sm text-[var(--text-main)] hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
