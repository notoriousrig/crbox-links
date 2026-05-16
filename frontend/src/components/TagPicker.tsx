import { X } from "lucide-react";
import { useState } from "react";
import type { Tag } from "../types";

interface Props {
  value: string[]; // tag names
  onChange: (names: string[]) => void;
  available: Tag[];
}

export function TagPicker({ value, onChange, available }: Props) {
  const [input, setInput] = useState("");
  const suggestions = input
    ? available
        .filter(
          (t) =>
            t.name.includes(input.toLowerCase()) && !value.includes(t.name),
        )
        .slice(0, 6)
    : [];

  function add(name: string) {
    const clean = name.trim().toLowerCase().slice(0, 80);
    if (!clean) return;
    if (value.includes(clean)) return;
    onChange([...value, clean]);
    setInput("");
  }

  function remove(name: string) {
    onChange(value.filter((n) => n !== name));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            {name}
            <button
              type="button"
              onClick={() => remove(name)}
              className="text-brand-600/60 hover:text-brand-600"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Type a tag and press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg z-10">
            {suggestions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.name)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
