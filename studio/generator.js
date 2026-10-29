/* 浏览器端生图适配层：文生图 + 多参考图生图（img2img）
 *
 * 参考图约定（顺序即语义，提示词里用「参考图 1/2/3」指代）：
 *   1 = 姿势参考图   pose     （来自姿势库，人偶线稿，决定姿态与构图）
 *   2 = 服装参考图   costume  （来自服装库，决定服装与配色）
 *   3 = 人像参考图   person   （用户上传，决定人物长相）
 */

const PROVIDERS = {
  pollinations: {
    label: "Pollinations（文生图 · 免密钥）",
    needsKey: false, img2img: false,
    defaultEndpoint: "https://image.pollinations.ai/prompt/{prompt}",
    defaultModel: "flux",
    models: ["flux", "turbo"],
    noteKey: "gen.pollenNote",
  },
  openai: {
    label: "OpenAI 兼容（多参考图生图 · /v1/images/edits）",
    needsKey: true, img2img: true,
    defaultEndpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-image-1",
    models: ["gpt-image-1", "dall-e-3"],
    noteKey: "gen.openaiNote",
  },
  gemini: {
    label: "Google Gemini（多参考图生图 · generateContent）",
    needsKey: true, img2img: true,
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-flash-image",
    models: ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"],
    noteKey: "gen.geminiNote",
  },
  custom: {
    label: "自定义（JSON 提交，含参考图）",
    needsKey: false, img2img: true,
    defaultEndpoint: "https://example.com/v1/generate",
    defaultModel: "",
    models: [],
    noteKey: "gen.customNote",
  },
};

/* ---------------- 工具 ---------------- */

async function refToFile(ref) {
  if (ref.file) return ref.file;
  const r = await fetch(ref.url, { mode: "cors" });
  if (!r.ok) throw new Error(`取参考图失败 ${ref.name}：HTTP ${r.status}`);
  const blob = await r.blob();
  const ext = (blob.type.split("/")[1] || "png").split("+")[0];
  return new File([blob], `${ref.name}.${ext}`, { type: blob.type || "image/png" });
}

async function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

/* 从各种响应形态里解析出图片 */
async function extractImage(resp) {
  const ct = resp.headers.get("content-type") || "";
  if (ct.startsWith("image/")) return await resp.blob();
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("接口返回的不是 JSON：" + text.slice(0, 200)); }
  const pick = (o) => {
    if (!o || typeof o !== "object") return null;
    if (typeof o.url === "string" && o.url) return o.url;
    if (typeof o.b64_json === "string" && o.b64_json) return "data:image/png;base64," + o.b64_json;
    if (typeof o.b64 === "string" && o.b64) return "data:image/png;base64," + o.b64;
    if (typeof o.image === "string" && o.image) return o.image;
    if (typeof o.output === "string" && o.output) return o.output;
    for (const k of ["data", "images", "output", "results", "candidates"]) {
      const v = o[k];
      if (Array.isArray(v) && v.length) { const r = pick(v[0]); if (r) return r; }
      else if (v && typeof v === "object") { const r = pick(v); if (r) return r; }
    }
    return null;
  };
  let src = pick(json);
  // Gemini：candidates[0].content.parts[].inlineData.data
  if (!src && Array.isArray(json.candidates)) {
    for (const c of json.candidates) {
      for (const p of (c.content?.parts || [])) {
        const d = p.inlineData?.data || p.inline_data?.data;
        if (d) { src = "data:image/png;base64," + d; break; }
      }
      if (src) break;
    }
  }
  if (!src) throw new Error("无法从响应中找到图片字段：" + text.slice(0, 200));
  if (src.startsWith("data:")) {
    const b64 = src.split(",")[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: src.split(";")[0].split(":")[1] || "image/png" });
  }
  const r2 = await fetch(src);
  if (!r2.ok) throw new Error("下载生成图失败：" + r2.status);
  return await r2.blob();
}

function describeHttp(status, who) {
  const host = location.hostname;
  if (status === 403) {
    if (host === "localhost") {
      return `HTTP 403 · ${who} 拒绝了 localhost 来源的请求。\n` +
             `请改用 http://127.0.0.1:<端口> 打开本页面，或部署到 GitHub Pages 后再试。`;
    }
    return `HTTP 403 · ${who} 拒绝了本次请求（可能是密钥无效、来源未授权，或触发了内容审核）。`;
  }
  if (status === 400) return `HTTP 400 · ${who} 认为请求参数有误（检查模型名、尺寸与参考图格式）。`;
  if (status === 401 || status === 422) return `HTTP ${status} · ${who} 拒绝了该密钥（检查 API Key 是否正确/是否过期）。`;
  if (status === 429) return `HTTP 429 · ${who} 触发了频率限制，请稍后重试。`;
  if (status === 404) return `HTTP 404 · ${who} 找不到该地址，请检查接口地址与模型名。`;
  if (status >= 500) return `HTTP ${status} · ${who} 服务端错误，稍后重试。`;
  return `HTTP ${status}`;
}

