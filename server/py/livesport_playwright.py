# server/py/livesport_playwright.py
import asyncio
import json
import os
import re
import sys
from datetime import datetime

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

try:
    from tf_playwright_stealth import stealth_async
except Exception:
    stealth_async = None


def normalize_player_results_url(url: str) -> str:
    url = (url or "").strip().split("#")[0].split("?")[0]
    if not url.startswith("http"):
        url = ("https://www.livesport.com" + url) if url.startswith("/") else ("https://www.livesport.com/" + url)
    if not url.endswith("/"):
        url += "/"
    if not url.endswith("/results/"):
        url += "results/"
    return url


def parse_date_to_iso(date_text: str):
    s = (date_text or "").strip()
    if not s:
        return None

    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d).date().isoformat()
        except Exception:
            return None

    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})$", s)
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
        hh, mm = int(m.group(3)), int(m.group(4))
        now = datetime.now()
        y = now.year
        try:
            dt = datetime(y, mo, d, hh, mm)
            if dt > now and (dt - now).days > 30:
                dt = datetime(y - 1, mo, d, hh, mm)
            return dt.date().isoformat()
        except Exception:
            return None

    return None


def safe_text(el) -> str:
    if not el:
        return ""
    return " ".join(el.get_text(" ", strip=True).split())


def build_me_keys(player_hint: str):
    hint = (player_hint or "").strip().lower()
    if not hint:
        return []
    toks = [t for t in re.split(r"\s+", hint) if t]
    keys = set(toks)
    keys.add(hint)
    if toks:
        keys.add(toks[-1])  # 姓
    return [k for k in keys if len(k) >= 3]


def find_event_title_for_match(match_node):
    prev = match_node
    for _ in range(80):
        prev = prev.find_previous()
        if not prev:
            break
        cls = " ".join(prev.get("class", [])).lower()
        if ("event__title" in cls) or ("event__header" in cls) or ("event__round" in cls):
            t = safe_text(prev)
            if t and len(t) >= 3:
                return t
    return ""


def extract_matches_from_dom(rendered_html: str, results_url: str, player_hint: str = "") -> dict:
    soup = BeautifulSoup(rendered_html, "html.parser")
    me_keys = build_me_keys(player_hint)

    match_nodes = soup.select(".event__match") or soup.select("[class*='event__match']") or []
    matches = []

    for node in match_nodes:
        dt_el = node.select_one(".event__time") or node.select_one("[class*='event__time']")
        date_text = safe_text(dt_el)

        home_el = node.select_one(".event__participant--home")
        away_el = node.select_one(".event__participant--away")
        if home_el or away_el:
            p1 = safe_text(home_el)
            p2 = safe_text(away_el)
        else:
            parts = node.select(".event__participant") or node.select("[class*='event__participant']")
            p1 = safe_text(parts[0]) if len(parts) > 0 else ""
            p2 = safe_text(parts[1]) if len(parts) > 1 else ""

        hs_el = node.select_one(".event__score--home")
        as_el = node.select_one(".event__score--away")
        score = ""
        if hs_el and as_el:
            a = safe_text(hs_el)
            b = safe_text(as_el)
            if re.fullmatch(r"\d{1,2}", a or "") and re.fullmatch(r"\d{1,2}", b or ""):
                score = f"{a}:{b}"
        if not score:
            raw = safe_text(node)
            m = re.search(r"\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b", raw)
            if m:
                score = f"{m.group(1)}:{m.group(2)}"

        event_title = find_event_title_for_match(node)

        opponent = ""
        result = ""
        if me_keys:
            p1_low = (p1 or "").lower()
            p2_low = (p2 or "").lower()
            is_p1_me = any(k in p1_low for k in me_keys)
            is_p2_me = any(k in p2_low for k in me_keys)

            if is_p1_me and not is_p2_me:
                opponent = p2
                if score:
                    x, y = score.split(":")
                    if x.isdigit() and y.isdigit():
                        result = "W" if int(x) > int(y) else "L"
            elif is_p2_me and not is_p1_me:
                opponent = p1
                if score:
                    x, y = score.split(":")
                    if x.isdigit() and y.isdigit():
                        result = "W" if int(y) > int(x) else "L"
            else:
                opponent = p2 or p1 or ""
        else:
            opponent = p2 or p1 or ""

        matches.append({
            "date": date_text,
            "dateISO": parse_date_to_iso(date_text),
            "event": event_title,
            "round": "",
            "opponent": opponent,
            "score": score,
            "result": result,
            "subEvent": "MS",
        })

    uniq = []
    seen = set()
    for m in matches:
        k = f"{m.get('date','')}__{m.get('score','')}__{m.get('opponent','')}__{m.get('event','')}"
        if k in seen:
            continue
        seen.add(k)
        uniq.append(m)

    return {"ok": True, "resultsUrl": results_url, "count": len(uniq), "matches": uniq}


