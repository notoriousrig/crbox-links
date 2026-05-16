import type { Bookmark, Category, FaviconSource, ImportResult, Tag } from "./types";

const BASE = "/api";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? ((await res.json()) as T) : ((await res.text()) as unknown as T);
}

export const api = {
  me: () => req<{ email: string }>("/me"),

  listCategories: () => req<Category[]>("/categories"),
  createCategory: (data: Partial<Category>) =>
    req<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: Partial<Category>) =>
    req<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => req<void>(`/categories/${id}`, { method: "DELETE" }),
  reorderCategories: (items: { id: number; sort_order: number }[]) =>
    req<void>("/categories/reorder", { method: "POST", body: JSON.stringify({ items }) }),

  listBookmarks: () => req<Bookmark[]>("/bookmarks"),
  createBookmark: (data: {
    category_id: number;
    title: string;
    url: string;
    description?: string;
    notes?: string;
    favicon_source?: FaviconSource;
    favicon_ref?: string;
    tag_names?: string[];
  }) => req<Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(data) }),
  updateBookmark: (id: number, data: Partial<Bookmark> & { tag_names?: string[] }) =>
    req<Bookmark>(`/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBookmark: (id: number) => req<void>(`/bookmarks/${id}`, { method: "DELETE" }),
  clickBookmark: (id: number) => req<void>(`/bookmarks/${id}/click`, { method: "POST" }),
  refreshFavicon: (id: number) =>
    req<Bookmark>(`/bookmarks/${id}/refresh-favicon`, { method: "POST" }),
  reorderBookmarks: (
    items: { id: number; sort_order: number; category_id?: number }[],
  ) => req<void>("/bookmarks/reorder", { method: "POST", body: JSON.stringify({ items }) }),
  bulkUpdate: (data: {
    bookmark_ids: number[];
    add_tag_names?: string[];
    remove_tag_names?: string[];
    category_id?: number;
    delete?: boolean;
  }) => req<void>("/bookmarks/bulk", { method: "POST", body: JSON.stringify(data) }),

  listTags: () => req<Tag[]>("/tags"),
  createTag: (data: { name: string; color?: string }) =>
    req<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  updateTag: (id: number, data: Partial<Tag>) =>
    req<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTag: (id: number) => req<void>(`/tags/${id}`, { method: "DELETE" }),

  autoFavicon: (url: string) =>
    req<{ url: string }>(`/favicons/auto?url=${encodeURIComponent(url)}`),
  fetchTitle: (url: string) =>
    req<{ title: string }>(`/favicons/title?url=${encodeURIComponent(url)}`),
  warmFaviconCache: () =>
    req<{ total: number; cached_locally: number; remote_only: number; skipped: number }>(
      "/favicons/warm-cache",
      { method: "POST" },
    ),
  uploadFavicon: async (bookmarkId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/favicons/upload/${bookmarkId}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as { favicon_ref: string; url: string };
  },

  importFile: async (
    kind: "netscape" | "booky" | "url-zip",
    file: File,
  ): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/import/${kind}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as ImportResult;
  },

  exportNetscape: () => `${BASE}/export/netscape`,
  exportJson: () => `${BASE}/export/json`,

  getSettings: () => req<Record<string, string>>("/settings"),
  setSetting: (key: string, value: string) =>
    req<{ key: string; value: string }>(`/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
