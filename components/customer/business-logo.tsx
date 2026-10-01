"use client";

import Image from "next/image";
import { useState } from "react";

export function BusinessLogo({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  // Direct image loading avoids a server-side fetch to a business-controlled URL.
  if (url && !failed) return <Image unoptimized src={url} alt={`${name} logo`} width={64} height={64}
    referrerPolicy="no-referrer" onError={() => setFailed(true)}
    className="size-16 shrink-0 rounded-2xl border border-black/10 bg-white object-contain" />;
  return <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">{Array.from(name.trim())[0]?.toUpperCase() ?? "Q"}</span>;
}
