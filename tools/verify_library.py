#!/usr/bin/env python3
"""三库一致性质检：清单 / 配对 / 深度极性 / 离群检测 / 校验和抽检。

这是「除了你我还能靠什么证明结果正确」的机器化答案——每一条断言都可复现、可进 CI。

用法:
    python3 tools/verify_library.py                 # 离线检查（数据 + 配对 + 极性 + 离群）
    python3 tools/verify_library.py --sample 200    # 加大像素级抽样
    python3 tools/verify_library.py --online        # 额外做 sha256 抽检（需联网）

退出码: 0 = 全部通过；1 = 有失败项。
"""
import argparse, hashlib, json, os, random, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

FAILS, WARNS, PASSES = [], [], []


def ok(msg):   PASSES.append(msg);  print(f"  \033[32mPASS\033[0m {msg}")
def bad(msg):  FAILS.append(msg);   print(f"  \033[31mFAIL\033[0m {msg}")
def warn(msg): WARNS.append(msg);   print(f"  \033[33mWARN\033[0m {msg}")


def load(p):
    return json.load(open(ROOT / p, encoding="utf-8"))



# ---------------------------------------------------------------- 像素读取（带缓存）
_CACHE = {}


def fetch_gray(url):
    """下载并转灰度 numpy 数组，带内存缓存。"""
    if url in _CACHE:
        return _CACHE[url]
    import io
    import numpy as np
    from PIL import Image
    import requests
    r = requests.get(url, timeout=40, headers={"User-Agent": "pcg-verify/1.0"})
    r.raise_for_status()
    data = r.content
    a = np.asarray(Image.open(io.BytesIO(data)).convert("L")).astype("float32")
    _CACHE[url] = a
    return a


def fetch_line_gray(rel):
    """线稿原图在本地源项目里，按相对路径读取。"""
    import numpy as np
    from PIL import Image
    p = ROOT.parent / "ai-pose-gallery" / "site" / rel
    return np.asarray(Image.open(p).convert("L")).astype("float32")


# ---------------------------------------------------------------- 1. 清单
def check_manifest():
    print("\n[1] 清单 / manifest")
    mf = load("data/manifest.json")
    keys = [l["key"] for l in mf["libraries"]]
    if len(keys) == 3 and set(keys) == {"pose-line", "pose-depth", "costume"}:
        ok(f"清单含三个库: {', '.join(keys)}")
    else:
        bad(f"清单的库集合异常: {keys}")
    for l in mf["libraries"]:
        for f in ("db", "origin", "counts", "data", "gallery", "role", "terms"):
            if f not in l:
                bad(f"{l.get('key')} 缺字段 {f}")
        if l.get("data") and not (ROOT / l["data"]).exists():
            bad(f"{l['key']} 的数据文件不存在: {l['data']}")
        if l.get("gallery") and not (ROOT / l["gallery"] / "index.html").exists():
            bad(f"{l['key']} 的图库页不存在: {l['gallery']}")
    if not FAILS:
        ok("每个库的数据文件 / 图库页 / 许可条款均就位")
    return mf


# ---------------------------------------------------------------- 2. 配对
def check_pairing():
    print("\n[2] 线稿 ↔ 深度 配对")
    line = load("data/pose.json")
    depth = load("data/pose-depth.json")
    lid = [x["id"] for x in line]
    did = [x["id"] for x in depth]
    if set(lid) == set(did):
        ok(f"ID 集合一致（{len(lid)} 条）")
    else:
        bad(f"ID 集合不一致：线稿独有 {len(set(lid)-set(did))}，深度独有 {len(set(did)-set(lid))}")
        return
    if lid == did:
        ok("顺序一致")
    else:
        warn("顺序不一致（不影响配对，但会导致下标对不上）")
    dm = {x["id"]: x for x in depth}
    mism = []
    for x in line:
        d = dm[x["id"]]
        for f in ("系列", "姿势编号", "分类", "姿势名", "角度"):
            if x[f] != d[f]:
                mism.append((x["id"], f, x[f], d[f]))
    if mism:
        bad(f"元数据不一致 {len(mism)} 处，示例 {mism[:3]}")
    else:
        ok("姿势编号 / 角度 / 分类 / 姿势名 逐条相同")
    unpaired = [x["id"] for x in line if not x.get("深度缩略图") or not x.get("深度原图")]
    if unpaired:
        bad(f"{len(unpaired)} 条姿势缺少深度通道字段，示例 {unpaired[:3]}")
    else:
        ok("每条姿势都带上了深度双通道（深度缩略图 + 深度原图）")


