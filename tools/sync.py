#!/usr/bin/env python3
"""把两个源项目（ai-pose-gallery / ai-costume-gallery）同步进统一仓库。

默认策略：**不搬运图片**，页面与数据里的素材路径一律指向原站（CDN 引用），
这样仓库只有几十 KB，GitHub Pages 部署秒开。

产出:
  galleries/pose/index.html        姿势库页面
  galleries/costume/index.html     服装库页面
  data/pose.json  data/costume.json  供 Studio 选图使用

可选:
  --local-assets   把图片也复制/转换进 galleries/assets/（自包含离线版，约 237 MB）

用法:
  python3 tools/sync.py
  python3 tools/sync.py --local-assets
"""
import argparse, io, json, os, re, shutil, sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_POSE = ROOT.parent / "ai-pose-gallery"
SRC_COSTUME = ROOT.parent / "ai-costume-gallery"

ORIGIN_POSE = "https://ai-pose-gallery.pages.dev"
ORIGIN_COSTUME = "https://ai-costume-gallery.pages.dev"


# ---------------------------------------------------------------- 本地资源（可选）
def to_webp(src: Path, dst: Path, quality: int = 90):
    if dst.exists() and dst.stat().st_size > 0:
        return "skip"
    with Image.open(src) as im:
        im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=quality, method=5)
    dst.write_bytes(buf.getvalue())
    return "ok"


def convert_dir(srcdir: Path, dstdir: Path, pattern: str, ext: str, quality=90):
    dstdir.mkdir(parents=True, exist_ok=True)
    files = sorted(srcdir.glob(pattern))
    todo = [(f, dstdir / (f.stem + "." + ext)) for f in files
            if not ((dstdir / (f.stem + "." + ext)).exists()
                    and (dstdir / (f.stem + "." + ext)).stat().st_size > 0)]
    if not todo:
        print(f"  {dstdir.name}: {len(files)} 张（全部已存在）")
        return
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        list(ex.map(_worker, [(s, d, quality) for s, d in todo]))
    print(f"  {dstdir}: 转换 {len(todo)} 张（共 {len(files)} 张）")


def _worker(arg):
    s, d, q = arg
    try:
        to_webp(s, d, q)
    except Exception as e:
        print("  !! 转换失败", s, e)


def copy_dir(srcdir: Path, dstdir: Path, pattern="*"):
    dstdir.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(srcdir.glob(pattern)):
        if f.is_file():
            shutil.copy2(f, dstdir / f.name)
            n += 1
    print(f"  {dstdir}: 复制 {n} 个文件")
    return n


# ---------------------------------------------------------------- 页面路径改写
def patch_html(html: str, rules: list[tuple]) -> str:
    """按规则改写数据里的素材路径（字段名 + 前缀 + 扩展名）。

    rules: [(字段名, 旧前缀, 新前缀, {旧扩展名: 新扩展名}), ...]
    """
    out = html
    for field, old_prefix, new_prefix, ext_map in rules:
        rx = re.compile(
            r'"' + re.escape(field) + r'": "' + re.escape(old_prefix) + r'([^"]+?)(\.[A-Za-z0-9]+)"')
        n = 0

        def sub(m, _f=field, _np=new_prefix, _em=ext_map):
            ext = _em.get(m.group(2), m.group(2))
            return f'"{_f}": "{_np}{m.group(1)}{ext}"'

        out, n = rx.subn(sub, out)
        if n == 0:
            raise SystemExit(f"路径改写失败：页面中找不到 {field!r} + {old_prefix!r}")
        print(f"  改写 {field}: {n} 处")
    return out


