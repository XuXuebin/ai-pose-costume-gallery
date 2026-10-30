/* 条件包（Conditioning Pack）构建器
 *
 * 把「姿势 + 服装 + 人像」的选图结果，翻译成能直接进管线的交接件：
 *   pack.json              全部元数据（来源、角色、URL、模型建议、种子）
 *   comfyui-workflow.json  ComfyUI API 格式工作流（openpose + depth 双 ControlNet）
 *   a1111-prompt.txt       A1111 / Forge 可直接粘贴的提示词
 *   fetch-references.sh    把参考图抓到 ComfyUI 的 input 目录
 *   README.txt             用法说明
 */
(function () {

  /* 各角色在管线里的落点 */
  const ROLE_SPEC = {
    "pose-lineart": {
      label: { zh: "姿势线稿", en: "Pose line art", ja: "ポーズ線画" },
      library: "POSE-DB-01",
      controlnet: "openpose",
      weights: {
        "SD 1.5": "control_v11p_sd15_openpose.pth",
        "SDXL":   "control-lora-openposeXL-rank256.safetensors",
      },
      note: "openpose 控制骨架姿态；若线稿线条更干净也可换 control_v11p_sd15_lineart",
    },
    "pose-depth": {
      label: { zh: "姿势深度图", en: "Pose depth map", ja: "ポーズ深度マップ" },
      library: "POSE-DB-02",
      controlnet: "depth",
      weights: {
        "SD 1.5": "control_v11f1p_sd15_depth.pth",
        "SDXL":   "control-lora-depth-rank256.safetensors",
      },
      note: "近=白 远=黑，与 MiDaS/ControlNet 深度惯例一致，无需反相；SDXL 也可用 xinsir/controlnet-depth-sdxl-1.0",
    },
    "costume": {
      label: { zh: "服装参考", en: "Costume reference", ja: "衣装参考" },
      library: "COSTUME-DB-01",
      controlnet: "ip-adapter",
      weights: {
        "SD 1.5": "ip-adapter_sd15.bin",
        "SDXL":   "ip-adapter_sdxl_vit-h.safetensors",
      },
      note: "用 IP-Adapter (reference-only) 或 T2I-Adapter 锁服装；本仓库不生成带此节点的图，因为节点名随插件而变",
    },
    "person": {
      label: { zh: "人像参考", en: "Person reference", ja: "人物参考" },
      library: "本地上传",
      controlnet: "ip-adapter-face",
      weights: {
        "SD 1.5": "ip-adapter-faceid_sd15.bin",
        "SDXL":   "ip-adapter-faceid-plusv2_sdxl.bin",
      },
      note: "用 IP-Adapter FaceID / InstantID / PuLID 锁人脸；节点随插件而变，故只给建议不写进工作流",
    },
  };

  function filenameFor(ref) {
    const role = ref.role;
    const base = (ref.name || ref.id || "ref").replace(/[^\w.-]+/g, "_");
    const ext = (ref.name && /\.(png|jpe?g|webp)$/i.test(ref.name)) ? "" : ".png";
    return `pcg_${role}_${base}${ext}`;
  }

  /* ---------------- ComfyUI API 格式工作流 ---------------- */
  function comfyWorkflow(refs, prompt, negative, seed, w, h) {
    const byRole = {};
    refs.forEach(r => { byRole[r.role] = r; });

    const nodes = {};
    let id = 1;
    const nid = () => String(id++);

    const ckpt = nid();
    nodes[ckpt] = {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "替换为你的模型.safetensors" },
      _meta: { title: "① 基础模型" },
    };

    const clip = nid();
    nodes[clip] = { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: [ckpt, 1] }, _meta: { title: "正向提示词" } };
    const clipNeg = nid();
    nodes[clipNeg] = { class_type: "CLIPTextEncode", inputs: { text: negative || "", clip: [ckpt, 1] }, _meta: { title: "负向提示词" } };
    const latent = nid();
    nodes[latent] = { class_type: "EmptyLatentImage", inputs: { width: w, height: h, batch_size: 1 }, _meta: { title: "画布" } };

    let cond = [clip, 0];
    const cnNodes = [];
    for (const role of ["pose-lineart", "pose-depth"]) {
      const ref = byRole[role];
      if (!ref) continue;
      const spec = ROLE_SPEC[role];
      const imgId = nid();
      nodes[imgId] = {
        class_type: "LoadImage",
        inputs: { image: filenameFor(ref) },
        _meta: { title: `载入 ${spec.label.zh}` },
      };
      const cnId = nid();
      nodes[cnId] = {
        class_type: "ControlNetLoader",
        inputs: { control_net_name: spec.weights["SD 1.5"] },
        _meta: { title: `ControlNet · ${spec.controlnet}` },
      };
      const applyId = nid();
      nodes[applyId] = {
        class_type: "ControlNetApplyAdvanced",
        inputs: {
          positive: cond, negative: [clipNeg, 0], image: [imgId, 0],
          strength: 1.0, start_percent: 0.0, end_percent: 1.0,
        },
        _meta: { title: `施加 ${spec.controlnet}` },
      };
      cond = [applyId, 0];
      cnNodes.push({ role, imgId, cnId, applyId, spec });
    }

    const sampler = nid();
    nodes[sampler] = {
      class_type: "KSampler",
      inputs: {
        seed, steps: 28, cfg: 6.5, sampler_name: "dpmpp_2m", scheduler: "karras",
        denoise: 1.0, model: [ckpt, 0], positive: cond, negative: [clipNeg, 0], latent_image: [latent, 0],
      },
      _meta: { title: "采样" },
    };
    const vae = nid();
    nodes[vae] = { class_type: "VAEDecode", inputs: { samples: [sampler, 0], vae: [ckpt, 2] }, _meta: { title: "解码" } };
    const save = nid();
    nodes[save] = { class_type: "SaveImage", inputs: { filename_prefix: "pcg_out", images: [vae, 0] }, _meta: { title: "保存" } };

    return {
      _meta: { title: "姿势×服装 条件工作流（API 格式）" },
      _warnings: [
        "⚠️ 本工作流是模板，尚未在真实 ComfyUI 实例上跑通验证，请自行测试后再用于正式出图。",
        "⚠️ CheckpointLoader 的 ckpt_name 是占位符，必须换成你自己已安装的模型。",
        "⚠️ ControlNetLoader 的权重名按 SD1.5 给出；用 SDXL/Flux 需换成对应权重。",
        "⚠️ LoadImage 的文件名依赖 fetch-references.sh 抓下来的文件名，改过名字就对不上。",
        "⚠️ 服装 / 人像参考走 IP-Adapter，节点名随插件而变，故未写进图里，需自行接入。",
      ],
      nodes,
      _notes: {
        howto: "ComfyUI → 工作流 → 打开(API) / 或直接 POST 到 /prompt；先跑 fetch-references.sh 把参考图放进 input/；再把 CheckpointLoader 的模型名换成你自己的。",
        controlnets: cnNodes.map(c => ({ role: c.role, node: c.applyId, net: c.spec.controlnet, weights: c.spec.weights })),
        omitted: ["costume", "person"].filter(r => byRole[r]).map(r => ({
          role: r, why: "IP-Adapter / FaceID 节点名随插件而变，请按 README 自行接入",
        })),
      },
    };
  }

  /* ---------------- A1111 / Forge 提示词 ---------------- */
  function a1111Text(refs, prompt, negative, seed, w, h) {
    const lines = [];
    lines.push("# 姿势×服装 条件包 · A1111 / Forge 提示词");
    lines.push("");
    lines.push("## 正向提示词");
    lines.push(prompt || "(空)");
    lines.push("");
    lines.push("## 负向提示词");
    lines.push(negative || "(空)");
    lines.push("");
    lines.push("## 参数");
    lines.push(`Size: ${w}, ${h}`);
    lines.push(`Seed: ${seed}`);
    lines.push("");
    lines.push("## ControlNet 单元（按顺序叠加）");
    let i = 1;
    for (const r of refs) {
      const spec = ROLE_SPEC[r.role];
      if (!spec) continue;
      if (r.role === "costume" || r.role === "person") {
        lines.push(`# ${i}. ${spec.label.zh} → 用 IP-Adapter 载入 ${spec.weights["SD 1.5"]}（${spec.weights["SDXL"]} for SDXL）`);
        lines.push(`#    ${spec.note}`);
      } else {
        lines.push(`${i}. ${spec.label.zh} → ControlNet ${spec.controlnet}：${spec.weights["SD 1.5"]}（${spec.weights["SDXL"]} for SDXL）`);
        lines.push(`   ${spec.note}`);
      }
      i++;
    }
    lines.push("");
    lines.push("## 参考图文件");
    for (const r of refs) {
      lines.push(`- ${filenameFor(r)}  ←  ${r.url || "(本地文件)"}`);
    }
    return lines.join("\n");
  }

  /* ---------------- fetch 脚本 ---------------- */
  function fetchScript(refs) {
    const lines = [
      "#!/usr/bin/env bash",
      "# 把参考图抓到 ComfyUI / A1111 的 input 目录",
      "# 用法: COMFY_IN=/path/to/ComfyUI/input bash fetch-references.sh",
      'set -euo pipefail',
      'IN="${COMFY_IN:-./input}"',
      'mkdir -p "$IN"',
      "",
    ];
    for (const r of refs) {
      if (!r.url) continue;
      lines.push(`curl -fL --retry 3 -o "$IN/${filenameFor(r)}" "${r.url}"`);
    }
    lines.push("");
    lines.push('echo "完成 → $IN"');
    return lines.join("\n");
  }

  /* ---------------- README ---------------- */
  function readmeText(refs) {
    return [
      "姿势 × 服装 条件包 (Conditioning Pack)",
      "======================================",
      "",
      "由 ai-pose-costume-gallery 的工作台导出。",
      "",
      "内容",
      "----",
      "  pack.json              全部元数据：每个参考图的角色、来源库、原始 URL、模型建议、种子",
      "  comfyui-workflow.json  ComfyUI API 格式工作流（openpose + depth 双 ControlNet）",
      "  a1111-prompt.txt       A1111 / Forge 可直接粘贴的提示词与参数",
      "  fetch-references.sh    下载参考图到本地 input 目录",
      "",
      "⚠️ 重要：本包未经真实 ComfyUI 验证",
      "--------------------------------------",
      "  comfyui-workflow.json 是按 ComfyUI 官方 API 格式生成的**模板**，",
      "  从未在真实 ComfyUI 实例上跑通。请把它当作起点，自己测一遍再用。",
      "",
      "  已知需要你确认/修改的点：",
      "    · CheckpointLoader 的 ckpt_name 是占位符，必须换成你已装的模型",
      "    · ControlNetLoader 权重名按 SD 1.5 给（openpose / depth）；",
      "      用 SDXL 请换成 control-lora-*-rank256 系列或 xinsir 的 SDXL 权重",
      "    · LoadImage 的文件名与 fetch-references.sh 抓下来的文件名一一对应，",
      "      改过名字就会载入失败",
      "    · 服装 / 人像参考走 IP-Adapter（节点名随插件而变），本包未含这些节点",
      "    · 深度图极性已实测为 近=白/远=黑（与 MiDaS/ControlNet 惯例一致），",
      "      但你用的具体 ControlNet 权重是否一致，仍需你跑一次确认",
      "",
      "  自测清单（逐条打勾再用）：",
      "    [ ] bash fetch-references.sh 后，input/ 里能看到全部参考图",
      "    [ ] ComfyUI 能载入工作流且没有红色缺节点",
      "    [ ] 只开 openpose 一路，生成图的骨架与参考姿势一致",
      "    [ ] 再开 depth 一路，空间关系（前后遮挡）没有反转",
      "    [ ] 服装参考接入 IP-Adapter 后，衣服与参考图接近",
      "    [ ] 人像参考接入 FaceID 后，脸与参考图接近",
      "",
      "怎么用",
      "----",
      "  1) bash fetch-references.sh          # 把参考图抓到 ComfyUI/input",
      "  2) ComfyUI 载入 comfyui-workflow.json（工作流 → 打开，或 POST 到 /prompt）",
      "  3) 把 CheckpointLoader 的模型名换成你自己的",
      "  4) 服装 / 人像参考需自行接 IP-Adapter（节点名随插件而变，见 a1111-prompt.txt）",
      "  5) 按上面的自测清单逐条确认，再投入正式使用",
      "",
      "参考图角色",
      "--------",
      ...refs.map(r => {
        const spec = ROLE_SPEC[r.role];
        return `  ${spec ? spec.label.zh : r.role} (${r.role})  ← ${r.library || ""}  ${r.id || ""}`;
      }),
      "",
      "重要提示",
      "--------",
      "  · 深度图极性为 近=白 / 远=黑，与 MiDaS / ControlNet 惯例一致，直接用，不要反相",
      "  · 素材版权归原作者 ギア（@giaaibusi）所有；免费用于作品创作、无需署名，",
      "    但禁止再分发图片本身，深度集另禁止一次性批量下载",
      "  · 姿势集与深度集是同一批 288 组姿势 × 5 角度的两种渲染，ID 严格对应",
      "",
    ].join("\n");
  }

  /* ---------------- 主入口 ---------------- */
  function buildPack(opts) {
    const { refs, prompt, negative, seed, width, height, provider, model } = opts;
    const files = [];

    const meta = {
      schema: 1,
      generatedAt: new Date().toISOString(),
      generator: "ai-pose-costume-gallery studio",
      verified: false,
      verification: {
        assets: "已验证：线稿/深度 ID 与元数据逐条一致；深度极性实测 近=白/远=黑（tools/verify_library.py）",
        workflow: "未验证：ComfyUI 工作流为模板，尚未在真实 ComfyUI 实例上跑通，请自行测试",
        checklist: "见 README.txt 的「自测清单」",
      },
      provider: { id: provider, model },
      generation: { prompt, negativePrompt: negative, seed, width, height },
      sources: {
        "pose-lineart": { db: "POSE-DB-01", origin: "https://ai-pose-gallery.pages.dev/" },
        "pose-depth": { db: "POSE-DB-02", origin: "https://ai-pose-depth-gallery.pages.dev/" },
        "costume": { db: "COSTUME-DB-01", origin: "https://ai-costume-gallery.pages.dev/" },
        "person": { db: "本地上传", origin: null },
      },
      depthSpec: { polarity: "near=white, far=black", controlnet: "MiDaS / ControlNet 惯例，直接使用无需反相" },
      references: refs.map(r => {
        const spec = ROLE_SPEC[r.role] || {};
        return {
          role: r.role,
          label: spec.label || null,
          library: spec.library || null,
          id: r.id || null,
          note: spec.note || null,
          controlnet: spec.controlnet || null,
          weights: spec.weights || null,
          file: filenameFor(r),
          url: r.url || null,
          local: !!r.file,
          dimensions: r.dimensions || null,
        };
      }),
    };
    files.push({ name: "pack.json", data: JSON.stringify(meta, null, 2) });
    files.push({ name: "comfyui-workflow.json", data: JSON.stringify(comfyWorkflow(refs, prompt, negative, seed, width, height), null, 2) });
    files.push({ name: "a1111-prompt.txt", data: a1111Text(refs, prompt, negative, seed, width, height) });
    files.push({ name: "fetch-references.sh", data: fetchScript(refs) });
    files.push({ name: "README.txt", data: readmeText(refs) });
    return { files, meta };
  }

  window.Pipeline = { buildPack, ROLE_SPEC, filenameFor };
})();
