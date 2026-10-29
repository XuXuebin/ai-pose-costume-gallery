#!/usr/bin/env python3
"""仓库完整性校验：数据条数、素材文件、路径引用、页面可访问性。"""
import json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errs = []
warns = []


def check(cond, msg):
    if not cond:
        errs.append(msg)


# ---------- 目录 ----------
for p in ["index.html", "studio/studio.css", "studio/studio.js", "studio/i18n.js",
          "studio/generator.js", "galleries/pose/index.html", "galleries/costume/index.html",
          "data/pose.json", "data/costume.json",
          "README.md", "README.en.md", "README.ja.md", "LICENSE", "NOTICE.md"]:
    check((ROOT / p).exists(), f"缺少文件：{p}")

# ---------- 数据 ----------
pose = json.load(open(ROOT / "data" / "pose.json", encoding="utf-8"))
costume = json.load(open(ROOT / "data" / "costume.json", encoding="utf-8"))
items = costume["items"]
print(f"姿势 {len(pose)} 条 · 服装 {len(items)} 条 · 分类 {len(costume['meta']['cats'])} 个")

for x in pose:
    for f in ("id", "系列", "分类", "姿势名", "角度", "缩略图", "原图", "分类EN", "角度EN", "系列EN"):
        check(bool(x.get(f)), f"姿势 {x.get('id')} 缺字段 {f}")
for x in items:
    for f in ("id", "分类", "关键词", "缩略图", "图像", "原图"):
        check(bool(x.get(f)), f"服装 {x.get('id')} 缺字段 {f}")

# 分类计数与 meta 一致
counts = {}
for x in items:
    counts[x["分类"]] = counts.get(x["分类"], 0) + 1
check(counts == costume["meta"]["counts"], "服装分类计数与 meta 不一致")

# ---------- 素材引用（默认走原站 CDN，可选本地副本）----------
LOCAL_ASSETS = (ROOT / "galleries" / "assets").exists()
if LOCAL_ASSETS:
    SETS = {
        "pose/thumbs": ("galleries/assets/pose/thumbs", ".jpg", 1439),
        "pose/full": ("galleries/assets/pose/full", ".webp", 1439),
        "costume/thumbs": ("galleries/assets/costume/thumbs", ".webp", 1407),
        "costume/full": ("galleries/assets/costume/full", ".webp", 1407),
    }
    for name, (d, ext, expect) in SETS.items():
        p = ROOT / d
        files = list(p.glob("*" + ext)) if p.exists() else []
        check(len(files) == expect, f"{name}: 期望 {expect} 个 {ext}，实际 {len(files)}")
        empty = [f.name for f in files if f.stat().st_size == 0]
        check(not empty, f"{name}: {len(empty)} 个空文件")
        total = sum(f.stat().st_size for f in files)
        print(f"  {name:18s} {len(files):5d} 个 · {total/1e6:8.1f} MB")
else:
    print("  （未启用本地素材副本，图片全部引用原站）")

# ---------- 页面里的路径引用 ----------
ORIGINS = ("https://ai-pose-gallery.pages.dev/", "https://ai-costume-gallery.pages.dev/")
for page in ("galleries/pose/index.html", "galleries/costume/index.html"):
    html = (ROOT / page).read_text(encoding="utf-8")
    refs = set(re.findall(r'"(?:缩略图|图像|原图)": "([^"]+)"', html))
    bad = [r for r in refs if not (r.startswith("http") or r.startswith("../"))]
    check(not bad, f"{page}: {len(bad)} 个非法路径，示例 {bad[:3]}")
    remote = [r for r in refs if r.startswith("http")]
    local = [r for r in refs if not r.startswith("http")]
    if local:
        base = (ROOT / page).parent
        missing = [r for r in local if not (base / r).resolve().exists()]
        check(not missing, f"{page}: {len(missing)} 个本地路径不存在，示例 {missing[:3]}")
    off = [r for r in remote if not r.startswith(ORIGINS)]
    check(not off, f"{page}: {len(off)} 个外链指向非原站，示例 {off[:3]}")
    print(f"  {page:34s} 路径引用 {len(refs)} 个（原站 {len(remote)} · 本地 {len(local)}）")

# ---------- 不残留原站公开聊天链接 ----------
SHIP = ["index.html", "NOTICE.md", "README.md", "README.en.md", "README.ja.md",
        "galleries/pose/index.html", "galleries/costume/index.html",
        "studio/studio.js", "studio/i18n.js", "studio/studio.css", "studio/generator.js"]
for f in SHIP:
    txt = (ROOT / f).read_text(encoding="utf-8")
    check("9BOJA" not in txt, f"{f}: 仍包含原站公开聊天链接")
    check("x.gd" not in txt, f"{f}: 仍包含 x.gd 链接")

# ---------- 三语 README ----------
for f in ("README.md", "README.en.md", "README.ja.md"):
    s = (ROOT / f).read_text(encoding="utf-8")
    check("giaaibusi" in s, f"{f}: 未标注原作者账号")
    check("ai-pose-gallery.pages.dev" in s, f"{f}: 未标注姿势原站")
    check("ai-costume-gallery.pages.dev" in s, f"{f}: 未标注服装原站")

# ---------- 报告 ----------
if warns:
    print("\n提示：")
    for w in warns:
        print("  -", w)
if errs:
    print(f"\n校验失败（{len(errs)} 项）:")
    for e in errs[:25]:
        print("  -", e)
    sys.exit(1)
print("\n校验通过：仓库完整")
