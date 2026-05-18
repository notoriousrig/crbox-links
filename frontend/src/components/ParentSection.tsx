import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Settings as SettingsIcon } from "lucide-react";
import type { Bookmark, Category } from "../types";
import { useUiLock } from "../hooks/useUiLock";
import { CategoryCard } from "./CategoryCard";

interface Props {
  parent: Category;
  childCategories: Category[];
  directBookmarks: Bookmark[];
  bookmarksByCat: Map<number, Bookmark[]>;
  onEditCategory: (c: Category) => void;
  onAddSubcategory: (parentId: number) => void;
  onAddBookmark: (categoryId: number) => void;
  onEditBookmark: (b: Bookmark) => void;
  onToggleCollapse: (c: Category) => void;
  selectedIds: Set<number>;
  selectMode: boolean;
  onToggleSelect: (id: number) => void;
}

export function ParentSection({
  parent,
  childCategories,
  directBookmarks,
  bookmarksByCat,
  onEditCategory,
  onAddSubcategory,
  onAddBookmark,
  onEditBookmark,
  onToggleCollapse,
  selectedIds,
  selectMode,
  onToggleSelect,
}: Props) {
  const { locked } = useUiLock();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `c:${parent.id}`,
    data: { kind: "category", category: parent },
    disabled: locked,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const directCount = directBookmarks.length;
  const totalCount =
    directCount +
    childCategories.reduce((sum, c) => sum + (bookmarksByCat.get(c.id)?.length ?? 0), 0);

  return (
    <section ref={setNodeRef} style={style} id={`cat-${parent.id}`} className="scroll-mt-20">
      <header className="flex items-center gap-2 mb-3 group">
        {!locked && (
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
        )}
        {parent.icon && <span className="text-xl">{parent.icon}</span>}
        <h2 className="text-lg font-semibold tracking-tight">{parent.name}</h2>
        <span className="text-xs text-zinc-400 tabular-nums">
          {childCategories.length} subcategor{childCategories.length === 1 ? "y" : "ies"} · {totalCount} bookmarks
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onAddSubcategory(parent.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
          title="Add subcategory"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => onEditCategory(parent)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
          title="Edit category"
        >
          <SettingsIcon size={14} />
        </button>
      </header>

      <SortableContext
        items={[
          ...(directCount > 0 ? [`c:${parent.id}-direct`] : []),
          ...childCategories.map((c) => `c:${c.id}`),
        ]}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {/* Parent's own bookmarks, if any, as a special "Direct" card */}
          {directCount > 0 && (
            <div className="scroll-mt-20">
              <CategoryCard
                category={{ ...parent, name: `${parent.name} (direct)` }}
                bookmarks={directBookmarks}
                onEditCategory={() => onEditCategory(parent)}
                onAddBookmark={() => onAddBookmark(parent.id)}
                onEditBookmark={onEditBookmark}
                onToggleCollapse={onToggleCollapse}
                selectedIds={selectedIds}
                selectMode={selectMode}
                onToggleSelect={onToggleSelect}
              />
            </div>
          )}
          {childCategories.map((child) => (
            <div key={child.id} id={`cat-${child.id}`} className="scroll-mt-20">
              <CategoryCard
                category={child}
                bookmarks={bookmarksByCat.get(child.id) ?? []}
                onEditCategory={onEditCategory}
                onAddBookmark={onAddBookmark}
                onEditBookmark={onEditBookmark}
                onToggleCollapse={onToggleCollapse}
                selectedIds={selectedIds}
                selectMode={selectMode}
                onToggleSelect={onToggleSelect}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
