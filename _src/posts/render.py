#!/usr/bin/env python3
"""Картинка поста для каналов Apoios Madeira (WhatsApp PT / Telegram RU).

Квадрат 1080×1080 в цветах табло. Вход — JSON-спека, выход — JPG в posts/.
Публичный адрес: https://painel.seedwave.pt/posts/<имя>.jpg

  python3 _src/posts/render.py _src/posts/specs/2026-10-24-transportes.json

Спека: {"slug": "...", "pt": {...}, "ru": {...}} — для каждого языка поля:
  tag   — плашка сверху (программа · номер авизо)
  title — заголовок, 1–2 строки (перенос автоматический)
  big   — главное число крупно («até 90%», «до 90%»)
  sub   — подпись к числу, 1–2 строки
  rows  — до 3 строк [ключ, значение]
  dl    — срок (жёлтая плашка); пусто — плашки нет
  site  — домен в подвале
Пометка «создано с ИИ» ставится в подвал всегда (требование WhatsApp для каналов в PT).
"""
import json, sys, pathlib
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FONTS = HERE / "fonts"
AI = {"pt": "Imagem criada com IA", "ru": "Создано с ИИ", "en": "AI-generated image"}

BG, CARD = (11, 18, 32), (20, 30, 50)
W, MUT, ACC = (240, 244, 250), (150, 165, 190), (56, 189, 248)
OK, OKBG, WARN, WARNBG, LINE = (52, 211, 153), (16, 60, 48), (251, 191, 36), (60, 45, 10), (45, 58, 85)
L, R = 100, 980  # поля текста


def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.otf"), size)


def wrap(d, text, f, width, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines if len(lines) <= max_lines else None


def fit(d, text, weight, sizes, width, max_lines):
    for s in sizes:
        f = font(weight, s)
        lines = wrap(d, text, f, width, max_lines)
        if lines:
            return f, lines, s
    f = font(weight, sizes[-1])
    return f, wrap(d, text, f, width, 99)[:max_lines], sizes[-1]


def render(spec, lang, out):
    im = Image.new("RGB", (1080, 1080), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((60, 60, 1020, 1020), 36, fill=CARD)
    y = 104
    if spec.get("tag"):
        f = font("SemiBold", 28)
        d.rounded_rectangle((L, y, L + d.textlength(spec["tag"], font=f) + 40, y + 48), 24, fill=OKBG)
        d.text((L + 20, y + 8), spec["tag"], font=f, fill=OK)
    y = 186
    f, lines, s = fit(d, spec["title"], "Bold", [58, 52, 46, 40], R - L, 2)
    for ln in lines:
        d.text((L, y), ln, font=f, fill=W)
        y += int(s * 1.24)
    y += 6
    f, lines, s = fit(d, spec["big"], "ExtraBold", [190, 170, 150, 130, 110, 96], R - L, 1)
    d.text((L, y - int(s * 0.08)), lines[0], font=f, fill=ACC)
    y += int(s * 1.08)
    f, lines, s = fit(d, spec.get("sub", ""), "Medium", [40, 36, 32], R - L, 2) if spec.get("sub") else (None, [], 0)
    for ln in lines:
        d.text((L, y), ln, font=f, fill=W)
        y += int(s * 1.35)
    rows = spec.get("rows", [])[:3]
    if rows:
        y += 26
        d.line((L, y, R, y), fill=LINE, width=2)
        y += 28
        fk, fv = font("Regular", 34), font("SemiBold", 34)
        for k, v in rows:
            d.text((L, y), k, font=fk, fill=MUT)
            d.text((R - d.textlength(v, font=fv), y), v, font=fv, fill=W)
            y += 52
    if spec.get("dl"):
        f, lines, s = fit(d, spec["dl"], "Bold", [36, 32, 28], R - L - 40, 1)
        d.rounded_rectangle((L, 890, R, 960), 18, fill=WARNBG)
        d.text((540 - d.textlength(lines[0], font=f) / 2, 925 - s * 0.6), lines[0], font=f, fill=WARN)
    foot = "  ·  ".join(x for x in [spec.get("site", "painel.seedwave.pt"), "Apoios Madeira", AI.get(lang, AI["en"])] if x)
    f = font("Medium", 26)
    d.text((540 - d.textlength(foot, font=f) / 2, 980), foot, font=f, fill=MUT)
    if y > 880 and spec.get("dl"):
        print(f"⚠ {out.name}: текст наезжает на плашку срока (y={y}) — сократить sub/rows", file=sys.stderr)
    im.save(out, quality=88, optimize=True)
    return out


def main(path):
    spec = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    outdir = ROOT / "posts"
    outdir.mkdir(exist_ok=True)
    for lang in ("pt", "ru", "en"):
        if lang in spec:
            out = render(spec[lang], lang, outdir / f"{spec['slug']}_{lang}.jpg")
            print(f"https://painel.seedwave.pt/posts/{out.name}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
