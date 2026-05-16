import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, MoreVertical } from "lucide-react";
import type { Bookmark } from "../types";
import { api } from "../api";
import { Favicon } from "./Favicon";

interface Props {
  bookmark: Bookmark;
  onEdit: (b: Bookmark) => void;
  selected: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
}

export function BookmarkTile({ bookmark, onEdit, selected, selectMode, onToggleSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `b:${bookmark.id}`,
    data: { kind: "bookmark", bookmark },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const broken =
    bookmark.last_check_status !== null &&
    (bookmark.last_check_status === 0 || bookmark.last_check_status >= 400);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                  bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800
                  ${selected ? "ring-2 ring-brand-500" : ""}`}
      {...attributes}
      {...listeners}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0"
        />
      )}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          api.clickBookmark(bookmark.id).catch(() => {});
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Favicon bookmark={bookmark} size={22} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate text-zinc-800 dark:text-zinc-100">
            {bookmark.title}
          </div>
          {bookmark.tags.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {bookmark.tags.slice(0, 4).map((t) => (
                <span
                  key={t.id}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </a>
      {broken && (
        <AlertTriangle
          size={14}
          className="text-amber-500 shrink-0"
          aria-label={`HTTP ${bookmark.last_check_status}`}
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit(bookmark);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
        title="Edit"
      >
        <MoreVertical size={14} />
      </button>
    </div>
  );
}
