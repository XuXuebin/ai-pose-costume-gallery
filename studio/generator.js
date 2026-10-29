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

/* 参考图 → File。先等比压到 maxDim，再上传：线稿用 PNG，照片用 JPEG。
   原站两个图库都带 Access-Control-Allow-Origin: *，所以 crossOrigin=anonymous
   不会把 canvas 弄脏，可以安全地读像素再编码。 */
async function refToFile(ref, maxDim = 896) {
  if (ref.file && ref.file.size <= 300 * 1024) return ref.file;   // 小文件原样上传

  const src = ref.url || URL.createObjectURL(ref.file);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error(`参考图加载失败：${ref.name}（跨域或文件损坏）`));
    img.src = src;
  });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  // 统一转 JPEG：同样画质下比 PNG 小 5~10 倍（线稿 400KB → 43KB），上传快很多
  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error(`参考图转换失败：${ref.name}`);
  return new File([blob], `${ref.name}.jpg`, { type: "image/jpeg" });
}

/* 带超时的 fetch：本机代理出图可能要 1~2 分钟，甚至挂起 */
async function fetchWithTimeout(url, opts = {}, ms = 180000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(
        `请求超时（${Math.round(ms / 1000)} 秒）。\n` +
        `本机代理在多张参考图时偶尔会挂起，可以先移除「人像参考图」只发 2 张再试，` +
        `或换一个种子重试。`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
  try {
    json = JSON.parse(text);
  } catch {
    // 上游代理常直接返回纯文本错误
    const m = text.match(/"message"\s*:\s*"([^"]+)"/);
    const msg = m ? m[1] : text.slice(0, 300);
    throw new Error(msg);
  }
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
          width, height, seed, references = [], referer,
          quality = "", size = `${width}x${height}`, n = 1 } = cfg;

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
    const resp = await fetchWithTimeout(url, { mode: "cors" }, 180000);
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
      fd.append("size", size);
      fd.append("n", String(n));
      fd.append("response_format", "b64_json");
      if (quality) fd.append("quality", quality);
      if (negativePrompt) fd.append("negative_prompt", negativePrompt);
      for (const ref of references) {
        const file = await refToFile(ref);
        fd.append("image[]", file, file.name);
      }
      const headers = {};
      if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
      const resp = await fetchWithTimeout(base + "/images/edits", { method: "POST", body: fd, headers });
      if (!resp.ok) throw new Error(describeHttp(resp.status, "接口") + "\n" + (await resp.text()).slice(0, 300));
      return await extractImage(resp);
    }

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
    const resp = await fetchWithTimeout(base + "/images/generations", {
      method: "POST", headers,
      body: JSON.stringify({
        model, prompt, size, n,
        quality: quality || undefined,
        response_format: "b64_json",
      }),
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
    const resp = await fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify(body) });
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
  const resp = await fetchWithTimeout(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
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


/* ------------------------------------------------------------ 辅助 */

/** 从 OpenAI 兼容接口读取模型列表（用于填 datalist） */
async function fetchModels(endpoint, apiKey) {
  const base = endpoint.replace(/\/+$/, "");
  const url = base.endsWith("/v1") ? base + "/models" : base + "/v1/models";
  const headers = {};
  if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
  const resp = await fetchWithTimeout(url, { headers }, 20000);
  if (!resp.ok) throw new Error("读取模型列表失败：HTTP " + resp.status);
  const j = await resp.json();
  return (j.data || []).map(m => m.id).filter(Boolean);
}

/** 判断地址是否指向本机（本机代理在 https 页面上会被浏览器 Private Network Access 拦截） */
function isLocalEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return /^(localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0)$/.test(u.hostname);
  } catch { return false; }
}
