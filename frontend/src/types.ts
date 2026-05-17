export type FaviconSource = "auto" | "url" | "upload" | "library";

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  collapsed: boolean;
  sort_order: number;
  parent_id: number | null;
}

export interface Bookmark {
  id: number;
  category_id: number;
  title: string;
  url: string;
  description: string;
  notes: string;
  favicon_source: FaviconSource;
  favicon_ref: string;
  favicon_cached_url: string;
  sort_order: number;
  click_count: number;
  last_clicked_at: string | null;
  last_check_status: number | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ImportResult {
  source: string;
  categories_created: number;
  bookmarks_created: number;
  bookmarks_skipped: number;
  errors: string[];
}
