import { Fragment, type ReactNode } from "react";
import { escapeRegex, parseQuery } from "./search";

export function highlightText(text: string, query: string): ReactNode {
  const cleaned = parseQuery(query).freeText.trim();
  if (!cleaned) return text;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return text;
  const re = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark
        key={i}
        className="bg-yellow-200/60 dark:bg-yellow-400/30 text-inherit rounded px-0.5"
      >
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}