# ---------------------------------------------------------------- GitHub Star 入口
GH_REPO = "https://github.com/XuXuebin/ai-pose-costume-gallery"
GH_BTN = (
    '<a class="ghstar" href="' + GH_REPO + '" target="_blank" rel="noopener noreferrer" '
    'title="在 GitHub 上 Star 这个仓库">'
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">'
    '<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192'
    'a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.918 6.374a.75.75 0 0 1 '
    '.416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg><span>Star</span><em class="ghcount"></em></a>'
)
GH_CSS = """
/* GitHub Star 入口 */
.ghstar{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border-radius:99px;
  border:1px solid var(--line2);background:rgba(26,30,36,.7);color:#dfe3ea;font-size:14px;font-weight:700;
  text-decoration:none;white-space:nowrap;transition:.15s;-webkit-tap-highlight-color:transparent}
.ghstar:hover{border-color:#e3c8ff;color:#fff;background:rgba(227,200,255,.12)}
.ghstar svg{flex:0 0 auto;color:#f0c674}
.ghstar:hover svg{color:#ffd85e}
.ghcount{font-style:normal;font-size:12.5px;font-weight:700;color:#aab2bf;font-variant-numeric:tabular-nums;
  padding-left:8px;margin-left:1px;border-left:1px solid rgba(255,255,255,.18)}
.ghcount:empty{display:none}
"""
GH_JS = """
<script>
/* 读取仓库 star 数（GitHub 公共 API，失败则静默降级） */
(function () {
  var els = document.querySelectorAll('.ghcount');
  if (!els.length) return;
  fetch('https://api.github.com/repos/XuXuebin/ai-pose-costume-gallery', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.stargazers_count !== 'number') return;
      for (var i = 0; i < els.length; i++) els[i].textContent = d.stargazers_count;
    })
    .catch(function () {});
})();
</script>
"""


def add_github(html: str) -> str:
    """在图库页加入 GitHub Star 按钮（顶部 CTA + 页脚 CTA）与实时 star 数。"""
    # 1) 样式
    if ".ghstar{" not in html:
        html = html.replace("</style>", GH_CSS + "\n</style>", 1)
    # 2) 按钮：插到每个 .cta-row 的最前面（顶部 + 页脚各一处）
    html = html.replace('<div class="cta-row">', '<div class="cta-row">' + GH_BTN, 2)
    # 3) 右上角导航区之后也放一个（和使用提示 / 注意事项并排）
    nav_old = '<nav class="infotabs" id="infotabs"'
    if nav_old in html:
        i = html.index(nav_old)
        j = html.index('</nav>', i) + len('</nav>')
        html = html[:j] + GH_BTN + html[j:]
    # 4) 脚本
    if "api.github.com/repos/XuXuebin" not in html:
        html = html.replace("</body>", GH_JS + "\n</body>", 1)
    return html


# ---------------------------------------------------------------- 去公开聊天链接
def strip_open_chat(html: str, origin: str, lead: str) -> str:
    """移除原站的「加入公开聊天」入口，改为指向原站；CTA 文案改为本地化说明。"""
    html, n = re.subn(
        r'<a class="btn-oc" href="https://x\.gd/[^"]*"([^>]*)>[^<]*</a>',
        f'<a class="btn-oc" href="{origin}"\\1>访问原站</a>',
        html)
    print(f"  移除公开聊天入口: {n} 处")
    html, n2 = re.subn(r'<p class="cta-lead">[^<]*</p>',
                        f'<p class="cta-lead">{lead}</p>', html)
    print(f"  改写 CTA 文案: {n2} 处")
    if "x.gd" in html:
        raise SystemExit("页面中仍残留原站的公开聊天链接")
    # 顺带把 CSS 注释里的旧描述也一并改掉
    html = html.replace("公开聊天入口按钮", "原站入口按钮")
    html = html.replace("公开聊天按钮", "原站按钮")
    return html


