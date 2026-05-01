"use client";

import Image from "next/image";
import { Eye } from "lucide-react";

export function StegMessage({ message, onReveal }) {
  return (
    <div className="max-w-full sm:max-w-[460px]">
      <p className="mb-1 px-3 text-xs text-[var(--text-soft)]">{message.author}</p>
      <div className="rounded-[18px] border border-[var(--border-light)] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <Image
          src={message.imageUrl}
          alt="Hidden message carrier"
          width={320}
          height={220}
          className="h-auto max-h-[220px] w-full rounded-[16px] border border-[var(--border-light)] object-cover"
        />
        <button
          type="button"
          onClick={onReveal}
          className="mt-3 flex items-center gap-2 rounded-[14px] border border-[var(--border-light)] bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--accent-strong)] transition hover:bg-slate-100"
        >
          <Eye className="h-4 w-4" />
          Reveal hidden message
        </button>
      </div>
      <p className="mt-1 px-3 text-xs text-[var(--text-muted)]">{message.time}</p>
    </div>
  );
}
