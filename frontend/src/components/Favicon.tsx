import { useState } from "react";
import type { Bookmark } from "../types";

interface Props {
  bookmark: Bookmark;
  size?: number;
  className?: string;
}

/** Render a bookmark's favicon with a graceful fallback to a colored initial.
 *
 * For `favicon_source === "library"` with prefix "emoji:", the ref payload
 * after the colon is the actual emoji character — render as text.
 */
export function Favicon({ bookmark, size = 24, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const isEmoji = bookmark.favicon_source === "library" && bookmark.favicon_ref.startsWith("emoji:");
  const url = bookmark.favicon_cached_url;
  const initial = bookmark.title.trim().charAt(0).toUpperCase() || "?";

  if (isEmoji) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.85 }}
      >
        {bookmark.favicon_ref.slice("emoji:".length)}
      </span>
    );
  }

  if (failed || !url) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded text-white font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45, background: hashColor(bookmark.url) }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`rounded ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = [
    "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#f59e0b",
    "#06b6d4", "#ef4444", "#84cc16", "#10b981", "#8b5cf6",
  ];
  return palette[h % palette.length];
}
