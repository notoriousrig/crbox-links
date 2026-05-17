import { AlertTriangle, Clock, Hash, Layers, Star, TrendingUp, X } from "lucide-react";
import { useMemo } from "react";
import type { Bookmark, Category, Tag } from "../types";
import { parseQuery } from "../lib/search";

interface Props {
  categories: Category[];
  tags: Tag[];
  bookmarks: Bookmark[];
  query: string;
  setQuery: (q: string) => void;
  onScrollToCategory: (categoryId: number) => void;
  onCloseDrawer?: () => void;
}

export function Sidebar({
  categories,
  tags,
  bookmarks,
  query,
  setQuery,
  onScrollToCategory,
  onCloseDrawer,
}: Props) {
  const parsed = useMemo(() => parseQuery(query), [query]);

  const catCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of bookmarks) m.set(b.category_id, (m.get(b.category_id) ?? 0) + 1);
    return m;
  }, [bookmarks]);

  const tagCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of bookmarks) {
      for (const t of b.tags) m.set(t.id, (m.get(t.id) ?? 0) + 1);
    }
    return m;
  }, [bookmarks]);

  const brokenCount = useMemo(
    () =>
      bookmarks.filter(
        (b) => b.last_check_status !== null && (b.last_check_status === 0 || b.last_check_status >= 400),
      ).length,
    [bookmarks],
  );
  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return bookmarks.filter((b) => new Date(b.created_at).getTime() >= cutoff).length;
  }, [bookmarks]);

  const activeCat =
    parsed.freeText === "" && parsed.tags.length === 0 && parsed.flags.length === 0
      ? activeCatId(parsed.cats)
      : null;
  const activeTag =
    parsed.freeText === "" && parsed.cats.length === 0 && parsed.flags.length === 0 && parsed.tags.length === 1
      ? parsed.tags[0]
      : null;
  const activeFlag =
    parsed.freeText === "" && parsed.cats.length === 0 && parsed.tags.length === 0 && parsed.flags.length === 1
      ? parsed.flags[0]
      : null;

  function handleCategoryClick(e: React.MouseEvent, cat: Category) {
    if (e.shiftKey) {
      onScrollToCategory(cat.id);
      onCloseDrawer?.();
      return;
    }
    if (activeCat === cat.id) {
      setQuery("");
    } else {
      setQuery(`cat:#${cat.id}`);
    }
    onCloseDrawer?.();
  }

  function handleTagClick(tag: Tag) {
    const lower = tag.name.toLowerCase();
    if (activeTag === lower) setQuery("");
    else setQuery(`tag:${lower}`);
    onCloseDrawer?.();
  }

  function handleFlagClick(flag: string) {
    if (activeFlag === flag) setQuery("");
    else setQuery(`is:${flag}`);
    onCloseDrawer?.();
  }

  function clearFilter() {
    setQuery("");
    onCloseDrawer?.();
  }

  const hasFilter = activeCat !== null || activeTag !== null || activeFlag !== null;

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-full overflow-y-auto scrollbar-thin">
      <div className="p-3 space-y-5">
        {hasFilter && (
          <button
            onClick={clearFilter}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 hover:bg-brand-500/20 text-xs font-medium"
          >
            <span>Clear filter</span>
            <X size={12} />
          </button>
        )}

        <Section icon={<Layers size={12} />} label="Categories" count={categories.length}>
          {categories.map((c) => {
            const count = catCounts.get(c.id) ?? 0;
            const active = activeCat === c.id;
            return (
              <RailButton
                key={c.id}
                active={active}
                onClick={(e) => handleCategoryClick(e, c)}
                title="Shift-click to scroll instead of filter"
              >
                <span className="truncate flex-1 text-left">
                  {c.icon && <span className="mr-1.5">{c.icon}</span>}
                  {c.name}
                </span>
                <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{count}</span>
              </RailButton>
            );
          })}
        </Section>

        {tags.length > 0 && (
          <Section icon={<Hash size={12} />} label="Tags" count={tags.length}>
            {tags
              .slice()
              .sort((a, b) => (tagCounts.get(b.id) ?? 0) - (tagCounts.get(a.id) ?? 0))
              .map((t) => {
                const count = tagCounts.get(t.id) ?? 0;
                const active = activeTag === t.name.toLowerCase();
                return (
                  <RailButton key={t.id} active={active} onClick={() => handleTagClick(t)}>
                    <span className="truncate flex-1 text-left">{t.name}</span>
                    <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{count}</span>
                  </RailButton>
                );
              })}
          </Section>
        )}

        <Section icon={<Star size={12} />} label="Smart filters" count={null}>
          <RailButton active={activeFlag === "recent"} onClick={() => handleFlagClick("recent")}>
            <Clock size={12} className="text-zinc-400 shrink-0" />
            <span className="flex-1 text-left">Recent</span>
            <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{recentCount}</span>
          </RailButton>
          <RailButton active={activeFlag === "popular"} onClick={() => handleFlagClick("popular")}>
            <TrendingUp size={12} className="text-zinc-400 shrink-0" />
            <span className="flex-1 text-left">Most clicked</span>
          </RailButton>
          <RailButton active={activeFlag === "broken"} onClick={() => handleFlagClick("broken")}>
            <AlertTriangle size={12} className="text-amber-500 shrink-0" />
            <span className="flex-1 text-left">Broken links</span>
            <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{brokenCount}</span>
          </RailButton>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {icon}
        <span>{label}</span>
        {count !== null && <span className="ml-auto tabular-nums">{count}</span>}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function RailButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs ${
        active
          ? "bg-brand-500/15 text-brand-700 dark:text-brand-300 font-medium"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function activeCatId(cats: string[]): number | null {
  if (cats.length !== 1) return null;
  const c = cats[0];
  if (c.startsWith("#")) {
    const n = Number(c.slice(1));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
