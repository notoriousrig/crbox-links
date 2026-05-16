import Fuse, { type FuseResultMatch } from "fuse.js";
import type { Bookmark, Category } from "../types";

export interface SearchHit {
  bookmark: Bookmark;
  score: number;
  matches: readonly FuseResultMatch[] | undefined;
}

export interface ParsedQuery {
  freeText: string;
  tags: string[];
  cats: string[];
  flags: string[];
}

const OP_RE = /\b(tag|cat|is):([^\s]+)/g;

export function parseQuery(input: string): ParsedQuery {
  const tags: string[] = [];
  const cats: string[] = [];
  const flags: string[] = [];
  const free = input
    .replace(OP_RE, (_m, op, val) => {
      const v = val.toLowerCase();
      if (op === "tag") tags.push(v);
      else if (op === "cat") cats.push(v);
      else if (op === "is") flags.push(v);
      return "";
    })
    .trim();
  return { freeText: free, tags, cats, flags };
}

interface SearchRow {
  bookmark: Bookmark;
  catName: string;
  tagNames: string;
}

export function buildIndex(bookmarks: Bookmark[], categories: Category[]): Fuse<SearchRow> {
  const catById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  const rows: SearchRow[] = bookmarks.map((b) => ({
    bookmark: b,
    catName: catById.get(b.category_id) ?? "",
    tagNames: b.tags.map((t) => t.name).join(" "),
  }));
  return new Fuse(rows, {
    keys: [
      { name: "bookmark.title", weight: 0.5 },
      { name: "tagNames", weight: 0.25 },
      { name: "bookmark.url", weight: 0.15 },
      { name: "bookmark.description", weight: 0.05 },
      { name: "bookmark.notes", weight: 0.05 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeMatches: true,
    includeScore: true,
    minMatchCharLength: 1,
  });
}

export function runSearch(
  index: Fuse<SearchRow>,
  bookmarks: Bookmark[],
  categories: Category[],
  query: string,
): SearchHit[] {
  const parsed = parseQuery(query);
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let candidates: SearchHit[];

  if (parsed.freeText) {
    candidates = index.search(parsed.freeText).map((r) => ({
      bookmark: r.item.bookmark,
      score: r.score ?? 0,
      matches: r.matches as readonly FuseResultMatch[] | undefined,
    }));
  } else {
    candidates = bookmarks.map((b) => ({ bookmark: b, score: 0, matches: undefined }));
  }

  if (parsed.tags.length) {
    const need = new Set(parsed.tags);
    candidates = candidates.filter((c) => {
      const names = new Set(c.bookmark.tags.map((t) => t.name.toLowerCase()));
      for (const t of need) if (!names.has(t)) return false;
      return true;
    });
  }
  if (parsed.cats.length) {
    const ids = new Set<number>();
    for (const name of parsed.cats) {
      const id = catByName.get(name);
      if (id !== undefined) ids.add(id);
    }
    candidates = candidates.filter((c) => ids.has(c.bookmark.category_id));
  }
  if (parsed.flags.includes("broken")) {
    candidates = candidates.filter((c) => {
      const s = c.bookmark.last_check_status;
      return s !== null && (s === 0 || s >= 400);
    });
  }
  return candidates;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
