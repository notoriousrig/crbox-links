"""Favicon resolution + local caching.

Responsibilities:
  1. resolve_favicon(bookmark) -> URL the frontend can <img src="..."> with.
     Prefers a locally cached copy when available.
  2. auto_fetch(url) -> discover favicon URL from a target page (parse <link
     rel="icon">, probe /favicon.ico, fall back to Google s2). The discovered
     URL is then downloaded via fetch_and_cache() so the bytes live on disk.
  3. fetch_and_cache(url) -> download to <favicon_dir>/auto/<sha1>.<ext>,
     return the /api/favicons/files/auto/... path. Dedupes by content hash.
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.models import Bookmark


log = logging.getLogger(__name__)


_FAVICON_REL = {"icon", "shortcut icon", "apple-touch-icon", "apple-touch-icon-precomposed"}
_TIMEOUT = 8.0
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; crbox-links/0.1)",
    "Accept": "text/html,application/xhtml+xml",
}
_MAX_FAVICON_BYTES = 512 * 1024  # 512KB — same cap as user uploads


def resolve_favicon(b: Bookmark) -> str:
    """Return a URL the frontend can render in <img src="...">."""
    src = b.favicon_source
    ref = b.favicon_ref

    if src == "upload" and ref:
        return f"/api/favicons/files/{ref}"

    if src == "library" and ref:
        return _library_url(ref)

    # For "auto" and "url" sources, prefer the locally cached path
    if b.favicon_cached_url:
        return b.favicon_cached_url

    # Cache wasn't populated — fall back to the original URL for "url" source
    if src == "url" and ref:
        return ref

    # Ultimate fallback: Google s2 service keyed on the host
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
    """Discover and locally cache the favicon for the given page URL.

    Returns a path like `/api/favicons/files/auto/<sha1>.<ext>` when the
    download succeeds. Falls back to returning the discovered remote URL or
    a Google s2 URL if local caching fails.
    """
    discovered = _discover_favicon_url(url)
    if not discovered:
        return ""
    cached = fetch_and_cache(discovered)
    return cached or discovered


def _discover_favicon_url(url: str) -> str:
    """Page-side discovery only — no caching. Returns an absolute URL or ''."""
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


def fetch_and_cache(url: str) -> str:
    """Download `url`, write the bytes to <favicon_dir>/auto/<sha1>.<ext>,
    and return the local /api/favicons/files/auto/... path.

    Dedupes by SHA1 of the response body — many bookmarks pointing at the
    same site share a single cached file. Returns "" on any failure (caller
    falls back to the remote URL).
    """
    if not url:
        return ""
    try:
        with httpx.Client(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as cli:
            resp = cli.get(url)
            if resp.status_code >= 400 or not resp.content:
                return ""
            if len(resp.content) > _MAX_FAVICON_BYTES:
                return ""
            ext = _guess_ext(resp.headers.get("content-type", ""), url)
            if not ext:
                return ""
            sha = hashlib.sha1(resp.content).hexdigest()
            auto_dir = Path(settings.favicon_dir) / "auto"
            auto_dir.mkdir(parents=True, exist_ok=True)
            fname = f"{sha}{ext}"
            target = auto_dir / fname
            if not target.exists():
                target.write_bytes(resp.content)
            return f"/api/favicons/files/auto/{fname}"
    except Exception as exc:
        log.debug("fetch_and_cache failed for %s: %s", url, exc)
        return ""


def _guess_ext(content_type: str, url: str) -> str:
    ct = content_type.lower().split(";")[0].strip()
    if "svg" in ct:
        return ".svg"
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    if "x-icon" in ct or "vnd.microsoft.icon" in ct or "image/ico" in ct:
        return ".ico"
    if "gif" in ct:
        return ".gif"
    path = url.lower().split("?")[0]
    for e in (".svg", ".png", ".webp", ".jpg", ".jpeg", ".ico", ".gif"):
        if path.endswith(e):
            return e
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
