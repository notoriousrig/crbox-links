import { useEffect, useState } from "react";
import type { FaviconSource } from "../types";

interface Props {
  source: FaviconSource;
  ref_: string;
  url: string; // current preview URL — for re-fetch button
  onChange: (next: { source: FaviconSource; ref: string }) => void;
  onRefetch: () => void;
}

const SOURCES: { key: FaviconSource; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "url", label: "URL" },
  { key: "library", label: "Library" },
  { key: "upload", label: "Upload" },
];

// A small curated subset of simple-icons + lucide for the picker.
// The full simple-icons catalog is 3000+ entries — we'd load it lazily in
// production. This stub is enough to demonstrate the UX.
const LIB_PRESETS = [
  { key: "simpleicons:github", label: "GitHub" },
  { key: "simpleicons:gitlab", label: "GitLab" },
  { key: "simpleicons:google", label: "Google" },
  { key: "simpleicons:youtube", label: "YouTube" },
  { key: "simpleicons:reddit", label: "Reddit" },
  { key: "simpleicons:wikipedia", label: "Wikipedia" },
  { key: "simpleicons:notion", label: "Notion" },
  { key: "simpleicons:openai", label: "OpenAI" },
  { key: "lucide:folder", label: "Folder" },
  { key: "lucide:book-open", label: "Book" },
  { key: "lucide:code", label: "Code" },
  { key: "lucide:music", label: "Music" },
  { key: "lucide:globe", label: "Globe" },
  { key: "lucide:rocket", label: "Rocket" },
  { key: "lucide:home", label: "Home" },
  { key: "lucide:settings", label: "Settings" },
];

const EMOJIS = [
  "🔖", "⭐", "📚", "💻", "🛠", "🎵", "🎬", "📰", "🏠", "🧠",
  "💡", "🔧", "🌐", "📦", "🎮", "🍕", "🐍", "🦀", "📷", "💰",
];

export function FaviconPicker({ source, ref_, url, onChange, onRefetch }: Props) {
  const [tab, setTab] = useState<FaviconSource>(source);
  const [urlInput, setUrlInput] = useState(source === "url" ? ref_ : "");

  useEffect(() => {
    setTab(source);
  }, [source]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
          {ref_.startsWith("emoji:") ? (
            <span className="text-2xl">{ref_.slice(6)}</span>
          ) : url ? (
            <img src={url} alt="" className="w-8 h-8" />
          ) : (
            <span className="text-zinc-400 text-xs">none</span>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 break-all">
          <div className="font-medium uppercase tracking-wide text-[10px] mb-0.5">Current</div>
          <code>{source}{ref_ ? ` · ${ref_}` : ""}</code>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
              tab === s.key
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {tab === "auto" && (
        <div className="text-sm space-y-2">
          <p className="text-zinc-500 dark:text-zinc-400">
            Auto-fetched from the URL: parses {`<link rel="icon">`}, falls back to {`/favicon.ico`} then Google s2.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ source: "auto", ref: "" })}
              className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600"
            >
              Use auto
            </button>
            <button
              type="button"
              onClick={onRefetch}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Re-fetch now
            </button>
          </div>
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/icon.png"
            className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange({ source: "url", ref: urlInput.trim() })}
            disabled={!urlInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50"
          >
            Use this URL
          </button>
        </div>
      )}

      {tab === "library" && (
        <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1.5">Brand logos</div>
            <div className="grid grid-cols-6 gap-1">
              {LIB_PRESETS.filter((p) => p.key.startsWith("simpleicons:")).map((p) => (
                <LibButton key={p.key} k={p.key} label={p.label} onChange={onChange} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1.5">Generic</div>
            <div className="grid grid-cols-6 gap-1">
              {LIB_PRESETS.filter((p) => p.key.startsWith("lucide:")).map((p) => (
                <LibButton key={p.key} k={p.key} label={p.label} onChange={onChange} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1.5">Emoji</div>
            <div className="grid grid-cols-10 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onChange({ source: "library", ref: `emoji:${e}` })}
                  className="aspect-square text-xl rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="text-sm space-y-2">
          <p className="text-zinc-500 dark:text-zinc-400">
            Upload PNG / SVG / ICO, max 512KB. The bookmark must exist first
            (save once, then upload).
          </p>
          <p className="text-xs text-zinc-400">
            Upload is wired through the bookmark's edit modal once the bookmark
            has an id — handled by `api.uploadFavicon(id, file)`.
          </p>
        </div>
      )}
    </div>
  );
}

function LibButton({
  k, label, onChange,
}: { k: string; label: string; onChange: Props["onChange"] }) {
  const [lib, slug] = k.split(":") as ["simpleicons" | "lucide", string];
  const cdn = lib === "simpleicons"
    ? `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`
    : `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${slug}.svg`;
  return (
    <button
      type="button"
      onClick={() => onChange({ source: "library", ref: k })}
      className="aspect-square flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2"
      title={label}
    >
      <img src={cdn} alt={label} className="w-6 h-6 dark:invert" />
    </button>
  );
}
