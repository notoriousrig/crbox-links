import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  totalCount: number;
  matchCount: number | null; // null when query is empty
}

export function SearchBar({ value, onChange, totalCount, matchCount }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape" && ref.current === document.activeElement) {
        onChange("");
        ref.current?.blur();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onChange]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30">
      <Search size={18} className="text-zinc-400 shrink-0" />
      <input
        ref={ref}
        type="text"
        placeholder="Search bookmarks — try `tag:rust` or `is:broken`"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm"
      />
      <div className="text-xs text-zinc-400 shrink-0 tabular-nums">
        {matchCount === null ? `${totalCount} bookmarks` : `${matchCount} results`}
      </div>
      {value && (
        <button
          onClick={() => onChange("")}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
