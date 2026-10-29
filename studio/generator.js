/* 浏览器端生图适配层：Pollinations / OpenAI 兼容 / 自定义 URL */

const PROVIDERS = {
  pollinations: {
    label: "Pollinations（免费 · 免密钥）",
    needsKey: false,
    defaultEndpoint: "https://image.pollinations.ai/prompt/{prompt}",
    defaultModel: "flux",
    models: ["flux", "turbo", "kontext"],
    supportsRefs: false,
  },
  openai: {
    label: "OpenAI 兼容（/v1/images）",
    needsKey: true,
    defaultEndpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-image-1",
    models: ["gpt-image-1", "dall-e-3", "dall-e-2"],
    supportsRefs: true,
  },
  custom: {
    label: "自定义地址（URL 模板）",
    needsKey: false,
    defaultEndpoint: "https://example.com/gen/{prompt}?w={width}&h={height}&seed={seed}",
    defaultModel: "",
    models: [],
    supportsRefs: false,
  },
};

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
    if (typeof o.image === "string" && o.image) return o.image;
    if (typeof o.output === "string" && o.output) return o.output;
    for (const k of ["data", "images", "output", "result", "results"]) {
      const v = o[k];
      if (Array.isArray(v) && v.length) { const r = pick(v[0]); if (r) return r; }
      else if (v && typeof v === "object") { const r = pick(v); if (r) return r; }
    }
    return null;
  };
  const src = pick(json);
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

async function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------ 生成入口 */
async function generate(cfg, { onStage } = {}) {
  const { provider, endpoint, apiKey, model, prompt, negativePrompt,
          width, height, seed, references = [], referer } = cfg;

  if (provider === "pollinations") {
    const url = new URL(endpoint.replace("{prompt}", encodeURIComponent(prompt)));
    url.searchParams.set("width", width);
    url.searchParams.set("height", height);
    url.searchParams.set("seed", seed);
    url.searchParams.set("nologo", "true");
    url.searchParams.set("safe", "false");
    if (model) url.searchParams.set("model", model);
    if (negativePrompt) url.searchParams.set("negative", negativePrompt);
    if (referer) url.searchParams.set("referrer", referer);
    onStage && onStage("request");
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(describeHttp(resp.status, "Pollinations"));
    return await extractImage(resp);
  }

  if (provider === "openai") {
    const base = endpoint.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
    onStage && onStage("request");

    let resp;
    if (references.length) {
      // 图生图：/v1/images/edits（multipart）
      const fd = new FormData();
      fd.append("model", model || "gpt-image-1");
      fd.append("prompt", prompt);
      fd.append("size", `${width}x${height}`);
      fd.append("n", "1");
      if (negativePrompt) fd.append("negative_prompt", negativePrompt);
      references.forEach((r, i) => fd.append("image[]", r.file, r.file.name || `ref${i}.png`));
      const h2 = {}; if (apiKey) h2["Authorization"] = "Bearer " + apiKey;
      resp = await fetch(base + "/images/edits", { method: "POST", body: fd, headers: h2 });
    } else {
      resp = await fetch(base + "/images/generations", {
        method: "POST", headers,
        body: JSON.stringify({ model, prompt, size: `${width}x${height}`, n: 1 }),
      });
    }
    if (!resp.ok) {
      const e = await resp.text();
      throw new Error(`HTTP ${resp.status} · ${e.slice(0, 300)}`);
    }
    return await extractImage(resp);
  }

  // 自定义 URL 模板
  const url = endpoint
    .replaceAll("{prompt}", encodeURIComponent(prompt))
    .replaceAll("{width}", width)
    .replaceAll("{height}", height)
    .replaceAll("{seed}", seed)
    .replaceAll("{model}", encodeURIComponent(model || ""))
    .replaceAll("{negative}", encodeURIComponent(negativePrompt || ""));
  onStage && onStage("request");
  const resp = await fetch(url, { mode: "cors" });
  if (!resp.ok) throw new Error(describeHttp(resp.status, "接口"));
  return await extractImage(resp);
}

/* 把常见 HTTP 错误翻译成人话 */
function describeHttp(status, who) {
  const host = location.hostname;
  if (status === 403) {
    if (host === "localhost") {
      return `HTTP 403 · ${who} 拒绝了 localhost 来源的请求。\n` +
             `请改用 http://127.0.0.1:<端口> 打开本页面，或部署到 GitHub Pages 后再试。`;
    }
    return `HTTP 403 · ${who} 拒绝了本次请求（可能是密钥无效、来源未授权，或触发了内容审核）。`;
  }
  if (status === 429) return `HTTP 429 · ${who} 触发了频率限制，请稍后重试。`;
  if (status === 404) return `HTTP 404 · ${who} 找不到该地址，请检查接口地址是否正确。`;
  if (status >= 500) return `HTTP ${status} · ${who} 服务端错误，稍后重试。`;
  return `HTTP ${status}`;
}

/* 把参考图转成 dataURL，供需要图片输入的自定义流程使用 */
async function refsToDataURLs(refs) {
  const out = [];
  for (const r of refs) out.push(await blobToDataURL(r.file));
  return out;
}
