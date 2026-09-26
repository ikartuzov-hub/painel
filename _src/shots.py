# Скриншоты поверхностей для самопроверки: python3 _src/shots.py url1 [url2 ...] (пути от корня, W×H через #)
import asyncio, sys, os, http.server, socketserver, threading, functools
from playwright.async_api import async_playwright
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve():
    h=functools.partial(Q,directory=os.getcwd()); socketserver.TCPServer.allow_reuse_address=True
    s=socketserver.TCPServer(("127.0.0.1",0),h); threading.Thread(target=s.serve_forever,daemon=True).start(); return s.server_address[1]
async def main():
    port=serve(); out="/tmp/claude-0/shots"; os.makedirs(out,exist_ok=True)
    async with async_playwright() as pw:
        b=await pw.chromium.launch()
        for i,arg in enumerate(sys.argv[1:]):
            url,_,size=arg.partition("#"); w,h=(int(x) for x in (size or "1920x1080").split("x"))
            wait=8000
            ctx=await b.new_context(viewport={"width":w,"height":h},locale="pt-PT",timezone_id="Atlantic/Madeira")
            pg=await ctx.new_page(); errs=[]
            pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
            pg.on("pageerror",lambda e: errs.append(str(e)))
            await pg.goto(f"http://127.0.0.1:{port}/{url}"); await pg.wait_for_timeout(wait)
            f=f"{out}/s{i}.png"; await pg.screenshot(path=f,full_page=(h>1500))
            print(f, url, "ERR:"+" | ".join(errs) if errs else "")
            await ctx.close()
        await b.close()
asyncio.run(main())