/* ------------------------------------------------------------ 生成入口 */
async function generate(cfg, { onStage } = {}) {
  const { provider, endpoint, apiKey, model, prompt, negativePrompt,
          width, height, seed, references = [], referer } = cfg;

  const p = PROVIDERS[provider];
  if (!p) throw new Error("未知的生图接口：" + provider);
  const useRefs = p.img2img && references.length > 0;

  /* ---------- Pollinations：仅文生图 ---------- */
  if (provider === "pollinations") {
    const url = new URL(endpoint.replace("{prompt}", encodeURIComponent(prompt)));
    url.searchParams.set("width", width);
    url.searchParams.set("height", height);
    url.searchParams.set("seed", seed);
    url.searchParams.set("nologo", "true");
    if (model) url.searchParams.set("model", model);
    if (negativePrompt) url.searchParams.set("negative", negativePrompt);
    if (referer) url.searchParams.set("referrer", referer);
    onStage && onStage("request");
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(describeHttp(resp.status, "Pollinations"));
    return await extractImage(resp);
  }

  /* ---------- OpenAI 兼容：多参考图走 /v1/images/edits ---------- */
  if (provider === "openai") {
    const base = endpoint.replace(/\/+$/, "");
    onStage && onStage("request");

    if (useRefs) {
      const fd = new FormData();
      fd.append("model", model || "gpt-image-1");
      fd.append("prompt", prompt);
      fd.append("size", `${width}x${height}`);
      fd.append("n", "1");
      if (negativePrompt) fd.append("negative_prompt", negativePrompt);
      for (const ref of references) {
        const file = await refToFile(ref);
        fd.append("image[]", file, file.name);
      }
      const headers = {};
      if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
      const resp = await fetch(base + "/images/edits", { method: "POST", body: fd, headers });
      if (!resp.ok) throw new Error(describeHttp(resp.status, "接口") + "\n" + (await resp.text()).slice(0, 300));
      return await extractImage(resp);
    }

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
    const resp = await fetch(base + "/images/generations", {
      method: "POST", headers,
      body: JSON.stringify({ model, prompt, size: `${width}x${height}`, n: 1 }),
    });
    if (!resp.ok) throw new Error(describeHttp(resp.status, "接口") + "\n" + (await resp.text()).slice(0, 300));
    return await extractImage(resp);
  }

  /* ---------- Gemini：多参考图走 generateContent ---------- */
  if (provider === "gemini") {
    const base = endpoint.replace(/\/+$/, "");
    const url = `${base}/${encodeURIComponent(model || "gemini-2.5-flash-image")}:generateContent`;
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-goog-api-key"] = apiKey;

    const parts = [{ text: prompt }];
    if (useRefs) {
      onStage && onStage("images");
      for (const ref of references) {
        const file = await refToFile(ref);
        parts.push({ inline_data: { mime_type: file.type || "image/png", data: await fileToBase64(file) } });
      }
    }
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: aspectFor(width, height) },
      },
    };
    if (negativePrompt) body.generationConfig.negativePrompt = negativePrompt;
    onStage && onStage("request");
    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(describeHttp(resp.status, "Gemini") + "\n" + (await resp.text()).slice(0, 300));
    return await extractImage(resp);
  }

  /* ---------- 自定义：JSON 提交，参考图以 dataURL 带上 ---------- */
  const images = [];
  if (useRefs) {
    onStage && onStage("images");
    for (const ref of references) {
      const file = await refToFile(ref);
      images.push({ role: ref.role, name: ref.name, data_url: await blobToDataURL(file) });
    }
  }
  const payload = {
    prompt, negative_prompt: negativePrompt || undefined,
    width, height, seed, model: model || undefined,
    images: images.length ? images : undefined,
  };
  onStage && onStage("request");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
  const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error(describeHttp(resp.status, "接口") + "\n" + (await resp.text()).slice(0, 300));
  return await extractImage(resp);
}

function aspectFor(w, h) {
  const r = w / h;
  if (r > 1.15) return "16:9";
  if (r < 0.85) return "9:16";
  if (r < 0.95) return "3:4";
  if (r > 1.05) return "4:3";
  return "1:1";
}
