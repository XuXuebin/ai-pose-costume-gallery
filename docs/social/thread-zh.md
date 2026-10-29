# 中文推文串（7 条）

## 1/7

把日本两个 AI 绘画参考图库搬成了中文，又加了条「选姿势 + 选服装 → 直接出图」的完整链路。

姿势库 1,439 张 · 服装库 1,407 套
素材全部按原站条款使用。

在线：https://xuxuebin.github.io/ai-pose-costume-gallery/

## 2/7

姿势库：288 组姿势 × 5 个角度（正面/俯拍/仰拍/侧面/斜角）= 1,439 张。
无面部灰色人偶线稿，3:4，给 AI 画人物当姿态参考。

服装库：1,407 套纯服装图，2:3，春夏秋冬 + 内衣/派对/泳装/性感共 8 类。

原站是分开的两页，只能看。

## 3/7

我把它做成了一个统一工作台 👇

① 选姿势 → ② 选服装 → ③ 上传人像参考图 → 配生图接口 → 出图

最关键的一点：三张参考图是「真的当图片」发给接口的，不是翻译成文字塞进提示词。

## 4/7

提示词会自动写成：
「Reference image 1 is the POSE… 2 is the OUTFIT… 3 is the CHARACTER」

浏览器直连，4 种接口：Pollinations（免密钥）/ OpenAI 兼容 / Gemini / 自定义 JSON，
还能一键读取本机 Antigravity 代理的模型列表。

## 5/7

一些细节：
· 图片不存仓库，全部引用原站 CDN → 仓库仅 2.5MB，Pages 部署秒开
· 参考图在浏览器端压到 896px 转 JPEG（线稿 400KB → 61KB），上传快很多
· 尺寸支持任意 WIDTHxHEIGHT，带 quality 参数
· 结果自动存进本地 IndexedDB 图库，可复用提示词、下载
· 界面中 / 英 / 日三语

## 6/7

原作者是 ギア（@giaaibusi）：
ai-pose-gallery.pages.dev
ai-costume-gallery.pages.dev

素材条款沿用原站：免费商用、免署名，但禁止再分发图片本身。画面是 AI 生成的虚构内容（人偶线稿 / 纯服装图），请不要用来表现真人或未成年人。

感谢原作者 🙏

## 7/7

仓库：https://github.com/XuXuebin/ai-pose-costume-gallery

#AI绘画 #绘画参考 #姿势参考 #服装参考 #图像生成 #ComfyUI #StableDiffusion #AIart

> 配图建议：3/7 挂 `docs/demo-studio.webp`；4/7 挂 `docs/demo-refs.webp`；
> 6/7 可挂 `docs/demo-result.webp`。
