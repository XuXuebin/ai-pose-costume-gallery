<div align="center">

# Pose × Costume Studio
### POSE-DB-01 × COSTUME-DB-01 · Studio

**[中文](README.md) · [日本語](README.ja.md)**

Pick a pose · Pick a costume · Configure an image API · Generate and save

</div>

---

## What is this

Two Japanese AI-art reference libraries — the **pose library** and the **costume library** — merged
into one place, plus a **unified studio**: choose a pose on the left, an outfit on the right, upload
a photo of the character you want, then **all three images are sent to the image API together for
image-to-image generation**. Hit generate and the result lands straight in a local gallery in your
browser.

| | Content | Count |
|---|---|---|
| 🧍 **Pose library** POSE-DB-01 | Faceless grey mannequin **line art** (3:4), 5 angles per pose | 288 poses / **1,439 images** |
| 🕳️ **Depth library** POSE-DB-02 | **Depth maps** of the very same poses (3:4), image-for-image with the line art | 288 poses / **1,439 images** |
| 👗 **Costume library** COSTUME-DB-01 | Outfit-only photos with no person (2:3), 8 categories | **1,407 outfits** |
| 🎨 **Unified studio** | Pose line art + pose depth + costume + person → img2img / conditioning-pack export | 4 providers |

Interface language: **Chinese / English / 日本語**, switchable at any time.

---

## Three libraries, one conditioning pipeline

These are not three unrelated albums — they are **three conditioning signals for the same pipeline**:

| Role | Library | Where it lands in the pipeline |
|---|---|---|
| Pose | POSE-DB-01 line art | ControlNet **openpose** / lineart / scribble |
| Depth | POSE-DB-02 depth maps | ControlNet **depth** |
| Costume | COSTUME-DB-01 outfit photos | IP-Adapter / T2I-Adapter reference |
| Person | your upload | IP-Adapter FaceID / InstantID / PuLID |

**The key fact: the pose library and the depth library are the same 288 poses × 5 angles, rendered
two different ways.** Their ID sets, ordering, pose numbers, angles, categories and pose names
match **entry for entry** — and that is machine-verifiable (see the verification tool below), not
just "they look similar". So picking one pose in the studio fills **both** the line-art slot and
the depth slot at once, giving you a ready-to-use openpose + depth condition pair.

### Measured properties of the depth maps

| Property | Measured value |
|---|---|
| Format | 8-bit grayscale PNG, 900×1200 |
| Polarity | **near = white, far = black** |
| Evidence | torso mean 138.3 > background mean 59.8 (97% of 60 samples); A/B test: line-art ink lands in the bright region 0.702 vs 0.292 in the dark region |
| Conclusion | Matches the **MiDaS / ControlNet depth convention** — usable directly as a depth condition, **no inversion needed** |
| Provenance | Rendered from a 3D mannequin (not estimated from the line art), which is why it aligns pixel-for-pixel with the line art |

> A flipped polarity is the classic silent failure with assets like these — images still generate,
> but the spatial relationships come out inverted. So this conclusion is **measured**, not copied.

### Exporting a conditioning pack

Once you have your picks, click **"Export conditioning pack (ComfyUI / A1111)"** and get a zip:

```
conditioning-pack.zip
├── pack.json              metadata: role / source library / original URL / model hints / seed
├── comfyui-workflow.json  ComfyUI API-format workflow (openpose + depth ControlNets wired up)
├── a1111-prompt.txt       paste-ready A1111 / Forge prompt and parameters
├── fetch-references.sh    pull the reference images into ComfyUI's input directory
└── README.txt             how to use it
```

The workflow already chains `LoadImage → ControlNetLoader → ControlNetApplyAdvanced` (one branch
per pose channel) into `KSampler → VAEDecode → SaveImage`. Costume and person go through
IP-Adapter, whose node names change per plugin, so those ship as weight recommendations
(one set for SD 1.5, one for SDXL) instead of being baked into the graph.

