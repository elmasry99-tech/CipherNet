"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Eye, ImagePlus } from "lucide-react";

export function StegMessage({ message, canReveal, onReveal, requestBlob }) {
  const [src, setSrc] = useState(message.imageUrl || "");

  useEffect(() => {
    let cancelled = false;
    if (message.fileId && requestBlob) {
      requestBlob(`/files/${message.fileId}`).then((blob) => {
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [message.fileId, requestBlob]);

  return (
    <div className="max-w-full sm:max-w-[460px]">
      <p className="mb-1 px-3 text-xs text-[var(--text-soft)]">{message.author}</p>
      <div className="rounded-[18px] border border-[var(--border-light)] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-strong)]">
          <ImagePlus className="h-3.5 w-3.5" />
          Steg
        </div>
        {src ? (
          <Image
            src={src}
            alt="Hidden message carrier"
            width={320}
            height={220}
            className="h-auto max-h-[220px] w-full rounded-[16px] border border-[var(--border-light)] object-cover"
          />
        ) : (
          <div className="h-[220px] w-full animate-pulse rounded-[16px] bg-slate-200" />
        )}
        {canReveal && (
          <button
            type="button"
            onClick={onReveal}
            className="mt-3 flex items-center gap-2 rounded-[14px] border border-[var(--border-light)] bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--accent-strong)] transition hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
            Reveal hidden message
          </button>
        )}
      </div>
      <p className="mt-1 px-3 text-xs text-[var(--text-muted)]">{message.time}</p>
    </div>
  );
}
