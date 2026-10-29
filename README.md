<div align="center">

# 姿势 × 服装 生成工作台
### POSE-DB-01 × COSTUME-DB-01 · Studio

**[English](README.en.md) · [日本語](README.ja.md)**

挑选姿势 · 挑选服装 · 配置生图 API · 一键生成并保存

</div>

---

## 这是什么

把两个日文 AI 绘画参考图库——**姿势集**和**服装集**——整合到一处，并做了一个**统一工作台**：
左边挑姿势、右边挑服装、右边配置生图接口，点一下就生成参考图，结果自动存进浏览器本地图库。

| | 内容 | 数量 |
|---|---|---|
| 🧍 **姿势库** | 无面部灰色人偶线稿（3:4），每个姿势 5 个角度 | 288 组 / **1,439 张** |
| 👗 **服装库** | 不含人物的纯服装图片（2:3），8 个分类 | **1,407 套** |
| 🎨 **统一工作台** | 姿势 × 服装 × 生图 API → 生成并保存 | 3 种接口 |

界面语言：**中文 / English / 日本語** 三语可切换。

---

## 快速开始

### 在线预览

仓库根目录的 `index.html` 就是工作台，`galleries/` 下是两个独立图库。

```bash
git clone https://github.com/<你的账号>/ai-pose-costume-gallery.git
cd ai-pose-costume-gallery
python3 -m http.server 8899
# 打开 http://127.0.0.1:8899/
```

> ⚠️ 请用 **`127.0.0.1`** 而不是 `localhost` 打开：Pollinations 会拒绝 `localhost` 来源的请求（返回 403）。
> 两个图库页面本身用 `file://` 双击打开也能正常看图。

> 📌 **图片不存进仓库**：所有图片都直接从原站地址加载（姿势库取自 `ai-pose-gallery.pages.dev`，
> 服装库取自 `ai-costume-gallery.pages.dev`）。因此整个仓库只有约 **2.5 MB**，
> GitHub Pages 部署几乎瞬间完成；代价是需要能访问这两个原站。

### 部署到 GitHub Pages

仓库已内置 `.github/workflows/pages.yml`，推送后自动部署：

```bash
git init && git add . && git commit -m "feat: 姿势×服装统一工作台"
git branch -M main
git remote add origin git@github.com:<你的账号>/ai-pose-costume-gallery.git
git push -u origin main
```

然后在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**，
部署完成后访问 `https://<你的账号>.github.io/ai-pose-costume-gallery/`。

也可用 Cloudflare Pages / 对象存储 / Nginx：`site` 不需要构建命令，仓库根目录就是发布目录。

---

## 统一工作台怎么用

```
① 选择姿势  →  ② 选择服装  →  ③ 生成设置  →  生成图片  →  自动进图库
```

1. **选姿势**：按系列（4 个）、角度（5 个）、分类筛选，或搜索 ID / 姿势名。
2. **选服装**：按分类（8 个）筛选，或搜索 ID / 关键词（中文英文都能搜）。
3. **配接口**：三种生图 API 任选，界面填好即用。
4. **点「生成图片」**：结果直接显示，可下载 PNG；**同时自动存入本地图库**（IndexedDB），刷新页面也不会丢。
5. **图库**：可复用提示词、下载、删除、清空。图片只存在你自己的浏览器里，**不会上传**。

### 三种生图接口

| 接口 | 密钥 | 图生图 | 说明 |
|---|---|---|---|
| **Pollinations** | 免密钥 | ✗ | 默认选项，浏览器直连即可用，生成内容由第三方服务提供 |
| **OpenAI 兼容** | 需要 | ✓ | 走 `/v1/images/generations`，有参考图时走 `/v1/images/edits`；多数服务商不开 CORS，跨域报错时请在「接口地址」填自己的代理 |
| **自定义地址** | 视情况 | ✗ | 任意 URL 模板，支持 `{prompt}` `{width}` `{height}` `{seed}` `{model}` `{negative}` 占位符 |

接口地址、密钥、模型、种子会保存在浏览器 `localStorage`，**不上传服务器**。
公用设备请用完清掉（浏览器清除站点数据即可）。

### 提示词是自动拼的

选中姿势和服装后，提示词会自动组合成模型看得懂的英文描述：

