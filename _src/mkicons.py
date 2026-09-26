# -*- coding: utf-8 -*-
"""Иконки телефона и OG-превью: белый знак на кобальте (launch §3), OG 1200×630.
Рендер через Chromium (Playwright). Запуск из корня репо: python3 _src/mkicons.py"""
import asyncio
from playwright.async_api import async_playwright
P = '<path d="M36 66 L36 16 L54 16 C66 16 72 24 72 33 C72 42 66 50 54 50 L36 50"/><path d="M14 84 Q26 78 38 84 Q50 90 62 84 Q74 78 86 84"/>'
def tile(size):
    return f'''<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 100 100">
<rect width="100" height="100" fill="#1F4FD1"/><g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"
transform="translate(15 12) scale(.7)">{P}</g></svg></body></html>'''
def flaps(text, color):
    return "".join(f'<span class="fc" style="color:{color}">{c if c!=" " else "&nbsp;"}</span>' for c in text)
OG = f'''<html><head><meta charset="utf-8"><style>
body{{margin:0;width:1200px;height:630px;background:#0B1220;color:#EAF0FA;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box}}
.h{{display:flex;align-items:center;gap:28px}} .h svg{{width:120px;height:120px}}
h1{{margin:0;font-size:78px;letter-spacing:-.01em}} p{{margin:14px 0 0 148px;font-size:34px;color:#93A3BD}}
.b{{margin:46px 0 0 148px;display:flex;flex-direction:column;gap:14px}}
.fc{{display:inline-grid;place-items:center;width:38px;height:54px;margin-right:5px;background:#1A2336;border-radius:6px;
font:700 34px ui-monospace,Menlo,"DejaVu Sans Mono",monospace;position:relative}}
.fc:after{{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(0,0,0,.55)}}
</style></head><body><div class="h"><svg viewBox="0 0 100 100"><g fill="none" stroke="#4C8DFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">{P}</g></svg>
<h1>Painel de Apoios</h1></div><p>Tudo o que está aberto, num só painel</p>
<div class="b"><div>{flaps("ABERTO","#2FBF71")}</div><div>{flaps("FECHA EM 14 DIAS","#F2A93B")}</div></div></body></html>'''
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
            pg = await b.new_page(viewport={"width": size, "height": size})
            await pg.set_content(tile(size)); await pg.screenshot(path=name)
        pg = await b.new_page(viewport={"width": 1200, "height": 630})
        await pg.set_content(OG); await pg.screenshot(path="og-image.png")
        await b.close()
asyncio.run(main())
print("icons ok")
