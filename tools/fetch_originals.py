#!/usr/bin/env python3
"""按需下载原始尺寸 PNG（体积大，默认不入库）。

原站 PNG 合计约 2.1 GB，不适合放进 Git 仓库，因此仓库里只保留 WebP。
如果需要离线原图（例如打印 PDF），用本脚本拉到 originals/ 目录：

    python3 tools/fetch_originals.py --set pose
    python3 tools/fetch_originals.py --set costume --jobs 32
    python3 tools/fetch_originals.py --set pose --id full_sexy_P001_front
"""
import argparse, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    "pose": ("https://ai-pose-gallery.pages.dev", "img", ".png", "data/pose.json", "原图"),
    "costume": ("https://ai-costume-gallery.pages.dev", "png", ".png", "data/costume.json", "原图"),
}


def session(pool):
    s = requests.Session()
    s.mount("https://", HTTPAdapter(pool_connections=pool, pool_maxsize=pool, max_retries=0))
    return s


def fetch(sess, base, folder, ext, ident, dst):
    if dst.exists() and dst.stat().st_size > 0:
        return "skip"
    url = f"{base}/{folder}/{ident}{ext}"
    for attempt in range(3):
        try:
            r = sess.get(url, timeout=(15, 90), stream=True)
            if r.status_code != 200:
                time.sleep(0.6 * (attempt + 1))
                continue
            tmp = dst.with_suffix(dst.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 16):
                    if chunk:
                        f.write(chunk)
            os.replace(tmp, dst)
            return "ok"
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return "fail"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", dest="sets", action="append", choices=list(SOURCES))
    ap.add_argument("--jobs", type=int, default=16)
    ap.add_argument("--id", help="只下载指定 ID")
    args = ap.parse_args()
    sets = args.sets or list(SOURCES)

    for name in sets:
        base, folder, ext, datafile, _ = SOURCES[name]
        blob = json.load(open(ROOT / datafile, encoding="utf-8"))
        items = blob if isinstance(blob, list) else blob["items"]
        ids = [x["id"] for x in items]
        if args.id:
            ids = [args.id]
        outdir = ROOT / "originals" / name
        outdir.mkdir(parents=True, exist_ok=True)
        sess = session(args.jobs + 4)
        ok = skip = fail = 0
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=args.jobs) as ex:
            futs = [ex.submit(fetch, sess, base, folder, ext, i, outdir / f"{i}{ext}") for i in ids]
            for n, fut in enumerate(as_completed(futs), 1):
                st = fut.result()
                ok += st == "ok"; skip += st == "skip"; fail += st == "fail"
                if n % 100 == 0:
                    print(f"  {name}: {n}/{len(ids)}  {time.time()-t0:.0f}s", flush=True)
        print(f"==> {name}: 新增 {ok} · 跳过 {skip} · 失败 {fail} → {outdir}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
