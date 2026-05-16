import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Plus, Settings as SettingsIcon } from "lucide-react";
import type { Bookmark, Category } from "../types";
import { BookmarkTile } from "./BookmarkTile";

interface Props {
  category: Category;
  bookmarks: Bookmark[];
  onEditCategory: (c: Category) => void;
  onAddBookmark: (categoryId: number) => void;
  onEditBookmark: (b: Bookmark) => void;
  onToggleCollapse: (c: Category) => void;
  selectedIds: Set<number>;
  selectMode: boolean;
  onToggleSelect: (id: number) => void;
}

export function CategoryCard({
  category,
  bookmarks,
  onEditCategory,
  onAddBookmark,
  onEditBookmark,
  onToggleCollapse,
  selectedIds,
  selectMode,
  onToggleSelect,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `c:${category.id}`,
    data: { kind: "category", category },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const items = bookmarks.map((b) => `b:${b.id}`);

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-tile overflow-hidden"
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => onToggleCollapse(category)}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          {category.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {category.icon && <span className="text-base">{renderIcon(category.icon)}</span>}
          <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-700 dark:text-zinc-300 truncate">
            {category.name}
          </h2>
          <span className="text-xs text-zinc-400 tabular-nums">{bookmarks.length}</span>
        </div>
        <button
          onClick={() => onAddBookmark(category.id)}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          title="Add bookmark to this category"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => onEditCategory(category)}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          title="Edit category"
        >
          <SettingsIcon size={14} />
        </button>
      </header>
      {!category.collapsed && (
        <div className="p-2 space-y-1">
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {bookmarks.map((b) => (
              <BookmarkTile
                key={b.id}
                bookmark={b}
                onEdit={onEditBookmark}
                selected={selectedIds.has(b.id)}
                selectMode={selectMode}
                onToggleSelect={() => onToggleSelect(b.id)}
              />
            ))}
          </SortableContext>
          {bookmarks.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-3">No bookmarks yet</p>
          )}
        </div>
      )}
    </section>
  );
}

function renderIcon(icon: string): string {
  // Stored as raw emoji or library:key — for now we only render emojis here;
  // library icons would be rendered via <img> from CDN inline.
  return icon;
}
