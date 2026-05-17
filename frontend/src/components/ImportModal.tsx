import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Wrench, X } from "lucide-react";

import { api } from "../api";
import type { ImportResult } from "../types";
import { useEscape } from "../hooks/useEscape";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Kind = "netscape" | "booky" | "url-zip";

const KINDS: { key: Kind; label: string; desc: string; accept: string }[] = [
  {
    key: "netscape",
    label: "Netscape HTML (Chrome / Edge / Firefox / Safari)",
    desc: "Standard browser bookmarks export.",
    accept: ".html,.htm",
  },
  {
    key: "booky",
    label: "booky.io JSON",
    desc: "The native booky.io export.",
    accept: ".json",
  },
  {
    key: "url-zip",
    label: "ZIP of Windows .url files",
    desc: "Each .url file becomes a bookmark; folder name becomes the category.",
    accept: ".zip",
  },
];

export function ImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("netscape");
  const [result, setResult] = useState<ImportResult | null>(null);

  const mut = useMutation({
    mutationFn: async (file: File) => api.importFile(kind, file),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const warm = useMutation({
    mutationFn: () => api.warmFaviconCache(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const fix = useMutation({
    mutationFn: () => api.fixUrls(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  useEscape(open, onClose);

  if (!open) return null;

  const current = KINDS.find((k) => k.key === kind)!;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-modal p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import bookmarks</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {KINDS.map((k) => (
            <label key={k.key} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={k.key}
                checked={kind === k.key}
                onChange={() => { setKind(k.key); setResult(null); }}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium">{k.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{k.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-4">
          <input
            type="file"
            accept={current.accept}
            disabled={mut.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) mut.mutate(f);
            }}
            className="block w-full text-sm"
          />
        </div>

        {mut.isPending && <p className="text-sm text-zinc-500">Importing…</p>}
        {mut.isError && (
          <p className="text-sm text-red-600">{(mut.error as Error).message}</p>
        )}
        {result && (
          <div className="text-sm rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-3 mt-2">
            ✓ Created <strong>{result.bookmarks_created}</strong> bookmarks
            (across <strong>{result.categories_created}</strong> new categories).
            {result.bookmarks_skipped > 0 && (
              <span> Skipped {result.bookmarks_skipped} duplicates.</span>
            )}
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">{result.errors.length} errors</summary>
                <ul className="mt-1 text-xs space-y-0.5">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Wrench size={14} /> Fix broken URLs
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Add <code>https:</code> prefix to bookmarks with <code>//host/path</code> or scheme-less URLs. Recovers booky.io internal refs by reading the title.
                </div>
              </div>
              <button
                onClick={() => fix.mutate()}
                disabled={fix.isPending}
                className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {fix.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {fix.isPending ? "Fixing…" : "Fix URLs"}
              </button>
            </div>
            {fix.data && (
              <div className="text-xs mt-2">
                <div className="text-green-700 dark:text-green-400">
                  ✓ Fixed {fix.data.fixed} of {fix.data.examined} bookmarks.
                </div>
                {fix.data.samples.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-zinc-500">First {fix.data.samples.length} examples</summary>
                    <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                      {fix.data.samples.map((s) => (
                        <li key={s.id} className="break-all">
                          <span className="text-zinc-400">#{s.id}:</span> {s.before} <span className="text-zinc-400">→</span> {s.after}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {fix.isError && <div className="text-xs text-red-600">{(fix.error as Error).message}</div>}
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Download size={14} /> Cache favicons locally
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Download every bookmark's favicon to <code>data/favicons/auto/</code>. Takes a few minutes for ~2k bookmarks.
                </div>
              </div>
              <button
                onClick={() => warm.mutate()}
                disabled={warm.isPending}
                className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {warm.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {warm.isPending ? "Warming…" : "Warm cache"}
              </button>
            </div>
            {warm.data && (
              <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                ✓ {warm.data.cached_locally} cached locally · {warm.data.remote_only} kept remote ·
                {" "}{warm.data.skipped} skipped (uploads/library)
              </div>
            )}
            {warm.isError && (
              <div className="text-xs text-red-600">{(warm.error as Error).message}</div>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
