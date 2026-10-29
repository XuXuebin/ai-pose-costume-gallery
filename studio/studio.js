/* 统一工作台：选姿势 / 选服装 / 配参考图 / 配 API / 图生图 / 存图库 */
(() => {
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS_KEY = "pcg.studio.config.v1";
const SEL_KEY = "pcg.studio.sel.v1";
const PAGE = 60;

/* 素材地址：绝对地址（原站 CDN）原样使用，相对路径视为 galleries/ 下的本地文件 */
function assetUrl(p) {
  if (!p) return "";
  return /^(https?:)?\/\//.test(p) ? p : "galleries/" + p;
}

const state = {
  lang: localStorage.getItem("pcg.lang") || "zh",
  pose: [], costume: [],
  sel: { pose: null, costume: null },
  person: null,                       // {file, name, url}
  view: {
    pose: { list: [], shown: 0 },
    costume: { list: [], shown: 0 },
  },
  filters: { pose: { series: "", angle: "", q: "" }, costume: { cat: "", q: "" } },
  cfg: loadCfg(),
};

function loadCfg() {
  const def = {
    provider: "pollinations",
    endpoint: PROVIDERS.pollinations.defaultEndpoint,
    apiKey: "",
    model: PROVIDERS.pollinations.defaultModel,
    width: 1024, height: 1024, seed: 42,
    negative: "",
  };
  try { return Object.assign(def, JSON.parse(localStorage.getItem(LS_KEY) || "{}")); }
  catch { return def; }
}
function saveCfg() {
  const { provider, endpoint, apiKey, model, seed, negative } = state.cfg;
  localStorage.setItem(LS_KEY, JSON.stringify({ provider, endpoint, apiKey, model, seed, negative }));
}
function saveSel() {
  try {
    localStorage.setItem(SEL_KEY, JSON.stringify({
      pose: state.sel.pose ? state.sel.pose.id : null,
      costume: state.sel.costume ? state.sel.costume.id : null,
    }));
  } catch {}
}
function restoreSel() {
  try {
    const v = JSON.parse(localStorage.getItem(SEL_KEY) || "{}");
    if (v.pose) state.sel.pose = state.pose.find(x => x.id === v.pose) || null;
    if (v.costume) state.sel.costume = state.costume.find(x => x.id === v.costume) || null;
  } catch {}
}

/* ============================================================ 语言 */
function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("pcg.lang", lang);
  applyI18n(lang);
  $$(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
  document.title = lang === "zh" ? "姿势 × 服装 生成工作台 · POSE-DB-01 × COSTUME-DB-01"
              : lang === "en" ? "Pose × Costume Studio · POSE-DB-01 × COSTUME-DB-01"
              : "ポーズ × 衣装 生成スタジオ · POSE-DB-01 × COSTUME-DB-01";
  renderPose(); renderCostume(); renderPicked(); renderRefs();
  renderProviders(); applyProvider(); renderGallery();
}

/* ============================================================ 数据 */
async function loadData() {
  try {
    const [p, c] = await Promise.all([
      fetch("data/pose.json").then(r => r.json()),
      fetch("data/costume.json").then(r => r.json()),
    ]);
    state.pose = p;
    state.costume = c.items;
    state.costumeMeta = c.meta;
    buildFilters();
    restoreSel();
    renderPose(); renderCostume(); renderPicked(); renderRefs();
  } catch (e) {
    $$(".picker").forEach(el => el.innerHTML = `<div class="empty">${esc(t("err.load", state.lang))}</div>`);
  }
}

function buildFilters() {
  const series = [...new Set(state.pose.map(x => x["系列"]))];
  const angles = [...new Set(state.pose.map(x => x["角度"]))];
  const cats = state.costumeMeta ? state.costumeMeta.cats : [...new Set(state.costume.map(x => x["分类"]))];

  $("#poseSeries").innerHTML = `<option value="">${esc(t("pick.all", state.lang))}</option>` +
    series.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  $("#poseAngle").innerHTML = `<option value="">${esc(t("pick.all", state.lang))}</option>` +
    angles.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  $("#costumeCat").innerHTML = `<option value="">${esc(t("pick.all", state.lang))}</option>` +
    cats.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

/* ============================================================ 选择器 */
function poseList() {
  const f = state.filters.pose, q = f.q.toLowerCase();
  return state.pose.filter(x =>
    (!f.series || x["系列"] === f.series) &&
    (!f.angle || x["角度"] === f.angle) &&
    (!q || x.id.toLowerCase().includes(q) || x["姿势名"].toLowerCase().includes(q) ||
      x["姿势编号"].toLowerCase().includes(q) || x["分类"].toLowerCase().includes(q)));
}
function costumeList() {
  const f = state.filters.costume, q = f.q.toLowerCase();
  return state.costume.filter(x =>
    (!f.cat || x["分类"] === f.cat) &&
    (!q || x.id.toLowerCase().includes(q) || x["关键词"].toLowerCase().includes(q) ||
      x["关键词原文"].toLowerCase().includes(q)));
}

function renderPose() {
  const v = state.view.pose;
  v.list = poseList(); v.shown = 0;
  const g = $("#poseGrid");
  g.innerHTML = "";
  if (!v.list.length) { g.innerHTML = `<div class="empty">${esc(t("pick.empty", state.lang))}</div>`; return; }
  appendPose();
}
function appendPose() {
  const v = state.view.pose, g = $("#poseGrid");
  const slice = v.list.slice(v.shown, v.shown + PAGE);
  g.insertAdjacentHTML("beforeend", slice.map(x => `
    <button type="button" class="pick ${state.sel.pose && state.sel.pose.id === x.id ? "on" : ""}"
            role="option" data-pose="${esc(x.id)}" title="${esc(x["姿势名"])}">
      <img loading="lazy" decoding="async" src="${esc(assetUrl(x["缩略图"]))}" alt="${esc(x["姿势名"])}">
      <span class="pk">${esc(x["姿势编号"])}</span>
    </button>`).join(""));
  v.shown += slice.length;
  updateMore();
}
function renderCostume() {
  const v = state.view.costume;
  v.list = costumeList(); v.shown = 0;
  const g = $("#costumeGrid");
  g.innerHTML = "";
  if (!v.list.length) g.innerHTML = `<div class="empty">${esc(t("pick.empty", state.lang))}</div>`;
  else appendCostume();
}
function appendCostume() {
  const v = state.view.costume, g = $("#costumeGrid");
  const slice = v.list.slice(v.shown, v.shown + PAGE);
  g.insertAdjacentHTML("beforeend", slice.map(x => `
    <button type="button" class="pick ${state.sel.costume && state.sel.costume.id === x.id ? "on" : ""}"
            role="option" data-costume="${esc(x.id)}" title="${esc(x["关键词"])}">
      <img loading="lazy" decoding="async" src="${esc(assetUrl(x["缩略图"]))}" alt="${esc(x["关键词"])}">
      <span class="pk">${esc(x.id)}</span>
    </button>`).join(""));
  v.shown += slice.length;
  updateMore();
}
function updateMore() {
  const p = state.view.pose, c = state.view.costume;
  const pb = document.querySelector('[data-more="pose"]');
  const cb = document.querySelector('[data-more="costume"]');
  pb.hidden = p.shown >= p.list.length;
  cb.hidden = c.shown >= c.list.length;
  pb.textContent = `${t("pick.more", state.lang)}（${p.list.length - p.shown}）`;
  cb.textContent = `${t("pick.more", state.lang)}（${c.list.length - c.shown}）`;
}

/* ============================================================ 选中态 */
function renderPicked() {
  const p = state.sel.pose, c = state.sel.costume;
  $("#posePicked").innerHTML = p ? `
    <div class="selcard">
      <img src="${esc(assetUrl(p["缩略图"]))}" alt="">
      <div class="selinfo">
        <b>${esc(p["姿势编号"])} · ${esc(p["姿势名"])}</b>
        <span>${esc(p["系列"])} · ${esc(p["角度"])} · ${esc(p["分类"])}</span>
      </div>
      <button class="x" type="button" data-clear="pose" title="clear">×</button>
    </div>` : `<div class="selnone">${esc(t("sel.none", state.lang))}</div>`;

  $("#costumePicked").innerHTML = c ? `
    <div class="selcard">
      <img src="${esc(assetUrl(c["缩略图"]))}" alt="">
      <div class="selinfo">
        <b>${esc(c["id"])}</b>
        <span>${esc(c["分类"])} · ${esc(c["关键词"])}</span>
      </div>
      <button class="x" type="button" data-clear="costume" title="clear">×</button>
    </div>` : `<div class="selnone">${esc(t("sel.none", state.lang))}</div>`;

  $$("[data-pose]").forEach(b => b.classList.toggle("on", !!p && p.id === b.dataset.pose));
  $$("[data-costume]").forEach(b => b.classList.toggle("on", !!c && c.id === b.dataset.costume));
  saveSel();
  autoPrompt();
}

/* ============================================================ 参考图 */
function buildReferences() {
  const out = [];
  const p = state.sel.pose, c = state.sel.costume;
  if (p) out.push({ role: "pose", name: p.id, url: p["原图"], thumb: assetUrl(p["缩略图"]),
                    label: `${p["姿势编号"]} · ${p["姿势名"]}`, from: "pose" });
  if (c) out.push({ role: "costume", name: c.id, url: c["图像"], thumb: assetUrl(c["缩略图"]),
                    label: `${c["id"]} · ${c["分类"]}`, from: "costume" });
  if (state.person) out.push({ role: "person", name: state.person.name, file: state.person.file,
                    thumb: state.person.url, label: state.person.name, from: "person" });
  return out;
}

function renderRefs() {
  const refs = buildReferences();
  const slots = [
    { key: "pose", no: 1, title: t("gen.slotPose", state.lang), from: t("gen.slotFrom", state.lang) },
    { key: "costume", no: 2, title: t("gen.slotCostume", state.lang), from: t("gen.slotFromCostume", state.lang) },
    { key: "person", no: 3, title: t("gen.slotPerson", state.lang), from: t("gen.slotFromUpload", state.lang) },
  ];
  const html = slots.map(sl => {
    const r = refs.find(x => x.role === sl.key);
    if (!r) {
      if (sl.key === "person") {
        return `<div class="slot slot-empty" data-slot="person">
          <div class="slot-img slot-upload" id="personDrop">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
            <span>${esc(t("gen.slotUpload", state.lang))}</span>
          </div>
          <div class="slot-cap"><b>${sl.no}. ${esc(sl.title)}</b><span>${esc(t("gen.slotEmpty", state.lang))}</span></div>
        </div>`;
      }
      return `<div class="slot slot-empty" data-slot="${sl.key}">
        <div class="slot-img"><span class="slot-ph">${sl.no}</span></div>
        <div class="slot-cap"><b>${sl.no}. ${esc(sl.title)}</b><span>${esc(t("gen.slotEmpty", state.lang))}</span></div>
      </div>`;
    }
    const isPerson = sl.key === "person";
    return `<div class="slot slot-filled" data-slot="${sl.key}">
      <div class="slot-img"><img src="${esc(r.thumb)}" alt=""><span class="slot-no">${sl.no}</span>
        ${isPerson ? `<button class="slot-x" type="button" data-refdel="person" title="remove">×</button>` : ""}</div>
      <div class="slot-cap"><b>${sl.no}. ${esc(sl.title)}</b><span title="${esc(r.label)}">${esc(r.label)}</span></div>
    </div>`;
  }).join("");

  $("#refSlots").innerHTML = html;
  $("#refCount").textContent = refs.length
    ? t("gen.refsCount", state.lang).replace("%d", refs.length) : "";
  $("#personNote").textContent = t("gen.personNeeded", state.lang);

  // 人像上传交互
  const drop = $("#personDrop");
  if (drop) {
    drop.onclick = () => $("#personInput").click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("drag"); };
    drop.ondragleave = () => drop.classList.remove("drag");
    drop.ondrop = e => {
      e.preventDefault(); drop.classList.remove("drag");
      const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/"));
      if (f) setPerson(f);
    };
  }
}

function setPerson(file) {
  state.person = { file, name: file.name || "person.png", url: URL.createObjectURL(file) };
  renderRefs();
  autoPrompt();
}

/* ============================================================ 提示词 */
const DEFAULT_NEGATIVE = "nudity, explicit, nsfw, text, watermark, logo, signature, deformed hands, extra limbs, bad anatomy, low quality";

function autoPrompt() {
  const refs = buildReferences();
  const c = state.sel.costume;
  const lines = [];
  refs.forEach((r, i) => {
    const n = i + 1;
    if (r.role === "pose") lines.push(`Reference image ${n} is the POSE and body posture to reproduce exactly.`);
    if (r.role === "costume") lines.push(`Reference image ${n} is the OUTFIT to put on the character, keep the same clothing, colors and materials.`);
    if (r.role === "person") lines.push(`Reference image ${n} is the CHARACTER: keep the same face, hairstyle and overall appearance.`);
  });
  const parts = [];
  if (c) parts.push(`Outfit details: ${c["关键词原文"]}.`);
  parts.push(...lines);
  const keep = [];
  if (state.sel.pose) keep.push("the pose from the pose reference");
  if (c) keep.push("the outfit from the costume reference");
  if (state.person) keep.push("the face of the person reference");
  if (keep.length) {
    parts.push(`Generate a full-body character illustration that keeps ${keep.join(", ")}.`);
  } else {
    parts.push("Generate a full-body character illustration.");
  }
  parts.push("Single character, clean plain background, studio lighting, high quality, detailed fabric texture, natural proportions.");
  const txt = parts.join(" ");
  const box = $("#prompt");
  if (document.activeElement !== box) box.value = txt;
  state.lastPrompt = txt;
}

/* ============================================================ API 设置 */
function renderProviders() {
  const sel = $("#provider");
  sel.innerHTML = Object.entries(PROVIDERS)
    .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  sel.value = state.cfg.provider;
}
function applyProvider() {
  const p = PROVIDERS[state.cfg.provider];
  if (!p) { state.cfg.provider = "pollinations"; }
  const pp = PROVIDERS[state.cfg.provider];
  $("#provider").value = state.cfg.provider;
  $("#endpoint").value = state.cfg.endpoint;
  $("#apikey").value = state.cfg.apiKey;
  $("#model").value = state.cfg.model;
  $("#modelList").innerHTML = pp.models.map(m => `<option value="${esc(m)}">`).join("");
  $("#keyField").hidden = !pp.needsKey;
  $("#providerNote").textContent = t(pp.noteKey, state.lang);
  $("#img2imgTag").hidden = !pp.img2img;
  $("#qualityField").hidden = state.cfg.provider !== "openai";
  saveCfg();
  updateRefWarn();
  updateLocalWarn();
}
function updateLocalWarn() {
  const ep = $("#endpoint").value.trim();
  const box = $("#localWarn");
  if (!ep || !isLocalEndpoint(ep)) { box.hidden = true; return; }
  const host = new URL(ep).hostname;
  const pageIsLocal = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  if (pageIsLocal) {
    box.hidden = false;
    box.textContent = t("gen.localOk", state.lang).replace("%s", host);
  } else {
    box.hidden = false;
    box.textContent = t("gen.localWarn", state.lang).replace("%s", host);
  }
}

function updateRefWarn() {
  const p = PROVIDERS[state.cfg.provider];
  const refs = buildReferences();
  const warn = $("#refWarn");
  warn.hidden = !(refs.length && !p.img2img);
  if (!warn.hidden) warn.textContent = t("gen.noRefWarn", state.lang);
}

/* ============================================================ 生成 */
function parseSize(str) {
  const m = String(str || "").match(/(\d+)\s*[x*×]\s*(\d+)/i);
  if (!m) return { w: 1024, h: 1024 };
  return { w: Math.max(64, Math.min(4096, +m[1])), h: Math.max(64, Math.min(4096, +m[2])) };
}

function cfgFromUI() {
  const size = $("#size").value.trim() || "1024x1024";
  const { w, h } = parseSize(size);
  return {
    provider: state.cfg.provider,
    endpoint: $("#endpoint").value.trim(),
    apiKey: $("#apikey").value.trim(),
    model: $("#model").value.trim(),
    prompt: $("#prompt").value.trim(),
    negativePrompt: $("#negprompt").value.trim(),
    width: w, height: h,
    size: `${w}x${h}`,
    quality: $("#quality").value,
    n: 1,
    seed: Number($("#seed").value) || 0,
    references: buildReferences(),
    referer: location.origin + location.pathname,
  };
}

async function run() {
  if (!state.sel.pose && !state.sel.costume && !state.person) {
    alert(t("err.noSel", state.lang)); return;
  }
  const cfg = cfgFromUI();
  const p = PROVIDERS[cfg.provider];
  if (p.needsKey && !cfg.apiKey) { alert(t("err.noKey", state.lang)); return; }
  if (!cfg.prompt) { autoPrompt(); cfg.prompt = $("#prompt").value.trim(); }

  const btn = $("#runBtn");
  btn.disabled = true;
  btn.textContent = t("gen.running", state.lang);
  const box = $("#result");
  const n = cfg.references.length;
  const slow = isLocalEndpoint(cfg.endpoint);
  box.innerHTML = `<div class="spinner"></div><div class="note" id="runNote">${esc(t("gen.running", state.lang))}` +
                  `${n ? " · " + esc(t("gen.refsCount", state.lang).replace("%d", n)) : ""}</div>` +
                  (slow ? `<div class="note">${esc(t("gen.slow", state.lang))}</div>` : "");
  // 计时
  const t0 = Date.now();
  const timer = setInterval(() => {
    const el = $("#runNote");
    if (!el) return clearInterval(timer);
    const s = Math.round((Date.now() - t0) / 1000);
    el.textContent = `${t("gen.running", state.lang)} · ${s}s`;
  }, 1000);

  try {
    const blob = await generate(cfg);
    const url = URL.createObjectURL(blob);
    showResult(url, blob, cfg);
    await saveToGallery(blob, cfg);
    renderGallery();
  } catch (e) {
    box.innerHTML = `<div class="errbox"><b>${esc(t("gen.err", state.lang))}</b><pre>${esc(String(e.message || e))}</pre></div>`;
  } finally {
    clearInterval(timer);
    btn.disabled = false;
    btn.textContent = t("gen.run", state.lang);
  }
}

function showResult(url, blob, cfg) {
  const box = $("#result");
  box.innerHTML = `
    <img id="resultImg" src="${url}" alt="generated">
    <div class="res-meta">
      <span>${esc(cfg.provider)} · ${esc(cfg.model || "-")} · ${cfg.width}×${cfg.height} · seed ${cfg.seed}` +
      `${cfg.references.length ? " · " + esc(t("gen.refsCount", state.lang).replace("%d", cfg.references.length)) : ""}</span>
    </div>
    <div class="row-btns">
      <a class="btn sm" id="dlBtn" download="${Date.now()}.png" href="${url}">${esc(t("gen.download", state.lang))}</a>
      <button class="btn sm" type="button" id="regen">${esc(t("gen.regen", state.lang))}</button>
    </div>`;
  $("#regen").onclick = () => { $("#seed").value = Math.floor(Math.random() * 1e6); run(); };
}

/* ============================================================ 图库（IndexedDB） */
const DB = "pcg.gallery";
function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore("shots", { keyPath: "id" }); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function saveToGallery(blob, cfg) {
  try {
    const db = await openDB();
    const rec = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      blob, prompt: cfg.prompt, provider: cfg.provider, model: cfg.model,
      seed: cfg.seed, refs: cfg.references.map(r => r.role), time: Date.now(),
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("shots", "readwrite");
      tx.objectStore("shots").put(rec);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn("图库保存失败", e); }
}
async function listShots() {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const rq = db.transaction("shots", "readonly").objectStore("shots").getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    });
  } catch { return []; }
}
async function delShot(id) {
  const db = await openDB();
  await new Promise(res => {
    const tx = db.transaction("shots", "readwrite");
    tx.objectStore("shots").delete(id);
    tx.oncomplete = res;
  });
}
async function clearShots() {
  const db = await openDB();
  await new Promise(res => {
    const tx = db.transaction("shots", "readwrite");
    tx.objectStore("shots").clear();
    tx.oncomplete = res;
  });
}