```
full-body single subject, glamorous style, standing pose, three-quarter view,
wearing cream blouse ribbon ivory mini skirt shorts jacket beige tights,
outfit: 奶油色 女式衬衫 蝴蝶结 象牙白 短款 半身裙 短裤 夹克 米色 连裤袜,
full body character, fashion illustration, clean plain background, ...
```

姿势的中文术语（分类 / 角度 / 系列）都有一份英译对照表（`tools/pose_terms.json`），
改词表后重新同步即可。提示词可以随意编辑，默认负面提示词含 `nudity, explicit, nsfw` 等。

---

## 目录结构

```
ai-pose-costume-gallery/
├── index.html              ★ 统一工作台（GitHub Pages 首页）
├── studio/
│   ├── studio.css          工作台样式
│   ├── i18n.js             中 / 英 / 日 三语文案
│   ├── generator.js        生图 API 适配层（Pollinations / OpenAI / 自定义）
│   └── studio.js           选图、生成、图库逻辑
├── galleries/
│   ├── pose/index.html     姿势库（含 A4 打印排版）
│   └── costume/index.html  服装库
│                            ↑ 图片路径全部指向原站，仓库内不放图片
├── data/
│   ├── pose.json           姿势数据（供工作台选图）
│   └── costume.json        服装数据（供工作台选图）
├── tools/
│   ├── sync.py             从两个源项目同步 → 生成 galleries/ 与 data/
│   ├── pose_terms.json     姿势术语英译表
│   ├── fetch_originals.py  按需下载原尺寸 PNG（离线用）
│   └── verify.py           数据与路径完整性校验
├── .github/workflows/pages.yml   GitHub Pages 自动部署
├── NOTICE.md               素材版权与原始来源
├── LICENSE                 代码 MIT
└── README.md / README.en.md / README.ja.md
```

### 重新同步素材

本仓库的 `galleries/` 与 `data/` 是**从两个源项目生成的**：

```bash
python3 tools/sync.py                # 同步（需要 ../ai-pose-gallery 与 ../ai-costume-gallery）
python3 tools/sync.py --local-assets # 顺便把图片复制进仓库（约 237 MB，自包含离线版）
python3 tools/verify.py              # 校验数据条数 / 字段 / 路径引用 / 三语 README
```

默认不同步图片（页面与数据里写原站绝对地址）。
想做成**完全自包含、不依赖原站**的版本时，加 `--local-assets`：
姿势原图会在本地转成 WebP（900×1200），下载按钮仍指向原站原尺寸 PNG。

---

## 与原站的差异

**只有一点：图片不存进仓库，改为直接引用原站地址。**

原站图片合计约 2.1 GB，全量入库会让 GitHub 仓库与 Pages 部署非常笨重；
改成引用原站后，仓库只有约 2.5 MB，克隆与部署都是秒级。
代价是：原站不可达时图片就加载不出来。

需要离线或自包含时，用 `python3 tools/sync.py --local-assets` 生成带本地素材的版本，
或用 `python3 tools/fetch_originals.py` 按需拉取原尺寸 PNG。

功能上，除新增统一工作台外，两个图库的浏览、筛选、检索、放大、**A4 打印排版**与
「下载原尺寸 PNG」都与原站一致。

---

## 致谢与来源

**原始作者：ギア（@giaaibusi）** — https://x.com/giaaibusi

| 原站 | 链接 |
|---|---|
| 姿势集 POSE-DB-01 | https://ai-pose-gallery.pages.dev/ |
| 服装集 COSTUME-DB-01 | https://ai-costume-gallery.pages.dev/ |

本仓库为**非官方的中文本地化 / 整合版本**，与原作者无隶属关系。
图片版权归原作者所有，遵循原站条款：**免费用于作品创作（含商用）且无需署名**，
但**禁止对图片数据本身进行再分发、转载或转售**；画面为 AI 生成的虚构内容
（灰色人偶线稿 / 纯服装图），**请勿用于表现真人或未成年人**。
完整条款见 [NOTICE.md](NOTICE.md)。

---

## 许可

- **代码**（工作台、脚本、样式、文档）：[MIT](LICENSE)
- **图片素材**：版权归原作者 ギア 所有，遵循原站条款
