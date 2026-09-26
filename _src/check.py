# -*- coding: utf-8 -*-
"""Чек-лист после сборки (seo-visibility §1.1 «7 проверок» + правила доверия Painel).
Запуск из корня репо: python3 _src/check.py  → код выхода 1 при любой ошибке."""
import json, os, re, sys, glob, html as H

ROOT = os.getcwd()
REG = json.load(open("manifest.json", encoding="utf-8"))
SITE, LANGS = REG["site"], REG["langs"]
HL = {"pt": "pt-PT", "en": "en", "ru": "ru", "es": "es", "de": "de"}
PAGES = {"": ("phone.h1", "meta.title"), "flyer.html": ("flyer.h1", "meta.flyerTitle")}
UI = {l: json.load(open("ui.%s.json" % l, encoding="utf-8")) for l in LANGS}
bad = []


def dig(d, k):
    for x in k.split("."):
        d = d[x]
    return d


def text_of(h):
    h = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", h, flags=re.S)
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


for page, (h1key, tkey) in PAGES.items():
    for l in LANGS:
        f = os.path.join("" if l == "pt" else l, page or "index.html")
        h = open(f, encoding="utf-8").read()
        url = SITE + ("" if l == "pt" else l + "/") + page
        tag = "%s [%s]" % (f, l)
        menu = re.search(r'<div class="menu" id="langMenu"[^>]*>(.*?)</div>', h, re.S)
        n = len(re.findall(r"<button", menu.group(1))) if menu else 0
        if n != len(LANGS): bad.append("%s: в меню языков %d кнопок" % (tag, n))
        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
        if not h1 or H.unescape(h1.group(1)).strip() != dig(UI[l], h1key): bad.append("%s: h1 не на языке адреса" % tag)
        title = H.unescape(re.search(r"<title>(.*?)</title>", h, re.S).group(1))
        desc = H.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
        if title != dig(UI[l], tkey): bad.append("%s: title не из словаря языка" % tag)
        if l != "pt" and (title == dig(UI["pt"], tkey) or not desc): bad.append("%s: title/description на языке оригинала" % tag)
        can = re.search(r'<link rel="canonical" href="([^"]*)"', h).group(1)
        if can != url: bad.append("%s: canonical %s ≠ %s" % (tag, can, url))
        if not re.search(r'<html lang="%s"' % HL[l], h): bad.append("%s: html lang" % tag)
        hre = re.findall(r'hreflang="([^"]*)"', h)
        if sorted(hre) != sorted([HL[x] for x in LANGS] + ["x-default"]): bad.append("%s: hreflang %s" % (tag, hre))
        for img in re.findall(r"<img[^>]*>", h):
            if not re.search(r'alt="[^"]+"', img): bad.append("%s: img без alt" % tag)
        if len(text_of(h)) < 1000: bad.append("%s: текста без JS мало (%d)" % (tag, len(text_of(h))))
        og = re.search(r'<meta property="og:url" content="([^"]*)"', h).group(1)
        if og != url: bad.append("%s: og:url" % tag)

sm = open("sitemap.xml").read()
if sm.count("<loc>") != len(PAGES) * len(LANGS): bad.append("sitemap: %d <loc>" % sm.count("<loc>"))

# все html: фавикон-тайл, OG, никаких CDN/внешних скриптов и шрифтов
for f in glob.glob("*.html") + glob.glob("*/*.html"):
    if f.startswith("_src"): continue
    h = open(f, encoding="utf-8").read()
    for need in ['rel="icon" href="icon.svg"', 'rel="apple-touch-icon"', 'rel="manifest"', 'property="og:image"', 'name="twitter:card"']:
        if need not in h: bad.append("%s: нет %s" % (f, need))
    for src in re.findall(r'<script[^>]+src="([^"]+)"', h) + re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', h):
        if src.startswith("http"): bad.append("%s: внешний ресурс %s" % (f, src))
    if "fonts.googleapis" in h: bad.append("%s: внешний шрифт" % f)

# доверие: только Ур.1, без контура B, без сырых «Условий», без клиентов
pub = open("data/programs.json", encoding="utf-8").read()
for w in ["AJU", "эмбарго", "ЭМБАРГО", "Tasks", "INOVAÇÃO 2030", "25 000 — 300 000", "СОРТ", "ждём", "клиент"]:
    for f in glob.glob("data/*.json") + glob.glob("*.html") + glob.glob("*/*.html"):
        if f.startswith("_src"): continue
        if w in open(f, encoding="utf-8").read(): bad.append("%s: найдено запретное «%s»" % (f, w))
for p in json.loads(pub)["programs"]:
    for k in ["verified", "source", "sourceName", "desc"]:
        if not p.get(k): bad.append("программа %s: нет %s" % (p["id"], k))
    if set(p["desc"]) != set(LANGS): bad.append("программа %s: описания не на 5 языках" % p["id"])
    if not p["source"].startswith("https://"): bad.append("программа %s: источник" % p["id"])

# локали: одинаковый набор ключей
def keys(d, pre=""):
    out = set()
    for k, v in d.items():
        out |= keys(v, pre + k + ".") if isinstance(v, dict) else {pre + k}
    return out
base = keys(UI["pt"])
for l in LANGS[1:]:
    miss = base - keys(UI[l])
    if miss: bad.append("ui.%s.json: нет ключей %s" % (l, sorted(miss)))

print("\n".join(bad) if bad else "✅ чек-лист: 0 расхождений (%d адресов, %d html)" % (len(PAGES) * len(LANGS), len(glob.glob("*.html") + glob.glob("*/*.html"))))
sys.exit(1 if bad else 0)