# ---------------------------------------------------------------- 两个库
def build_pose(local_assets=False):
    print("== 姿势库 ==")
    src_site = SRC_POSE / "site"
    if not src_site.exists():
        sys.exit(f"找不到源项目：{src_site}")

    terms = json.load(open(Path(__file__).parent / "pose_terms.json", encoding="utf-8"))
    items = json.load(open(src_site / "data.json", encoding="utf-8"))
    for it in items:
        if local_assets:
            it["缩略图"] = "../assets/pose/thumbs/" + Path(it["缩略图"]).name
            it["原图"] = "../assets/pose/full/" + Path(it["原图"]).stem + ".webp"
        else:
            it["缩略图"] = f"{ORIGIN_POSE}/" + it["缩略图"]
            it["原图"] = f"{ORIGIN_POSE}/" + it["原图"]
        # 附英文描述，供 Studio 生成提示词使用
        it["分类EN"] = terms["分类"].get(it["分类"], it["分类"])
        it["角度EN"] = terms["角度"].get(it["角度"], it["角度"])
        it["系列EN"] = terms["系列"].get(it["系列"], it["系列"])

    json.dump(items, open(ROOT / "data" / "pose.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    html = (src_site / "index.html").read_text(encoding="utf-8")
    if local_assets:
        html = patch_html(html, [
            ("缩略图", "thumbs/", "../assets/pose/thumbs/", {}),
            ("原图", "img/", "../assets/pose/full/", {".png": ".webp"}),
        ])
        # 原图现在是本地 WebP；下载按钮改回原站的原尺寸 PNG
        dl_old = "dl.href=d.原图;dl.setAttribute('download',d.id+'.png');"
        dl_new = f"dl.href='{ORIGIN_POSE}/img/'+d.id+'.png';dl.setAttribute('download',d.id+'.png');"
        if dl_old not in html:
            raise SystemExit("姿势库：找不到下载链接代码")
        html = html.replace(dl_old, dl_new)
    else:
        html = patch_html(html, [
            ("缩略图", "thumbs/", f"{ORIGIN_POSE}/thumbs/", {}),
            ("原图", "img/", f"{ORIGIN_POSE}/img/", {}),
        ])

    html = strip_open_chat(
        html, ORIGIN_POSE,
        "原站：ai-pose-gallery.pages.dev · 本页为简体中文本地化版本")
    html = add_github(html)

    out = ROOT / "galleries" / "pose" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"  {out.relative_to(ROOT)}: {len(html):,} 字节")

    if local_assets:
        copy_dir(src_site / "thumbs", ROOT / "galleries" / "assets" / "pose" / "thumbs", "*.jpg")
        convert_dir(src_site / "img", ROOT / "galleries" / "assets" / "pose" / "full", "*.png", "webp", 92)


def build_costume(local_assets=False):
    print("== 服装库 ==")
    src_site = SRC_COSTUME / "site"
    if not src_site.exists():
        sys.exit(f"找不到源项目：{src_site}")

    blob = json.load(open(src_site / "data.json", encoding="utf-8"))
    meta, items = blob["meta"], blob["items"]
    for it in items:
        if local_assets:
            it["缩略图"] = "../assets/costume/thumbs/" + Path(it["缩略图"]).name
            it["图像"] = "../assets/costume/full/" + Path(it["图像"]).name
            it["原图"] = "../assets/costume/full/" + Path(it["原图"]).stem + ".webp"
        else:
            it["缩略图"] = f"{ORIGIN_COSTUME}/" + it["缩略图"]
            it["图像"] = f"{ORIGIN_COSTUME}/" + it["图像"]
            it["原图"] = f"{ORIGIN_COSTUME}/" + it["原图"]

    json.dump({"meta": meta, "items": items},
              open(ROOT / "data" / "costume.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    html = (src_site / "index.html").read_text(encoding="utf-8")
    if local_assets:
        html = patch_html(html, [
            ("缩略图", "thumbs/", "../assets/costume/thumbs/", {}),
            ("图像", "img/", "../assets/costume/full/", {}),
            ("原图", "png/", "../assets/costume/full/", {".png": ".webp"}),
        ])
        dl_old = "dl.href = d.原图; dl.setAttribute('download', d.id + '.png');"
        dl_new = (f"dl.href = '{ORIGIN_COSTUME}/png/' + d.id + '.png'; "
                  "dl.setAttribute('download', d.id + '.png');")
        if dl_old not in html:
            raise SystemExit("服装库：找不到下载链接代码")
        html = html.replace(dl_old, dl_new)
    else:
        html = patch_html(html, [
            ("缩略图", "thumbs/", f"{ORIGIN_COSTUME}/thumbs/", {}),
            ("图像", "img/", f"{ORIGIN_COSTUME}/img/", {}),
            ("原图", "png/", f"{ORIGIN_COSTUME}/png/", {}),
        ])

    html = strip_open_chat(
        html, ORIGIN_COSTUME,
        "原站：ai-costume-gallery.pages.dev · 本页为简体中文本地化版本")
    html = add_github(html)

    out = ROOT / "galleries" / "costume" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"  {out.relative_to(ROOT)}: {len(html):,} 字节")

    if local_assets:
        copy_dir(src_site / "thumbs", ROOT / "galleries" / "assets" / "costume" / "thumbs", "*.webp")
        copy_dir(src_site / "img", ROOT / "galleries" / "assets" / "costume" / "full", "*.webp")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local-assets", action="store_true",
                    help="把图片也复制进仓库（约 237 MB，自包含离线版）")
    args = ap.parse_args()
    (ROOT / "data").mkdir(exist_ok=True)
    build_pose(args.local_assets)
    build_costume(args.local_assets)
    print("\n完成。用 tools/verify.py 校验。")


if __name__ == "__main__":
    main()
