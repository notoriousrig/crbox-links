import { AlertTriangle } from "lucide-react";
import type { Bookmark, Category } from "../types";
import type { SearchHit } from "../lib/search";
import { api } from "../api";
import { Favicon } from "./Favicon";
import { highlightText } from "../lib/highlight";

interface Props {
  hits: SearchHit[];
  categories: Category[];
  query: string;
  onEdit: (b: Bookmark) => void;
}

export function SearchResults({ hits, categories, query, onEdit }: Props) {
  const catById = new Map(categories.map((c) => [c.id, c]));

  if (hits.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400 text-sm">
        No bookmarks match <span className="font-mono">{query}</span>.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {hits.map(({ bookmark }) => {
        const cat = catById.get(bookmark.category_id);
        const broken =
          bookmark.last_check_status !== null &&
          (bookmark.last_check_status === 0 || bookmark.last_check_status >= 400);
        return (
          <div
            key={bookmark.id}
            className="group flex items-center gap-4 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-brand-500/40 hover:shadow-sm"
          >
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => api.clickBookmark(bookmark.id).catch(() => {})}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <Favicon bookmark={bookmark} size={32} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {highlightText(bookmark.title, query)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {highlightText(bookmark.url, query)}
                </div>
              </div>
            </a>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[40%]">
              {broken && <AlertTriangle size={14} className="text-amber-500" />}
              {cat && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {cat.name}
                </span>
              )}
              {bookmark.tags.map((t) => (
                <span
                  key={t.id}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"
                >
                  {t.name}
                </span>
              ))}
              <button
                onClick={() => onEdit(bookmark)}
                className="opacity-0 group-hover:opacity-100 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-0.5"
              >
                Edit
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