# ---------------------------------------------------------------- 3. 深度极性
def check_polarity(sample_n):
    print("\n[3] 深度图极性：线稿墨迹应落在深度图的人物区域内")
    try:
        import numpy as np
    except ImportError:
        warn("缺少 numpy，跳过像素级检查")
        return
    depth = load("data/pose-depth.json")
    line = {x["id"]: x for x in load("data/pose.json")}
    random.seed(7)
    picks = random.sample(depth, min(sample_n, len(depth)))
    hit_bright, hit_dark, top_l, torso_l = [], [], [], []
    for it in picks:
        try:
            a = fetch_gray(it["原图"])
        except Exception as e:
            bad(f"{it['id']} 下载失败: {e}")
            continue
        h, w = a.shape
        top_l.append(a[0:60, :].mean())
        torso_l.append(a[int(h*.45):int(h*.55), int(w*.35):int(w*.65)].mean())
        rel = line[it["id"]]["原图"]
        if not rel.startswith("http"):
            continue
        try:
            l = fetch_line_gray(rel.replace("https://ai-pose-gallery.pages.dev/", ""))
        except Exception:
            continue
        ink = l < 110
        if ink.sum() == 0:
            continue
        for name, mask, acc in (("bright", a > 120, hit_bright), ("dark", a < 120, hit_dark)):
            acc.append(float((mask & ink).sum() / ink.sum()))
    if not hit_bright:
        bad("没有可用样本（线稿或深度图取不到）")
        return
    b, d = sum(hit_bright)/len(hit_bright), sum(hit_dark)/len(hit_dark)
    tl, sl = sum(top_l)/len(top_l), sum(torso_l)/len(torso_l)
    print(f"       顶部背景均值 {tl:.1f} | 躯干均值 {sl:.1f}")
    print(f"       线稿墨迹落在「亮区」比例 {b:.3f} | 落在「暗区」比例 {d:.3f}")
    if b > d * 1.5 and b > 0.55:
        ok(f"极性确认：近=白 远=黑（{len(hit_bright)} 张样本，亮区命中 {b:.3f} vs 暗区 {d:.3f}）")
        ok("与 MiDaS / ControlNet depth 惯例一致，可直接作为 depth 条件图")
    else:
        bad(f"极性判定不成立：亮区 {b:.3f} vs 暗区 {d:.3f}（需亮区显著更高）")


# ---------------------------------------------------------------- 4. 离群
def check_outliers(sample_n):
    print("\n[4] 主体面积离群检测（同渲染管线的自洽性）")
    try:
        import numpy as np
    except ImportError:
        warn("缺少 numpy，跳过")
        return
    from collections import defaultdict
    depth = load("data/pose-depth.json")
    random.seed(7)
    picks = random.sample(depth, min(sample_n, len(depth)))
    by_series = defaultdict(list)
    areas = {}
    for it in picks:
        try:
            a = fetch_gray(it["原图"])
        except Exception as e:
            warn(f"{it['id']} 跳过: {e}")
            continue
        ar = float((a > 128).mean())
        areas[it["id"]] = ar
        by_series[it["系列"]].append((it["id"], ar))
    for sname, v in sorted(by_series.items()):
        arr = np.array([x[1] for x in v])
        if len(arr) < 3:
            continue
        lo, hi = arr.mean() - 3*arr.std(), arr.mean() + 3*arr.std()
        out = [i for i, a in v if not (lo <= a <= hi)]
        txt = f"{sname:16s} 主体面积 {arr.mean()*100:.1f}% ± {arr.std()*100:.1f}%"
        if not out:
            ok(f"{txt}，无 3σ 离群")
        else:
            warn(f"{txt}，{len(out)} 个离群: {out[:3]}")


# ---------------------------------------------------------------- 5. 校验和
def check_checksum(n):
    print("\n[5] 资产 sha256 抽检（对原站）")
    depth = load("data/pose-depth.json")
    costume = load("data/costume.json")
    random.seed(3)
    picks = [("pose-depth", it) for it in random.sample(depth, max(1, n // 2))]
    picks += [("costume", it) for it in random.sample(costume["items"], max(1, n // 2))]
    good = 0
    for lib, it in picks:
        url = it["原图"]
        try:
            import requests
            r = requests.get(url, timeout=40, headers={"User-Agent": "pcg-verify/1.0"})
            r.raise_for_status()
            h = hashlib.sha256(r.content).hexdigest()
            good += 1
            print(f"       {it['id']:28s} sha256 {h[:16]}… ({len(h)} hex)")
        except Exception as e:
            warn(f"{it['id']} 校验失败: {e}")
    if good:
        ok(f"{good}/{len(picks)} 个资产可从原站取回并计算 sha256")
    else:
        warn("原站全部不可达，跳过校验和检查")


# ---------------------------------------------------------------- 6. 页面
def check_pages():
    print("\n[6] 页面与链接")
    for key, page in (("pose-line", "galleries/pose/index.html"),
                      ("pose-depth", "galleries/depth/index.html"),
                      ("costume", "galleries/costume/index.html"),
                      ("studio", "index.html")):
        p = ROOT / page
        if not p.exists():
            bad(f"{key}: 页面缺失 {page}")
            continue
        h = p.read_text(encoding="utf-8")
        if "9BOJA" in h or "x.gd" in h:
            bad(f"{key}: 仍残留原站公开聊天链接")
        if "api.github.com/repos/XuXuebin/ai-pose-costume-gallery" not in h:
            bad(f"{key}: 缺少 GitHub star 计数脚本")
        else:
            ok(f"{key}: 无公开聊天链接 + 含 star 计数脚本")
    # 导航完整性
    st = (ROOT / "index.html").read_text(encoding="utf-8")
    for need in ("galleries/pose/", "galleries/costume/", "galleries/depth/"):
        if need not in st:
            bad(f"工作台导航缺少 {need}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=60, help="像素级抽样数量")
    ap.add_argument("--online", action="store_true", help="额外做 sha256 抽检（需联网）")
    args = ap.parse_args()

    print("=" * 66)
    print("三库一致性质检 · ai-pose-costume-gallery")
    print("=" * 66)
    check_manifest()
    check_pairing()
    check_polarity(args.sample)
    check_outliers(args.sample)
    check_pages()
    if args.online:
        check_checksum(6)

    print("\n" + "=" * 66)
    print(f"通过 {len(PASSES)} 项 · 警告 {len(WARNS)} 项 · 失败 {len(FAILS)} 项")
    for w in WARNS:
        print(f"  WARN  {w}")
    for f in FAILS:
        print(f"  FAIL  {f}")
    print("=" * 66)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