async function renderGallery() {
  const shots = (await listShots()).sort((a, b) => b.time - a.time);
  $("#galCount").textContent = shots.length ? t("gal.count", state.lang).replace("%d", shots.length) : "";
  const g = $("#galGrid");
  if (!shots.length) { g.innerHTML = `<div class="empty">${esc(t("gal.empty", state.lang))}</div>`; return; }
  g.innerHTML = shots.map(s => {
    const url = URL.createObjectURL(s.blob);
    return `<figure class="shot" data-id="${esc(s.id)}">
      <img src="${url}" alt="" loading="lazy">
      <figcaption>
        <span class="sh-p">${esc((s.prompt || "").slice(0, 90))}</span>
        <span class="sh-m">${esc(s.provider)} · ${esc(s.model || "-")} · seed ${s.seed}` +
          `${s.refs && s.refs.length ? " · " + esc(s.refs.join("+")) : ""}</span>
        <span class="sh-a">
          <a href="${url}" download="${s.id}.png">${esc(t("gal.dl", state.lang))}</a>
          <button type="button" data-use="${esc(s.id)}">${esc(t("gal.use", state.lang))}</button>
          <button type="button" data-del="${esc(s.id)}">${esc(t("gal.del", state.lang))}</button>
        </span>
      </figcaption>
    </figure>`;
  }).join("");
}

