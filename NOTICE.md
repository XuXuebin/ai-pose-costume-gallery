# 素材版权与原始来源 / Asset Copyright & Original Sources

## 原始作者 / Original author

**ギア（@giaaibusi）** — https://x.com/giaaibusi

## 原始项目 / Original projects

| 项目 | 原站 | 原始仓库 |
|---|---|---|
| 姿势集 POSE-DB-01 | https://ai-pose-gallery.pages.dev/ | https://github.com/ (由原作者发布) |
| 服装集 COSTUME-DB-01 | https://ai-costume-gallery.pages.dev/ | https://github.com/ (由原作者发布) |

- 姿势集：1,439 张无面部灰色人偶线稿（3:4），288 组姿势 × 5 个角度（正面 / 俯拍 / 仰拍 / 侧面 / 斜角）
- 服装集：1,407 套不含人物的纯服装图片（2:3），8 个分类

> 上表「原始仓库」一栏填的是原作者的发布地址；本仓库为**非官方的本地化 / 整合版本**，
> 与原作者无隶属关系。如需引用素材，请直接指向上方原站。

## 本仓库做了什么 / What this repository does

- 把两个原站完整镜像为**简体中文**界面
- 姿势库、服装库各自提供独立浏览页（`galleries/pose/`、`galleries/costume/`）
- 新增统一工作台（`index.html`）：挑选姿势 + 挑选服装 + 配置生图 API → 生成并保存

## 图片如何引用 / How the images are referenced

**仓库内不存放图片。** 页面与数据里的所有素材路径都是原站的绝对地址：

| 用途 | 地址 |
|---|---|
| 姿势缩略图 | `https://ai-pose-gallery.pages.dev/thumbs/…` |
| 姿势原图 / 下载 | `https://ai-pose-gallery.pages.dev/img/…` |
| 服装缩略图 | `https://ai-costume-gallery.pages.dev/thumbs/…` |
| 服装大图 | `https://ai-costume-gallery.pages.dev/img/…` |
| 服装原图 / 下载 | `https://ai-costume-gallery.pages.dev/png/…` |

这样做让仓库保持在 **2.5 MB** 左右，GitHub Pages 部署瞬时完成，
代价是原站不可达时图片无法加载。

如需**自包含**版本：

```bash
python3 tools/sync.py --local-assets   # 图片一并放进 galleries/assets/（约 237 MB）
python3 tools/fetch_originals.py       # 或按需把原尺寸 PNG 拉到 originals/
```

**Images are referenced, not vendored.** All asset paths point at the original sites so the
repository stays around 2.5 MB and Pages deploys instantly. Use `tools/sync.py --local-assets`
or `tools/fetch_originals.py` for a self-contained build.

## 使用条款（来自原站声明）/ Terms (from the original site)

1. **可免费使用**：作品创作中的商用、编辑、参考使用均可，**无需署名**（也可自愿标注）。
2. **禁止再分发**：不得对图片数据本身（含原尺寸与加工后的版本）进行再分发、转载或转售。
3. **图片元数据已清除**，使用风险自负。
4. **画面为 AI 生成的虚构内容**：姿势库是灰色人偶线稿、服装库是纯服装图，均非真人 / 未成年人的照片，
   请勿用于表现真人或未成年人的用途，也不要用于违反公序良俗的用途。
5. 素材由文生图（t2i）方式生成，不含真实商品或真人照片。

**公开发布本仓库前，请再次确认上述条款。**
