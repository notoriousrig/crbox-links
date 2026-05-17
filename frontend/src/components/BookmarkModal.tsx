import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, X } from "lucide-react";

import { api } from "../api";
import type { Bookmark, Category, FaviconSource, Tag } from "../types";
import { useEscape } from "../hooks/useEscape";
import { FaviconPicker } from "./FaviconPicker";
import { TagPicker } from "./TagPicker";

interface Props {
  open: boolean;
  onClose: () => void;
  existing: Bookmark | null;
  defaultCategoryId: number | null;
  categories: Category[];
  tags: Tag[];
  prefillUrl?: string;
  prefillTitle?: string;
}

export function BookmarkModal({
  open,
  onClose,
  existing,
  defaultCategoryId,
  categories,
  tags,
  prefillUrl,
  prefillTitle,
}: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [faviconSource, setFaviconSource] = useState<FaviconSource>("auto");
  const [faviconRef, setFaviconRef] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setUrl(existing.url);
      setNotes(existing.notes);
      setCategoryId(existing.category_id);
      setTagNames(existing.tags.map((t) => t.name));
      setFaviconSource(existing.favicon_source);
      setFaviconRef(existing.favicon_ref);
      setPreviewUrl(existing.favicon_cached_url);
    } else {
      setTitle(prefillTitle ?? "");
      setUrl(prefillUrl ?? "");
      setNotes("");
      setCategoryId(defaultCategoryId ?? categories[0]?.id ?? null);
      setTagNames([]);
      setFaviconSource("auto");
      setFaviconRef("");
      setPreviewUrl("");
    }
  }, [open, existing, defaultCategoryId, categories, prefillUrl, prefillTitle]);

  async function autofillFromUrl() {
    if (!url.trim()) return;
    setAutoFilling(true);
    try {
      const [titleResp, faviconResp] = await Promise.all([
        title ? Promise.resolve({ title }) : api.fetchTitle(url),
        api.autoFavicon(url),
      ]);
      if (titleResp.title && !title) setTitle(titleResp.title);
      if (faviconResp.url) setPreviewUrl(faviconResp.url);
    } finally {
      setAutoFilling(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error("Pick a category");
      const payload = {
        category_id: categoryId,
        title: title.trim() || url.trim(),
        url: url.trim(),
        notes,
        favicon_source: faviconSource,
        favicon_ref: faviconRef,
        tag_names: tagNames,
      };
      if (existing) {
        return api.updateBookmark(existing.id, payload);
      }
      return api.createBookmark(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      onClose();
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      await api.deleteBookmark(existing.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onClose();
    },
  });

  useEscape(open, onClose);

  if (!open) return null;

  function canSave() {
    return !save.isPending && !!url.trim() && !!categoryId;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSave()) save.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-modal p-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{existing ? "Edit bookmark" : "Add bookmark"}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="URL">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={autofillFromUrl}
                placeholder="https://..."
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
                autoFocus={!existing}
              />
              <button
                type="button"
                onClick={autofillFromUrl}
                disabled={autoFilling || !url.trim()}
                className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                {autoFilling ? <Loader2 size={14} className="animate-spin" /> : "Auto-fill"}
              </button>
            </div>
          </Field>

          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
          </Field>

          <Field label="Category">
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Tags">
            <TagPicker value={tagNames} onChange={setTagNames} available={tags} />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional. Markdown welcome."
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-brand-500/30 text-sm resize-y"
            />
          </Field>

          <Field label="Favicon">
            <FaviconPicker
              source={faviconSource}
              ref_={faviconRef}
              url={previewUrl}
              onChange={({ source, ref }) => {
                setFaviconSource(source);
                setFaviconRef(ref);
              }}
              onRefetch={async () => {
                if (!url) return;
                const r = await api.autoFavicon(url);
                setPreviewUrl(r.url);
              }}
            />
          </Field>

          {existing && (
            <FileUpload bookmarkId={existing.id} onUploaded={(ref) => {
              setFaviconSource("upload");
              setFaviconRef(ref);
            }} />
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            {existing && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this bookmark?")) del.mutate();
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
              className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave()}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function FileUpload({
  bookmarkId, onUploaded,
}: { bookmarkId: number; onUploaded: (ref: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
        Upload favicon
      </label>
      <input
        type="file"
        accept=".png,.svg,.ico,.jpg,.jpeg,.webp,.gif"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const r = await api.uploadFavicon(bookmarkId, f);
            onUploaded(r.favicon_ref);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
        className="block text-sm w-full"
      />
    </div>
  );
}