> ⚠️ **This ComfyUI workflow is a template. It has never been run on a real ComfyUI instance.**
> It follows ComfyUI's official API format, but `ckpt_name` is a placeholder, the ControlNet
> weight names assume SD 1.5, and the IP-Adapter nodes are omitted because their names vary
> by plugin. **Please test it yourself before relying on it** — the exported `README.txt`
> includes a step-by-step self-test checklist (do the references land in `input/` → does the
> workflow load with no missing nodes → does the openpose branch alone reproduce the skeleton
> → does adding depth flip the occlusion or not → do the costume/person references land).
> The *assets* are verified (pairing, polarity, outliers — see below); the *pipeline* is not.

### Verification: what proves the result is correct besides me and you

`tools/verify_library.py` turns every claim above into a **reproducible assertion that can run in CI**:

```bash
python3 tools/verify_library.py            # offline: manifest / pairing / polarity / outliers / pages
python3 tools/verify_library.py --sample 200 --online   # + pixel sampling and sha256 spot-checks
```

Current result: **15 checks pass, 0 failures** — including identical ID sets, identical ordering,
entry-for-entry identical metadata, every pose carrying its depth channel, the A/B polarity
discriminator, no 3σ outliers in subject area for any of the four series, and no leftover links on
any of the three pages.

---

## Demo

![Unified studio: three-column workbench](docs/demo-studio.webp)

*Three columns: **① pick a pose** → **② pick a costume** → **③ reference images & provider***

<table>
  <tr>
    <td width="56%" valign="top"><img src="docs/demo-refs.webp" alt="Reference image slots" width="520"></td>
    <td width="20%" valign="top"><img src="docs/demo-result.webp" alt="Generated result" width="200"></td>
    <td width="24%" valign="top">
      <b>Reference slots</b><br>
      Order is the meaning: <b>1 = pose</b>, <b>2 = costume</b>, <b>3 = person</b> — all three are sent to the API together.<br><br>
      <b>Generated result</b><br>
      The posture comes from reference 1, the outfit from reference 2.
    </td>
  </tr>
</table>

---

## Quick start

### Local preview

`index.html` in the repository root is the studio; `galleries/` holds the two standalone libraries.

```bash
git clone https://github.com/XuXuebin/ai-pose-costume-gallery.git
cd ai-pose-costume-gallery
python3 -m http.server 8899
# open http://127.0.0.1:8899/
```

> ⚠️ Use **`127.0.0.1`**, not `localhost`: Pollinations rejects requests whose `Origin` is
> `localhost` (HTTP 403). The two gallery pages themselves also work when opened directly
> from disk with `file://`.

> 📌 **Images are not stored in this repository.** Every image is loaded straight from the
> original sites (the pose library from `ai-pose-gallery.pages.dev`, the costume library from
> `ai-costume-gallery.pages.dev`). The whole repository is therefore only about **2.5 MB** and
> GitHub Pages deploys almost instantly — the trade-off is that those two hosts must be
> reachable.

### Deploy to GitHub Pages

`.github/workflows/pages.yml` is included, so a push is all it takes:

```bash
git init && git add . && git commit -m "feat: pose x costume studio"
git branch -M main
git remote add origin git@github.com:XuXuebin/ai-pose-costume-gallery.git
git push -u origin main
```

Then go to **Settings → Pages → Source → GitHub Actions**.

> 🟢 **This repository is live** (deployed automatically by GitHub Actions):
> **Studio** https://xuxuebin.github.io/ai-pose-costume-gallery/
> **Pose library** https://xuxuebin.github.io/ai-pose-costume-gallery/galleries/pose/
> **Costume library** https://xuxuebin.github.io/ai-pose-costume-gallery/galleries/costume/

Cloudflare Pages / object storage / Nginx work too — there is no build step; the repository root
*is* the publish directory.

---

## Using the studio

```
① Pick a pose  →  ② Pick a costume  →  ③ References + provider  →  Generate  →  Saved to gallery
```

1. **Pose** — filter by series (4), angle (5) or category, or search by ID / pose name.
   The mannequin line art you pick **becomes reference image 1 automatically**.
2. **Costume** — filter by category (8), or search by ID / keyword (Chinese *and* English work).
   The outfit photo you pick **becomes reference image 2 automatically**.
3. **Upload a person reference** — drop the character's face into the third slot (optional)
   → **reference image 3**.
