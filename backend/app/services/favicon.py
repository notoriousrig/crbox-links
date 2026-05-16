"""Favicon resolution.

Two responsibilities:
  1. resolve_favicon(bookmark) -> URL the frontend can <img src="..."> with,
     given the bookmark's favicon_source + favicon_ref.
  2. auto_fetch(url) -> best-effort favicon URL discovered by parsing the
     target page's HTML head and probing /favicon.ico, with fallback to
     Google's s2/favicons service.
"""
from __future__ import annotations

import logging
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.models import Bookmark


log = logging.getLogger(__name__)


_FAVICON_REL = {"icon", "shortcut icon", "apple-touch-icon", "apple-touch-icon-precomposed"}
_TIMEOUT = 6.0
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; crbox-links/0.1)",
    "Accept": "text/html,application/xhtml+xml",
}


def resolve_favicon(b: Bookmark) -> str:
    """Return a URL the frontend can render in <img src="...">."""
    src = b.favicon_source
    ref = b.favicon_ref

    if src == "url" and ref:
        return ref

    if src == "upload" and ref:
        # ref is the bare filename in FAVICON_DIR — served by static mount
        return f"/api/favicons/files/{ref}"

    if src == "library" and ref:
        # ref like "simpleicons:github" or "lucide:folder" or "emoji:🦀"
        return _library_url(ref)

    # auto: use cached URL if we have one
    if b.favicon_cached_url:
        return b.favicon_cached_url

    # ultimate fallback: Google s2 service keyed on the host
    try:
        host = urlparse(b.url).hostname or ""
        if host:
            return f"https://www.google.com/s2/favicons?domain={host}&sz=64"
    except Exception:
        pass
    return ""


def _library_url(ref: str) -> str:
    """Translate library:key into a CDN URL."""
    if ":" not in ref:
        return ""
    lib, key = ref.split(":", 1)
    if lib == "simpleicons":
        return f"https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{key}.svg"
    if lib == "lucide":
        return f"https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{key}.svg"
    if lib == "emoji":
        # The frontend renders these directly as text; backend just echoes.
        return f"data:text/plain;charset=utf-8,{key}"
    return ""


def auto_fetch(url: str) -> str:
    """Best-effort discover the page's favicon URL.

    Strategy:
      1. GET the page (with redirects), parse <link rel="icon"> / apple-touch
      2. Probe <host>/favicon.ico
      3. Return Google s2 fallback
    All paths return an absolute https URL when possible.
    """
    try:
        parsed = urlparse(url)
        if not parsed.scheme:
            url = "https://" + url
            parsed = urlparse(url)
        host = parsed.netloc

        try:
            with httpx.Client(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as cli:
                resp = cli.get(url)
                if resp.status_code < 400 and "html" in resp.headers.get("content-type", ""):
                    final_url = str(resp.url)
                    soup = BeautifulSoup(resp.text, "lxml")
                    best = _pick_best_icon(soup, final_url)
                    if best:
                        return best
        except Exception as exc:
            log.debug("page fetch failed for %s: %s", url, exc)

        # Probe /favicon.ico
        guess = f"{parsed.scheme}://{host}/favicon.ico"
        try:
            with httpx.Client(timeout=_TIMEOUT, headers=_HEADERS) as cli:
                head = cli.head(guess, follow_redirects=True)
                if head.status_code < 400:
                    return guess
        except Exception:
            pass

        return f"https://www.google.com/s2/favicons?domain={host}&sz=64"
    except Exception:
        return ""


def _pick_best_icon(soup: BeautifulSoup, base_url: str) -> str:
    """Pick the highest-resolution declared icon from the parsed head."""
    candidates: list[tuple[int, str]] = []
    for link in soup.find_all("link"):
        rel = link.get("rel") or []
        rel_str = " ".join(r.lower() for r in rel) if isinstance(rel, list) else str(rel).lower()
        if not any(r in rel_str for r in _FAVICON_REL):
            continue
        href = link.get("href")
        if not href:
            continue
        sizes = link.get("sizes", "")
        score = 0
        if isinstance(sizes, str):
            for chunk in sizes.split():
                if "x" in chunk:
                    try:
                        score = max(score, int(chunk.split("x")[0]))
                    except ValueError:
                        pass
        if "apple-touch" in rel_str:
            score = max(score, 180)
        candidates.append((score, urljoin(base_url, href)))
    if not candidates:
        return ""
    candidates.sort(reverse=True)
    return candidates[0][1]


def fetch_title(url: str) -> str:
    """Pull <title> from the page for the add-bookmark form's auto-fill."""
    try:
        if not urlparse(url).scheme:
            url = "https://" + url
        with httpx.Client(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as cli:
            resp = cli.get(url)
            if resp.status_code >= 400:
                return ""
            soup = BeautifulSoup(resp.text, "lxml")
            if soup.title and soup.title.string:
                return soup.title.string.strip()[:500]
    except Exception:
        pass
    return ""
