import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Bookmark, Category } from "../types";

interface Props {
  bookmarks: Bookmark[];
  categories: Category[];
  onPick: (b: Bookmark) => void;
  onClose: () => void;
}

export function CommandPalette({ bookmarks, categories, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const catById = new Map(categories.map((c) => [c.id, c]));

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const matches = q
    ? bookmarks
        .map((b) => ({ b, s: score(b, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
    : bookmarks.slice(0, 8).map((b) => ({ b, s: 0 }));

  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(matches.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === "Enter" && matches[idx]) { e.preventDefault(); onPick(matches[idx].b); onClose(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [matches, idx, onClose, onPick]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24" onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-modal overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search size={18} className="text-zinc-400" />
          <input
            ref={ref}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a bookmark…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">ESC</kbd>
        </div>
        <div className="py-1 max-h-96 overflow-y-auto scrollbar-thin">
          {matches.length === 0 && (
            <p className="text-sm text-zinc-400 px-4 py-3">No matches.</p>
          )}
          {matches.map(({ b }, i) => {
            const cat = catById.get(b.category_id);
            return (
              <button
                key={b.id}
                onClick={() => { onPick(b); onClose(); }}
                onMouseEnter={() => setIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${
                  i === idx ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <span className="text-sm truncate flex-1">{b.title}</span>
                <span className="text-[10px] text-zinc-400">{cat?.name ?? ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function score(b: Bookmark, q: string): number {
  const needle = q.toLowerCase();
  const t = b.title.toLowerCase();
  const u = b.url.toLowerCase();
  let s = 0;
  if (t.startsWith(needle)) s += 100;
  else if (t.includes(needle)) s += 50;
  if (u.includes(needle)) s += 10;
  for (const tag of b.tags) if (tag.name.includes(needle)) s += 20;
  return s;
}
