import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Lock, Split, Wrench, X } from "lucide-react";

import { api } from "../api";
import { useEscape } from "../hooks/useEscape";
import { useUiLock } from "../hooks/useUiLock";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { locked, setLocked } = useUiLock();

  const split = useMutation({
    mutationFn: () => api.splitNestedCategories(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const fix = useMutation({
    mutationFn: () => api.fixUrls(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const warm = useMutation({
    mutationFn: () => api.warmFaviconCache(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  useEscape(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-modal p-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              UI
            </h3>
            <label className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Lock size={14} /> Lock UI
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Disable all drag-and-drop. Categories and bookmarks stay put. Useful once you've arranged things how you like them.
                </div>
              </div>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                className="h-4 w-4 accent-brand-500 shrink-0"
              />
            </label>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Data maintenance
            </h3>
            <div className="space-y-3">
              <ActionCard
                icon={<Split size={14} />}
                title="Split nested categories"
                description="Convert flat names like AI / General into a real parent → child hierarchy. Idempotent — safe to re-run."
                buttonLabel="Split"
                running={split.isPending}
                onRun={() => split.mutate()}
                error={split.isError ? (split.error as Error).message : null}
                result={
                  split.data && (
                    <>
                      ✓ Created {split.data.parents_created} parents · renamed {split.data.children_renamed} children
                      {split.data.samples.length > 0 && (
                        <details className="mt-1 text-zinc-500">
                          <summary className="cursor-pointer">First {split.data.samples.length} examples</summary>
                          <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                            {split.data.samples.map((s) => (
                              <li key={s.id}>
                                <span className="text-zinc-400">#{s.id}:</span> {s.before}{" "}
                                <span className="text-zinc-400">→</span> {s.after}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )
                }
              />

              <ActionCard
                icon={<Wrench size={14} />}
                title="Fix broken URLs"
                description="Add https: prefix to bookmarks with //host/path or scheme-less URLs. Recovers booky.io internal refs by reading the title."
                buttonLabel="Fix URLs"
                running={fix.isPending}
                onRun={() => fix.mutate()}
                error={fix.isError ? (fix.error as Error).message : null}
                result={
                  fix.data && (
                    <>
                      ✓ Fixed {fix.data.fixed} of {fix.data.examined} bookmarks.
                      {fix.data.samples.length > 0 && (
                        <details className="mt-1 text-zinc-500">
                          <summary className="cursor-pointer">First {fix.data.samples.length} examples</summary>
                          <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                            {fix.data.samples.map((s) => (
                              <li key={s.id} className="break-all">
                                <span className="text-zinc-400">#{s.id}:</span> {s.before}{" "}
                                <span className="text-zinc-400">→</span> {s.after}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )
                }
              />

              <ActionCard
                icon={<Download size={14} />}
                title="Cache favicons locally"
                description="Download every bookmark's favicon to data/favicons/auto/. Takes a few minutes for ~2k bookmarks."
                buttonLabel="Warm cache"
                running={warm.isPending}
                onRun={() => warm.mutate()}
                error={warm.isError ? (warm.error as Error).message : null}
                result={
                  warm.data && (
                    <>
                      ✓ {warm.data.cached_locally} cached locally · {warm.data.remote_only} kept remote ·{" "}
                      {warm.data.skipped} skipped (uploads/library)
                    </>
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  running,
  onRun,
  result,
  error,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  running: boolean;
  onRun: () => void;
  result: React.ReactNode;
  error: string | null;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {icon} {title}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : null}
          {running ? "Running…" : buttonLabel}
        </button>
      </div>
      {result && <div className="text-xs text-green-700 dark:text-green-400 mt-2">{result}</div>}
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}
