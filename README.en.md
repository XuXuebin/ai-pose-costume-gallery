<div align="center">

# Pose × Costume Studio
### POSE-DB-01 × COSTUME-DB-01 · Studio

**[中文](README.md) · [日本語](README.ja.md)**

Pick a pose · Pick a costume · Configure an image API · Generate and save

</div>

---

## What is this

Two Japanese AI-art reference libraries — the **pose library** and the **costume library** — merged
into one place, plus a **unified studio**: choose a pose on the left, an outfit on the right,
plug in any image-generation endpoint, hit generate, and the result is saved straight into a local
gallery in your browser.

| | Content | Count |
|---|---|---|
| 🧍 **Pose library** | Faceless grey mannequin line art (3:4), 5 angles per pose | 288 poses / **1,439 images** |
| 👗 **Costume library** | Outfit-only photos with no person (2:3), 8 categories | **1,407 outfits** |
| 🎨 **Unified studio** | Pose × costume × image API → generate and save | 3 providers |

Interface language: **Chinese / English / 日本語**, switchable at any time.

---

## Quick start

### Local preview

`index.html` in the repository root is the studio; `galleries/` holds the two standalone libraries.

```bash
git clone https://github.com/<your-account>/ai-pose-costume-gallery.git
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
git remote add origin git@github.com:<your-account>/ai-pose-costume-gallery.git
git push -u origin main
```

Then go to **Settings → Pages → Source → GitHub Actions**. Once the workflow finishes, the site is
live at `https://<your-account>.github.io/ai-pose-costume-gallery/`.

Cloudflare Pages / object storage / Nginx work too — there is no build step; the repository root
*is* the publish directory.

---

## Using the studio

```
① Pick a pose  →  ② Pick a costume  →  ③ Settings  →  Generate  →  Saved to gallery
```

1. **Pose** — filter by series (4), angle (5) or category, or search by ID / pose name.
2. **Costume** — filter by category (8), or search by ID / keyword (Chinese *and* English work).
3. **Provider** — pick one of three image APIs and fill in the form; it works straight away.
4. **Generate** — the image appears in place and can be downloaded as PNG. It is **also saved into
   your local gallery** (IndexedDB), so it survives a page reload.
5. **Gallery** — reuse a prompt, download, delete, or clear. Images live only in your own browser
   and are **never uploaded**.

### Three image providers

| Provider | Key | Image input | Notes |
|---|---|---|---|
| **Pollinations** | none | ✗ | Default. Works directly from the browser; images are produced by a third-party service |
| **OpenAI-compatible** | required | ✓ | Uses `/v1/images/generations`, or `/v1/images/edits` when reference images are attached. Most vendors do not allow CORS — if you hit a CORS error, point the endpoint field at your own proxy |
| **Custom URL** | optional | ✗ | Any URL template, with `{prompt}` `{width}` `{height}` `{seed}` `{model}` `{negative}` placeholders |

Endpoint, key, model and seed are kept in browser `localStorage` and **never sent to a server**.
On a shared machine, clear your site data afterwards.

### The prompt is assembled for you

Once a pose and a costume are selected, the prompt is combined into English phrasing that image
models actually understand:

```
full-body single subject, glamorous style, standing pose, three-quarter view,
wearing cream blouse ribbon ivory mini skirt shorts jacket beige tights,
outfit: 奶油色 女式衬衫 蝴蝶结 象牙白 短款 半身裙 短裤 夹克 米色 连裤袜,
full body character, fashion illustration, clean plain background, ...
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
│   ├── generator.js        Image API layer (Pollinations / OpenAI / custom)
│   └── studio.js           Picking, generation, gallery logic
├── galleries/
│   ├── pose/index.html     Pose library (with A4 print layout)
│   └── costume/index.html  Costume library
│                            ↑ every image path points at the original sites
├── data/
│   ├── pose.json           Pose data (used by the studio)
│   └── costume.json        Costume data (used by the studio)
├── tools/
│   ├── sync.py             Sync from the two source projects → galleries/ and data/
│   ├── pose_terms.json     English glossary for pose terms
│   ├── fetch_originals.py  Download original-size PNGs on demand (offline use)
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