4. **Provider** — pick one of four image APIs and fill in the form; it works straight away.
5. **Generate** — the image appears in place and can be downloaded as PNG. It is **also saved into
   your local gallery** (IndexedDB), so it survives a page reload.
6. **Gallery** — reuse a prompt, download, delete, or clear. Images live only in your own browser
   and are **never uploaded**.

### How the reference images reach the API

The three images are sent **in slot order**, and the prompt refers to them as
"Reference image 1 / 2 / 3":

| Slot | Source | File actually sent | Purpose |
|---|---|---|---|
| 1 — pose | pose library | `原图` (900×1200 PNG) | posture, limbs, composition |
| 2 — costume | costume library | `图像` (1366×2048 WebP) | clothing, colours, materials |
| 3 — person | your upload | the original file | face, hairstyle, appearance |

Both original galleries send `Access-Control-Allow-Origin: *`, so the browser can **fetch the image
bytes cross-origin** and convert them into whatever the API needs (multipart files / base64) —
without putting any image into this repository.

### Local Antigravity proxy (recommended)

If you run the Antigravity OpenAI-compatible proxy locally (default `http://127.0.0.1:8045/v1`),
click **Quick presets → Local Antigravity proxy** to fill everything in:

```
Endpoint    http://127.0.0.1:8045/v1
API key     sk-antigravity
Model       gemini-3.1-flash-image
Quality     hd
```

- **Load models** calls `GET /v1/models` and fills the suggestions with whatever the proxy exposes
  (23 models on this machine).
- **Size** accepts any `WIDTHxHEIGHT` (the proxy derives the aspect ratio itself); 1:1 / 2:3 / 3:4 /
  16:9 quick chips sit next to it.
- Reference images are downscaled to 896 px on the long edge and re-encoded as JPEG in the browser
  (line art 400 KB → 61 KB), which makes uploads much faster.

> ⚠️ **Two things measured in practice**
> 1. The hosted Pages site is **https**, so the browser applies **Private Network Access** to
>    `http://127.0.0.1` and blocks it. To use a local proxy, open the page from a **local preview**:
>    `python3 -m http.server 8899` → `http://127.0.0.1:8899/`.
>    The interface detects a local endpoint and says so.
> 2. The proxy's account pool contains **region-locked** accounts that randomly answer
>    `User location is not supported for the API use.`, and **three** reference images can hang for
>    a long time. In practice **two (pose + costume) is the most reliable**, taking ~60–90 s.
>    The UI has an 180 s timeout with a live timer, and a "another one" button to retry.

### Four image providers

| Provider | Key | Multi-reference | Notes |
|---|---|---|---|
| **Pollinations** | none | ✗ | Text-to-image only. Works directly from the browser; images are produced by a third-party service |
| **OpenAI-compatible** | required | ✓ | `POST /v1/images/edits` — all three images go out as `image[]` in one multipart request. Most vendors do not allow CORS — if you hit a CORS error, point the endpoint field at your own proxy |
| **Google Gemini** | required | ✓ | `generateContent` — the three images go out as base64 `inline_data` parts, several images per call |
| **Custom URL** | optional | ✓ | `POST` JSON: `{prompt, images:[{role,name,data_url}], width, height, seed, model}` |

If you pick a provider that cannot take reference images, the interface **explicitly warns** that
only the text prompt will be used.

Endpoint, key, model and seed are kept in browser `localStorage` and **never sent to a server**.
On a shared machine, clear your site data afterwards.

### The prompt is assembled for you

Once the references are set, the prompt is combined into English phrasing that image models
actually understand:

```
Outfit details: cream blouse ribbon ivory mini skirt shorts jacket beige tights.
Reference image 1 is the POSE and body posture to reproduce exactly.
Reference image 2 is the OUTFIT to put on the character, keep the same clothing, colors and materials.
Reference image 3 is the CHARACTER: keep the same face, hairstyle and overall appearance.
Generate a full-body character illustration that keeps the pose from the pose reference,
the outfit from the costume reference, the face of the person reference.
Single character, clean plain background, studio lighting, high quality, detailed fabric texture, natural proportions.
```

Every Chinese pose term (category / angle / series) has an English counterpart in
`tools/pose_terms.json`; edit that table and re-sync to change the wording. The prompt stays
fully editable, and the default negative prompt includes `nudity, explicit, nsfw`.

