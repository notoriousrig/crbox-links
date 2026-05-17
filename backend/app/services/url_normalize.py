"""Normalize bookmark URLs that came in malformed.

The main offenders are protocol-relative (`//host/path`) and scheme-less
(`host.tld/path`) refs from old browser exports. booky.io exports also
contain internal refs like `//Perplexity` where the visible text holds the
real domain — we try to recover those by reading the title.

Cases:
  - "https://..." / "http://..." / "ftp://..." / "javascript:" / "mailto:"
    / "tel:" / "data:" → unchanged
  - "//host.tld/path"  → "https://host.tld/path"
  - "//word"  (no dot, looks like booky internal ref)
      - if title parses as a hostname (has a dot, no spaces) → "https://<title>"
      - else                                                 → "https://word"
  - "host.tld/path" (no scheme)  → "https://host.tld/path"
  - otherwise unchanged
"""
from __future__ import annotations

import re

_KEEP_SCHEMES = ("javascript:", "mailto:", "tel:", "data:", "file:", "about:", "chrome:")
_TITLE_HOST_RE = re.compile(r"^[A-Za-z0-9.\-]+\.[A-Za-z]{2,}(?:/.*)?$")


def normalize_url(url: str, title: str = "") -> str:
    url = (url or "").strip()
    if not url:
        return url
    # Already has a scheme like "https://" — leave alone
    if "://" in url[:12]:
        return url
    lower = url.lower()
    if lower.startswith(_KEEP_SCHEMES):
        return url

    if url.startswith("//"):
        first = url[2:].split("/", 1)[0]
        if "." in first:
            # Genuine protocol-relative URL — just prefix the scheme
            return "https:" + url
        # Internal ref like "//Perplexity" — try the title
        t = (title or "").strip()
        if t and _TITLE_HOST_RE.match(t):
            return "https://" + t
        # Last resort: prefix as-is (will likely 404 but at least parseable)
        return "https:" + url

    # No scheme, no leading slashes. "example.com/foo" or "javascript:..."
    first = url.split("/", 1)[0]
    if "." in first and " " not in first:
        return "https://" + url
    return url
