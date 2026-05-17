import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";

import { api } from "../api";
import type { Category } from "../types";
import { useEscape } from "../hooks/useEscape";

interface Props {
  open: boolean;
  onClose: () => void;
  existing: Category | null;
}

export function CategoryModal({ open, onClose, existing }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("gray");

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setIcon(existing?.icon ?? "");
    setColor(existing?.color ?? "gray");
  }, [open, existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (existing) return api.updateCategory(existing.id, { name, icon, color });
      return api.createCategory({ name, icon, color });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (existing) await api.deleteCategory(existing.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onClose();
    },
  });

  useEscape(open, onClose);

  if (!open) return null;

  function canSave() {
    return !save.isPending && !!name.trim();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSave()) save.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-modal p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{existing ? "Edit category" : "New category"}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500">Icon (emoji)</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🔖"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-500">Color</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
            >
              {["gray", "blue", "green", "purple", "pink", "orange", "red", "yellow", "cyan"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            {existing && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${existing.name}" and all its bookmarks?`)) del.mutate();
                }}
                disabled={del.isPending}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave()}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