---

## Repository layout

```
ai-pose-costume-gallery/
├── index.html              ★ Unified studio (GitHub Pages entry point)
├── studio/
│   ├── studio.css          Studio styles
│   ├── i18n.js             Chinese / English / Japanese strings
│   ├── generator.js        Image API layer (Pollinations / OpenAI / Gemini / custom)
│   ├── pipeline.js         Conditioning-pack builder (ComfyUI workflow + A1111 prompt + metadata)
│   ├── zip.js              Dependency-free ZIP writer
│   └── studio.js           Picking, channel switching, generation, export, gallery logic
├── galleries/
│   ├── pose/index.html     Pose library (line art, with A4 print layout)
│   ├── depth/index.html    Depth library (depth maps)
│   └── costume/index.html  Costume library
│                            ↑ every image path points at the original sites
├── data/
│   ├── manifest.json       Manifest of all three libraries: origin / terms / counts / depth spec / pairing
│   ├── pose.json           Pose data (already paired with its depth channel)
│   ├── pose-depth.json     Depth data
│   └── costume.json        Costume data
├── docs/                   Demo images (used by this README)
│   ├── demo-studio.webp    Full three-column workbench
│   ├── demo-refs.webp      Close-up of the reference slots
│   └── demo-result.webp    Example generated result
├── tools/
│   ├── sync.py             Sync from the three source libraries → galleries/ and data/
│   ├── pose_terms.json     English glossary for pose terms
│   ├── fetch_originals.py  Download original-size PNGs on demand (offline use)
│   ├── verify_library.py   ★ Three-library consistency check (pairing / polarity / outliers / sha256)
│   └── verify.py           Data and path integrity check
├── .github/workflows/pages.yml   GitHub Pages deployment
├── NOTICE.md               Asset copyright and original sources
├── LICENSE                 MIT (code)
└── README.md / README.en.md / README.ja.md
```

### Re-syncing the assets

`galleries/` and `data/` are **generated** from the two source projects:

```bash
python3 tools/sync.py                # sync (needs ../ai-pose-gallery and ../ai-costume-gallery)
python3 tools/sync.py --local-assets # also copy the images in (~237 MB, self-contained offline build)
python3 tools/verify.py              # check record counts / fields / path references / the three READMEs
```

Images are not synced by default — absolute origin URLs are written into the pages and data.
Use `--local-assets` for a **fully self-contained build that does not depend on the original
sites**: pose originals are converted to WebP (900×1200) locally, while the "download original
PNG" button still points at the origin site.

---

## How this differs from the original sites

**In exactly one way: the images are not stored in the repository — they are referenced from the
original sites.**

The originals total roughly 2.1 GB, which would make the repository and the Pages deployment
painfully heavy. Referencing the origin URLs instead keeps the repository at about 2.5 MB, so
cloning and deploying are instantaneous. The trade-off: images stop loading if the original hosts
are unreachable.

For an offline or self-contained build, run `python3 tools/sync.py --local-assets`, or pull
original-size PNGs on demand with `python3 tools/fetch_originals.py`.

Feature-wise, apart from the added unified studio, both galleries behave exactly like the
originals: browsing, filtering, search, lightbox, **A4 print layout** and
"download original PNG" all work the same way.

---

## Credits and sources

**Original author: ギア（@giaaibusi）** — https://x.com/giaaibusi

| Original site | Link |
|---|---|
| Pose library POSE-DB-01 | https://ai-pose-gallery.pages.dev/ |
| Costume library COSTUME-DB-01 | https://ai-costume-gallery.pages.dev/ |

This repository is an **unofficial Chinese-localised merge** and is not affiliated with the
original author. Image copyrights remain with the original author, under the original terms:
**free for creative work (including commercial use) with no attribution required**, but
**redistribution, republication or resale of the image data itself is prohibited**. The imagery
is AI-generated fiction (grey mannequin line art / outfit-only photos) — **do not use it to
depict real people or minors**. Full terms in [NOTICE.md](NOTICE.md).

---

## License

- **Code** (studio, scripts, styles, docs): [MIT](LICENSE)
- **Image assets**: copyright of ギア, under the original site's terms
