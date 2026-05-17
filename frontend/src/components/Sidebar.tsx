import { AlertTriangle, ChevronDown, ChevronRight, Clock, Hash, Layers, Star, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  const childrenByParent = useMemo(() => {
    const m = new Map<number, Category[]>();
    for (const c of categories) {
      if (c.parent_id !== null) {
        const arr = m.get(c.parent_id) ?? [];
        arr.push(c);
        m.set(c.parent_id, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [categories]);

  const topLevel = useMemo(
    () => categories.filter((c) => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  // Count bookmarks per category, including descendants
  const totalCounts = useMemo(() => {
    const direct = new Map<number, number>();
    for (const b of bookmarks) direct.set(b.category_id, (direct.get(b.category_id) ?? 0) + 1);

    const total = new Map<number, number>();
    const visit = (cat: Category): number => {
      if (total.has(cat.id)) return total.get(cat.id)!;
      let n = direct.get(cat.id) ?? 0;
      for (const child of childrenByParent.get(cat.id) ?? []) n += visit(child);
      total.set(cat.id, n);
      return n;
    };
    for (const c of categories) visit(c);
    return total;
  }, [bookmarks, categories, childrenByParent]);

  const tagCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of bookmarks) for (const t of b.tags) m.set(t.id, (m.get(t.id) ?? 0) + 1);
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

  // Persisted expand/collapse for parent categories
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("sidebar-expanded");
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-expanded", JSON.stringify([...expanded]));
    } catch {}
  }, [expanded]);

  // Auto-expand ancestors of the active category
  useEffect(() => {
    if (activeCat === null) return;
    const ancestors = new Set<number>();
    let cur = categories.find((c) => c.id === activeCat);
    while (cur && cur.parent_id !== null) {
      ancestors.add(cur.parent_id);
      cur = categories.find((c) => c.id === cur!.parent_id);
    }
    if (ancestors.size > 0) {
      setExpanded((s) => {
        const next = new Set(s);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }, [activeCat, categories]);

  function handleCategoryClick(e: React.MouseEvent, cat: Category) {
    if (e.shiftKey) {
      onScrollToCategory(cat.id);
      onCloseDrawer?.();
      return;
    }
    if (activeCat === cat.id) setQuery("");
    else setQuery(`cat:#${cat.id}`);
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

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilter() {
    setQuery("");
    onCloseDrawer?.();
  }

  const hasFilter = activeCat !== null || activeTag !== null || activeFlag !== null;

  function renderCategoryNode(cat: Category, depth: number): JSX.Element {
    const children = childrenByParent.get(cat.id) ?? [];
    const isExpanded = expanded.has(cat.id);
    const count = totalCounts.get(cat.id) ?? 0;
    const active = activeCat === cat.id;
    return (
      <div key={cat.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
            active
              ? "bg-brand-500/15 text-brand-700 dark:text-brand-300 font-medium"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(cat.id);
              }}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 shrink-0"
            >
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <button
            onClick={(e) => handleCategoryClick(e, cat)}
            title="Shift-click to scroll instead of filter"
            className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
          >
            {cat.icon && <span>{cat.icon}</span>}
            <span className="truncate flex-1">{cat.name}</span>
            <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">{count}</span>
          </button>
        </div>
        {isExpanded && children.length > 0 && (
          <div>{children.map((c) => renderCategoryNode(c, depth + 1))}</div>
        )}
      </div>
    );
  }

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
          {topLevel.map((c) => renderCategoryNode(c, 0))}
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
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
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