/* ============================================================ 事件 */
function bind() {
  $$(".lang button").forEach(b => b.onclick = () => setLang(b.dataset.lang));

  $("#poseSearch").oninput = e => { state.filters.pose.q = e.target.value.trim(); renderPose(); };
  $("#costumeSearch").oninput = e => { state.filters.costume.q = e.target.value.trim(); renderCostume(); };
  $("#poseSeries").onchange = e => { state.filters.pose.series = e.target.value; renderPose(); };
  $("#poseAngle").onchange = e => { state.filters.pose.angle = e.target.value; renderPose(); };
  $("#costumeCat").onchange = e => { state.filters.costume.cat = e.target.value; renderCostume(); };

  document.addEventListener("click", async e => {
    const pp = e.target.closest("[data-pose]");
    if (pp) {
      const id = pp.dataset.pose;
      state.sel.pose = state.sel.pose && state.sel.pose.id === id ? null : state.pose.find(x => x.id === id);
      renderPicked(); renderRefs(); return;
    }
    const cc = e.target.closest("[data-costume]");
    if (cc) {
      const id = cc.dataset.costume;
      state.sel.costume = state.sel.costume && state.sel.costume.id === id ? null : state.costume.find(x => x.id === id);
      renderPicked(); renderRefs(); return;
    }
    const cl = e.target.closest("[data-clear]");
    if (cl) {
      if (cl.dataset.clear === "pose") state.sel.pose = null;
      else state.sel.costume = null;
      renderPicked(); renderRefs(); return;
    }
    const rd = e.target.closest("[data-refdel]");
    if (rd) {
      if (rd.dataset.refdel === "person") { state.person = null; renderRefs(); autoPrompt(); }
      return;
    }
    const mb = e.target.closest("[data-more]");
    if (mb) { mb.dataset.more === "pose" ? appendPose() : appendCostume(); return; }
    const dl = e.target.closest("[data-del]");
    if (dl) { await delShot(dl.dataset.del); renderGallery(); return; }
    const us = e.target.closest("[data-use]");
    if (us) {
      const shots = await listShots();
      const s = shots.find(x => x.id === us.dataset.use);
      if (s) { $("#prompt").value = s.prompt; $("#prompt").focus(); }
      return;
    }
  });

  $("#provider").onchange = e => {
    const p = PROVIDERS[e.target.value];
    state.cfg.provider = e.target.value;
    state.cfg.endpoint = p.defaultEndpoint;
    state.cfg.model = p.models[0] || "";
    applyProvider();
  };
  $("#endpoint").oninput = e => { state.cfg.endpoint = e.target.value; saveCfg(); updateLocalWarn(); };
  $("#apikey").oninput = e => { state.cfg.apiKey = e.target.value; saveCfg(); };
  $("#model").oninput = e => { state.cfg.model = e.target.value; saveCfg(); };
  $("#negprompt").oninput = e => { state.cfg.negative = e.target.value; saveCfg(); };
  $("#seed").oninput = e => { state.cfg.seed = e.target.value; saveCfg(); };
  $("#reseed").onclick = () => { $("#seed").value = Math.floor(Math.random() * 1e6); };

  // 尺寸快捷键
  $$("#sizeChips button").forEach(b => b.onclick = () => { $("#size").value = b.dataset.size; });
  $("#size").oninput = () => state.cfg.size = $("#size").value;

  // 快捷预设
  $("#presetLocal").onclick = () => {
    state.cfg.provider = "openai";
    state.cfg.endpoint = "http://127.0.0.1:8045/v1";
    state.cfg.apiKey = "sk-antigravity";
    state.cfg.model = "gemini-3.1-flash-image";
    renderProviders(); applyProvider();
    $("#note-slow") && ($("#note-slow").hidden = false);
    updateLocalWarn();
  };
  $("#presetOpenAI").onclick = () => {
    state.cfg.provider = "openai";
    state.cfg.endpoint = "https://api.openai.com/v1";
    state.cfg.apiKey = state.cfg.apiKey && state.cfg.apiKey !== "sk-antigravity" ? state.cfg.apiKey : "";
    state.cfg.model = "gpt-image-1";
    renderProviders(); applyProvider();
    updateLocalWarn();
  };

  // 读取模型列表
  $("#loadModels").onclick = async () => {
    const btn = $("#loadModels");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "…";
    try {
      const ids = await fetchModels($("#endpoint").value.trim(), $("#apikey").value.trim());
      $("#modelList").innerHTML = ids.map(m => `<option value="${esc(m)}">`).join("");
      const count = ids.length;
      btn.textContent = t("gen.modelsLoaded", state.lang).replace("%d", count);
      setTimeout(() => { btn.textContent = old; }, 2200);
    } catch (e) {
      btn.textContent = t("gen.modelsFail", state.lang).replace("%s", String(e.message || e)).slice(0, 40);
      setTimeout(() => { btn.textContent = old; }, 3000);
    } finally { btn.disabled = false; }
  };

  $("#autoPrompt").onclick = () => { autoPrompt(); $("#prompt").value = state.lastPrompt; };
  $("#copyPrompt").onclick = async () => {
    try { await navigator.clipboard.writeText($("#prompt").value); } catch {}
  };
  $("#runBtn").onclick = run;

  $("#addPerson").onclick = () => $("#personInput").click();
  $("#personInput").onchange = e => {
    const f = [...e.target.files].find(x => x.type.startsWith("image/"));
    if (f) setPerson(f);
    e.target.value = "";
  };

  $("#galClear").onclick = async () => { await clearShots(); renderGallery(); };
}

/* ============================================================ 启动 */
bind();
renderProviders();
applyProvider();
$("#seed").value = state.cfg.seed;
if (state.cfg.size) $("#size").value = state.cfg.size;
$("#negprompt").value = state.cfg.negative || DEFAULT_NEGATIVE;
setLang(state.lang);
loadData();
renderGallery();
})();
