import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { Bookmark as BookmarkIcon, Download, FolderPlus, Plus, Settings, Upload } from "lucide-react";

import { api } from "./api";
import type { Bookmark, Category } from "./types";
import { buildIndex, runSearch } from "./lib/search";

import { CategoryCard } from "./components/CategoryCard";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { BookmarkModal } from "./components/BookmarkModal";
import { CategoryModal } from "./components/CategoryModal";
import { ImportModal } from "./components/ImportModal";
import { CommandPalette } from "./components/CommandPalette";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  const qc = useQueryClient();
  const { data: bookmarks = [] } = useQuery({ queryKey: ["bookmarks"], queryFn: api.listBookmarks });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: api.listCategories });
  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: api.listTags });

  const [query, setQuery] = useState("");
  const [bookmarkModal, setBookmarkModal] = useState<{
    open: boolean;
    existing: Bookmark | null;
    defaultCategoryId: number | null;
    prefillUrl?: string;
    prefillTitle?: string;
  }>({ open: false, existing: null, defaultCategoryId: null });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; existing: Category | null }>({
    open: false,
    existing: null,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // PWA share-target intake: ?share=1&url=...&title=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share") === "1") {
      const u = params.get("url") || params.get("text") || "";
      const t = params.get("title") || "";
      if (u) {
        setBookmarkModal({
          open: true,
          existing: null,
          defaultCategoryId: categories[0]?.id ?? null,
          prefillUrl: u,
          prefillTitle: t,
        });
        // Clean the URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [categories]);

  // ⌘K palette
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "n" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
        e.preventDefault();
        setBookmarkModal({ open: true, existing: null, defaultCategoryId: categories[0]?.id ?? null });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [categories]);

  const fuseIndex = useMemo(() => buildIndex(bookmarks, categories), [bookmarks, categories]);
  const hits = useMemo(() => {
    if (!query.trim()) return null;
    return runSearch(fuseIndex, bookmarks, categories, query);
  }, [fuseIndex, bookmarks, categories, query]);

  const bookmarksByCat = useMemo(() => {
    const map = new Map<number, Bookmark[]>();
    for (const b of bookmarks) {
      if (!map.has(b.category_id)) map.set(b.category_id, []);
      map.get(b.category_id)!.push(b);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [bookmarks]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const reorderCats = useMutation({
    mutationFn: api.reorderCategories,
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ["categories"] });
      const previous = qc.getQueryData<Category[]>(["categories"]);
      qc.setQueryData<Category[]>(["categories"], (old) => {
        if (!old) return old;
        const byId = new Map(items.map((i) => [i.id, i.sort_order]));
        return [...old]
          .map((c) => (byId.has(c.id) ? { ...c, sort_order: byId.get(c.id)! } : c))
          .sort((a, b) => a.sort_order - b.sort_order);
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["categories"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const reorderBms = useMutation({
    mutationFn: api.reorderBookmarks,
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ["bookmarks"] });
      const previous = qc.getQueryData<Bookmark[]>(["bookmarks"]);
      qc.setQueryData<Bookmark[]>(["bookmarks"], (old) => {
        if (!old) return old;
        const byId = new Map(items.map((i) => [i.id, i]));
        return old.map((b) => {
          const change = byId.get(b.id);
          if (!change) return b;
          return {
            ...b,
            sort_order: change.sort_order,
            category_id: change.category_id ?? b.category_id,
          };
        });
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["bookmarks"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("c:") && overId.startsWith("c:")) {
      const oldIndex = categories.findIndex((c) => `c:${c.id}` === activeId);
      const newIndex = categories.findIndex((c) => `c:${c.id}` === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(categories, oldIndex, newIndex);
      const items = reordered.map((c, i) => ({ id: c.id, sort_order: (i + 1) * 100 }));
      reorderCats.mutate(items);
      return;
    }

    if (activeId.startsWith("b:") && overId.startsWith("b:")) {
      const activeBm = bookmarks.find((b) => `b:${b.id}` === activeId);
      const overBm = bookmarks.find((b) => `b:${b.id}` === overId);
      if (!activeBm || !overBm) return;
      const targetCatId = overBm.category_id;

      // Build the new order for the destination category
      const destBookmarks =
        (bookmarksByCat.get(targetCatId) || []).filter((b) => b.id !== activeBm.id);
      const overIdx = destBookmarks.findIndex((b) => b.id === overBm.id);
      destBookmarks.splice(overIdx, 0, { ...activeBm, category_id: targetCatId });

      const items = destBookmarks.map((b, i) => ({
        id: b.id,
        sort_order: (i + 1) * 100,
        category_id: targetCatId,
      }));
      reorderBms.mutate(items);
      return;
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleCollapse(c: Category) {
    await api.updateCategory(c.id, { collapsed: !c.collapsed });
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  const bulkDelete = useMutation({
    mutationFn: () => api.bulkUpdate({ bookmark_ids: [...selectedIds], delete: true }),
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectMode(false);
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BookmarkIcon size={20} className="text-brand-500" />
          <h1 className="font-semibold text-lg">links</h1>
          <div className="flex-1 max-w-2xl mx-auto">
            <SearchBar
              value={query}
              onChange={setQuery}
              totalCount={bookmarks.length}
              matchCount={hits ? hits.length : null}
            />
          </div>
          <button
            onClick={() => setBookmarkModal({ open: true, existing: null, defaultCategoryId: categories[0]?.id ?? null })}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Add bookmark (n)"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => setCategoryModal({ open: true, existing: null })}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="New category"
          >
            <FolderPlus size={18} />
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Import"
          >
            <Upload size={18} />
          </button>
          <a
            href={api.exportNetscape()}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 inline-flex items-center"
            title="Export Netscape HTML"
          >
            <Download size={18} />
          </a>
          <button
            onClick={() => setSelectMode((v) => !v)}
            className={`p-2 rounded-lg ${
              selectMode
                ? "bg-brand-500 text-white"
                : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
            title="Bulk select"
          >
            <Settings size={18} />
          </button>
          <ThemeToggle />
        </div>

        {selectMode && (
          <div className="bg-brand-500 text-white text-sm">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
              <span className="font-medium">{selectedIds.size} selected</span>
              <button
                disabled={!selectedIds.size}
                onClick={() => bulkDelete.mutate()}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                className="ml-auto px-3 py-1 rounded hover:bg-white/20"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {hits ? (
          <SearchResults
            hits={hits}
            categories={categories}
            query={query}
            onEdit={(b) =>
              setBookmarkModal({ open: true, existing: b, defaultCategoryId: b.category_id })
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={categories.map((c) => `c:${c.id}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categories.map((c) => (
                  <CategoryCard
                    key={c.id}
                    category={c}
                    bookmarks={bookmarksByCat.get(c.id) ?? []}
                    onEditCategory={(cat) => setCategoryModal({ open: true, existing: cat })}
                    onAddBookmark={(catId) =>
                      setBookmarkModal({ open: true, existing: null, defaultCategoryId: catId })
                    }
                    onEditBookmark={(b) =>
                      setBookmarkModal({ open: true, existing: b, defaultCategoryId: b.category_id })
                    }
                    onToggleCollapse={toggleCollapse}
                    selectedIds={selectedIds}
                    selectMode={selectMode}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {categories.length === 0 && (
          <div className="text-center py-24 text-zinc-400">
            <p className="text-lg mb-2">No bookmarks yet.</p>
            <p className="text-sm">
              Add a category and bookmark, or use{" "}
              <button
                onClick={() => setImportOpen(true)}
                className="text-brand-500 hover:underline"
              >
                import
              </button>{" "}
              to bring in an existing set.
            </p>
          </div>
        )}
      </main>

      <BookmarkModal
        open={bookmarkModal.open}
        onClose={() => setBookmarkModal((s) => ({ ...s, open: false }))}
        existing={bookmarkModal.existing}
        defaultCategoryId={bookmarkModal.defaultCategoryId}
        categories={categories}
        tags={tags}
        prefillUrl={bookmarkModal.prefillUrl}
        prefillTitle={bookmarkModal.prefillTitle}
      />
      <CategoryModal
        open={categoryModal.open}
        onClose={() => setCategoryModal((s) => ({ ...s, open: false }))}
        existing={categoryModal.existing}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      {paletteOpen && (
        <CommandPalette
          bookmarks={bookmarks}
          categories={categories}
          onPick={(b) => {
            api.clickBookmark(b.id).catch(() => {});
            window.open(b.url, "_blank", "noopener,noreferrer");
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