async def click_show_more(page, max_clicks=40):
    selectors = [
        "text=/Show more/i",
        "a:has-text('Show more')",
        "button:has-text('Show more')",
        "[class*='event__more']",
    ]
    clicks = 0
    for _ in range(max_clicks):
        loc = None
        for sel in selectors:
            try:
                cand = page.locator(sel).first
                if await cand.count() > 0 and await cand.is_visible():
                    loc = cand
                    break
            except Exception:
                continue
        if not loc:
            break
        try:
            await loc.scroll_into_view_if_needed()
            await page.wait_for_timeout(200)
            await loc.click(timeout=5000)
            clicks += 1
            await page.wait_for_timeout(900)
            await page.mouse.wheel(0, 1800)
            await page.wait_for_timeout(300)
        except Exception:
            break
    return clicks


async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: livesport_playwright.py <resultsUrl> <years> [debug] [playerHint]"}))
        return

    results_url_in = sys.argv[1]
    years = int(sys.argv[2]) if str(sys.argv[2]).isdigit() else 2
    debug = bool(int(sys.argv[3])) if len(sys.argv) >= 4 and str(sys.argv[3]).isdigit() else False
    player_hint = sys.argv[4] if len(sys.argv) >= 5 else ""

    results_url = normalize_player_results_url(results_url_in)

    proxy_url = (os.environ.get("LIVESP_PROXY") or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or "").strip()

    debug_info = {}
    html = ""

    async with async_playwright() as p:
        launch_kwargs = {"headless": True}
        if proxy_url:
            launch_kwargs["proxy"] = {"server": proxy_url}
            debug_info["proxy"] = proxy_url

        browser = await p.chromium.launch(**launch_kwargs)
        context = await browser.new_context(
            viewport={"width": 1366, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            locale="en-US",
        )
        page = await context.new_page()
        if stealth_async:
            try:
                await stealth_async(page)
            except Exception:
                pass

        await page.goto(results_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1500)

        for _ in range(6):
            await page.mouse.wheel(0, 2200)
            await page.wait_for_timeout(350)

        clicks = await click_show_more(page, max_clicks=40)
        debug_info["showMoreClicks"] = clicks

        for _ in range(6):
            await page.mouse.wheel(0, 2200)
            await page.wait_for_timeout(300)

        html = await page.content()
        await browser.close()

    if debug:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(base_dir, "debug_livesport_rendered.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        debug_info["debugHtmlPath"] = html_path

    parsed = extract_matches_from_dom(html, results_url, player_hint)

    cutoff = datetime.now().replace(year=datetime.now().year - years).date()
    kept = []
    for m in parsed.get("matches", []):
        d_iso = m.get("dateISO")
        if not d_iso:
            kept.append(m)
            continue
        try:
            d = datetime.fromisoformat(d_iso).date()
            if d >= cutoff:
                kept.append(m)
        except Exception:
            kept.append(m)

    parsed["matches"] = kept
    parsed["count"] = len(kept)
    parsed["cutoff"] = cutoff.isoformat()
    parsed["years"] = years
    parsed["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    parsed["source"] = "livesport"
    parsed["debug"] = debug_info

    print(json.dumps(parsed, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
