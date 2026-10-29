# 把两个日文 AI 绘画参考图库，做成一条「选姿势 + 选服装 → 直接出图」的链路

要画一张「穿着某套衣服、摆着某个姿势」的角色图，最麻烦的不是模型，而是你得**同时**精确控制两件事：姿态，和服装。

姿态有专门的参考图，服装也有专门的参考图。日本有两个现成的素材库分别解决这两件事——但它们是两个互不相干的站点，全日文，而且只能浏览、不能用来生成。

我把它们整合成了一个中文工作台，并且补上了最后一环。

---

## 两个库

**姿势集 POSE-DB-01**
- 288 组姿势 × 5 个角度（正面 / 俯拍 / 仰拍 / 侧面 / 斜角）＝ **1,439 张**
- 无面部灰色人偶线稿，3:4
- 4 个系列：全身单人（标准系 / 性感系）、上半身单人、双人缠绕

**服装集 COSTUME-DB-01**
- **1,407 套**，2:3
- 8 个分类：春 / 夏 / 秋 / 冬 / 内衣 / 派对 / 泳装 / 性感
- 画面里没有人，只有服装本身

原作者：**ギア（@giaaibusi）**

---

## 为什么不能直接拿来用

1. 两个站点是分开的，没有联动
2. 界面全是日文
3. 只能看图，生成还得自己另想办法

---

## 做了什么

一个三栏工作台：

**① 选姿势 → ② 选服装 → ③ 上传人像参考图 → 配生图接口 → 出图**

选中的姿势和服装会自动填进右侧的「参考图」区，第三个槽位留给你自己上传的人物照片。

---

## 最关键的一点：参考图要真的作为「图片」发出去

不少同类工具的做法，是把参考图的特征描述翻译成文字，写进提示词里。那样模型只是「听说过」这套衣服、这个姿势，不是「看见了」。

这个工作台把三张参考图**按顺序**原样送进接口：

| 槽位 | 来源 | 送出的原始文件 |
|---|---|---|
| 1 · 姿势参考图 | 姿势库自动填充 | 原图 900×1200 PNG |
| 2 · 服装参考图 | 服装库自动填充 | 大图 1366×2048 WebP |
| 3 · 人像参考图 | 本地上传 | 原文件 |

提示词随之自动改写成引用式，模型能对上号：

```
Reference image 1 is the POSE and body posture to reproduce exactly.
Reference image 2 is the OUTFIT to put on the character, keep the same clothing, colors and materials.
Reference image 3 is the CHARACTER: keep the same face, hairstyle and overall appearance.
Generate a full-body character illustration that keeps the pose from the pose reference,
the outfit from the costume reference, the face of the person reference.
```

接口层面：

- **OpenAI 兼容** → `POST /v1/images/edits`，三张图作为 `image[]` 一次 multipart 提交
- **Google Gemini** → `generateContent`，三张图作为 `inline_data`（base64）
- **自定义** → `POST` JSON，`images: [{role, name, data_url}]`
- **Pollinations** → 只能文生图，选它时界面会**明确警告**「只会按提示词文字生成」

---

## 几个工程细节

- **仓库只有 2.5 MB**：图片不存仓库，全部引用原站地址。原站两个图库都带 `Access-Control-Allow-Origin: *`，浏览器能跨域取到图片字节并转成接口需要的格式（multipart / base64），所以完全不需要把图塞进 Git。Pages 部署因此是秒级的。
- **参考图在浏览器端压缩**：等比压到最长边 896px 并转 JPEG，姿势线稿 400 KB → **61 KB**，上传快很多。
- **尺寸任意**：`WIDTHxHEIGHT` 任意填，比例自动算；带 `quality`（standard / hd / medium）与 `n`。
- **结果存在本地**：IndexedDB 图库，可复用提示词、下载、删除，刷新不丢；图片不上传服务器。
- **接口配置只存浏览器**：地址 / Key / 模型 / 种子存 localStorage，Key 不出本机。
- **界面中 / 英 / 日三语**，README 也是三语。

---

## 实测

姿势参考 + 服装参考，两张图经本机 Antigravity 代理走 `/v1/images/edits`：

> 姿态取自参考图 1，服装取自参考图 2——方领蝴蝶结上衣、粉色粗花呢外套搭肩、象牙白百褶短裙、白袜、粉色玛丽珍鞋与包。

![生成结果](docs/demo-result.webp)

---

## 许可与边界

素材条款完全沿用原站声明：

- **免费用于作品创作**（含商用）、**无需署名**
- **禁止对图片数据本身进行再分发、转载或转售**
- 图片元数据已清除，使用风险自负
- 画面为 AI 生成的**虚构内容**（人偶线稿 / 纯服装图），**请勿用于表现真人或未成年人**，也不要用于违反公序良俗的用途

本仓库为**非官方的中文本地化 / 整合版本**，与原作者无隶属关系。

---

## 链接

**在线工作台**
https://xuxuebin.github.io/ai-pose-costume-gallery/

**仓库**
https://github.com/XuXuebin/ai-pose-costume-gallery

**原站**
姿势集 https://ai-pose-gallery.pages.dev/
服装集 https://ai-costume-gallery.pages.dev/

---

*原作者 ギア（@giaaibusi）—— 感谢他做出了这两个非常好用的素材库。*
