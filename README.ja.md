<div align="center">

# ポーズ × 衣装 生成スタジオ
### POSE-DB-01 × COSTUME-DB-01 · Studio

**[中文](README.md) · [English](README.en.md)**

ポーズ選び · 衣装選び · 生成 API の設定 · 一括生成と保存

</div>

---

## これは何ですか

日本語の AI 絵付け向けリファレンス集——**ポーズ集**と**衣装集**——を一か所にまとめ、
さらに**統合スタジオ**を追加しました。左でポーズ、右で衣装を選び、希望の人物の写真を
アップロードすると、**3 枚すべての画像をまとめて画像生成 API に渡して img2img 生成**します。
クリックするだけで結果がブラウザ内のローカルギャラリーへ自動保存されます。

| | 内容 | 数 |
|---|---|---|
| 🧍 **ポーズ集** | 顔のないグレーの人形線画（3:4）、各ポーズ 5 角度 | 288 ポーズ / **1,439 枚** |
| 👗 **衣装集** | 人物の入っていない衣装だけの画像（2:3）、8 カテゴリ | **1,407 セット** |
| 🎨 **統合スタジオ** | ポーズ参考 + 衣装参考 + 人物参考 → 画像生成（img2img） | 4 種の API |

表示言語：**中文 / English / 日本語** をいつでも切り替えられます。

---

## クイックスタート

### ローカルプレビュー

リポジトリ直下の `index.html` がスタジオ、`galleries/` に 2 つの独立したギャラリーがあります。

```bash
git clone https://github.com/XuXuebin/ai-pose-costume-gallery.git
cd ai-pose-costume-gallery
python3 -m http.server 8899
# http://127.0.0.1:8899/ を開く
```

> ⚠️ `localhost` ではなく **`127.0.0.1`** で開いてください。Pollinations は `localhost` オリジン
> のリクエストを拒否します（HTTP 403）。ギャラリー 2 ページは `file://` で直接開いても閲覧できます。

> 📌 **画像はリポジトリに含めません**：すべての画像は原サイトの URL から直接読み込みます
> （ポーズ集は `ai-pose-gallery.pages.dev`、衣装集は `ai-costume-gallery.pages.dev`）。
> そのためリポジトリ全体は約 **2.5 MB** で、GitHub Pages のデプロイもほぼ瞬時に完了します。
> 代わりに、元の 2 サイトへアクセスできることが前提になります。

### GitHub Pages への公開

`.github/workflows/pages.yml` を同梱済みなので、push するだけで自動デプロイされます。

```bash
git init && git add . && git commit -m "feat: ポーズ×衣装 統合スタジオ"
git branch -M main
git remote add origin git@github.com:XuXuebin/ai-pose-costume-gallery.git
git push -u origin main
```

その後 **Settings → Pages → Source** で **GitHub Actions** を選びます。

> 🟢 **本リポジトリは公開済みです**（GitHub Actions で自動デプロイ）：
> **スタジオ** https://xuxuebin.github.io/ai-pose-costume-gallery/
> **ポーズ集** https://xuxuebin.github.io/ai-pose-costume-gallery/galleries/pose/
> **衣装集** https://xuxuebin.github.io/ai-pose-costume-gallery/galleries/costume/

Cloudflare Pages / オブジェクトストレージ / Nginx にも対応しています。ビルドコマンドは不要で、
リポジトリのルートがそのまま公開ディレクトリになります。

---

## スタジオの使い方

```
① ポーズを選ぶ  →  ② 衣装を選ぶ  →  ③ 参考画像 + API 設定  →  生成  →  ギャラリーへ自動保存
```

1. **ポーズ**：シリーズ（4）、アングル（5）、カテゴリで絞り込み、または ID・ポーズ名で検索。
   選んだ線画が**自動的に参考画像 1** になります。
2. **衣装**：カテゴリ（8）で絞り込み、または ID・キーワードで検索（中国語・英語どちらも可）。
   選んだ衣装画像が**自動的に参考画像 2** になります。
3. **人物の参考画像をアップロード**： 希望する人物の写真を 3 つ目のスロットへドラッグ（省略可）
   → **参考画像 3**。
4. **API**：4 種の画像生成 API から選び、フォームに記入すればすぐ使えます。
5. **「画像を生成」をクリック**：結果がそのまま表示され、PNG としてダウンロードできます。
   **同時にローカルギャラリー（IndexedDB）へ自動保存**されるので、リロードしても消えません。
6. **ギャラリー**：プロンプトの再利用・ダウンロード・削除・全削除。画像は自分のブラウザ内だけに
   保存され、**アップロードされることはありません**。

### 参考画像をどう API に渡すか

3 枚は**スロットの順序のまま**送信され、プロンプトでは「Reference image 1/2/3」と呼びます。

| スロット | 入手元 | 実際に送る元ファイル | 役割 |
|---|---|---|---|
| 1 ポーズ参考 | ポーズ集 | `原図`（900×1200 PNG） | 姿勢・手足・構図 |
| 2 衣装参考 | 衣装集 | `画像`（1366×2048 WebP） | 服装・配色・素材感 |
| 3 人物参考 | ローカル | アップロードしたファイル | 顔・髪型・雰囲気 |

元の 2 サイトはいずれも `Access-Control-Allow-Origin: *` を返す、ブラウザは**画像のバイト列を
クロスオリジンで取得**して API が求める形式（multipart / base64）に変換できます。
リポジトリに画像を入れる必要はありません。

### ローカルの Antigravity プロキシ（推奨）

ローカルで Antigravity の OpenAI 互換プロキシ（既定 `http://127.0.0.1:8045/v1`）を
動かしているなら、**クイックプリセット → ローカルの Antigravity プロキシ**で一括入力できます。

```
エンドポイント  http://127.0.0.1:8045/v1
API キー        sk-antigravity
モデル          gemini-3.1-flash-image
画質            hd
```

- **モデル一覧を読み込む**で `GET /v1/models` を呼び、代理が返すモデル（実機では 23 個）を候補に表示します。
- **サイズ**は任意の `WIDTHxHEIGHT` に対応（プロキシ側がアスペクト比を計算）。横に 1:1 / 2:3 / 3:4 / 16:9 のショートカット。
- 参考画像はブラウザ内で長辺 896px まで縮小し JPEG 化されます（線画 400KB → 61KB）。アップロードが速くなります。

> ⚠️ **実測で確認した 2 点**
> 1. 公開 Pages は **https** のため、ブラウザが `http://127.0.0.1` に **Private Network Access** を
>    適用して遮断します。本機プロキシを使う場合は**ローカルプレビュー**から開いてください：
>    `cd site && python3 -m http.server 8899` → `http://127.0.0.1:8899/`。
>    ローカルアドレスを検出すると UI にお知らせが表示されます。
> 2. このプロキシのアカウントプールには**地域制限**のあるものが含まれ、
>    `User location is not supported for the API use.` を返す場合があります。
>    また**参考画像 3 枚**では长时间ハングすることがあります。実測では
>    **2 枚（ポーズ + 衣装）が最も安定**し、生成に 60〜90 秒かかります。
>    UI には 180 秒のタイムアウトと経過時間表示があり、失敗後は「もう一枚」で再試行できます。

### 4 種の画像生成 API

| API | キー | 複数参考画像 | 備考 |
|---|---|---|---|
| **Pollinations** | 不要 | ✗ | テキスト生成のみ。ブラウザから直接呼べます。画像は第三者サービスが生成します |
| **OpenAI 互換** | 必要 | ✓ | `POST /v1/images/edits` に 3 枚を `image[]` として一括送信。多くのサービスは CORS 非対応のため、エラー時は「エンドポイント」に自前のプロキシを指定してください |
| **Google Gemini** | 必要 | ✓ | `generateContent` に 3 枚を base64 の `inline_data` として送信（1 回の複数画像入力に対応） |
| **カスタム URL** | 任意 | ✓ | `POST` JSON：`{prompt, images:[{role,name,data_url}], width, height, seed, model}` |

参考画像に対応しない API を選んだ場合、UI は**「テキストのプロンプトのみで生成される」**ことを
明示的に警告します。

エンドポイント・キー・モデル・シードはブラウザの `localStorage` に保存され、**サーバーへは送信されません**。
共用端末では使い終わったらサイトデータを削除してください。

### プロンプトは自動で組み立てられます

参考画像を設定すると、画像モデルが理解できる英語表現にプロンプトが合成されます。

```
Outfit details: cream blouse ribbon ivory mini skirt shorts jacket beige tights.
Reference image 1 is the POSE and body posture to reproduce exactly.
Reference image 2 is the OUTFIT to put on the character, keep the same clothing, colors and materials.
Reference image 3 is the CHARACTER: keep the same face, hairstyle and overall appearance.
Generate a full-body character illustration that keeps the pose from the pose reference,
the outfit from the costume reference, the face of the person reference.
Single character, clean plain background, studio lighting, high quality, detailed fabric texture, natural proportions.
```

ポーズの中国語用語（カテゴリ／アングル／シリーズ）には英訳表（`tools/pose_terms.json`）があり、
これを編集して再同期すれば文言を変えられます。プロンプトは自由に編集可能で、
既定のネガティブプロンプトには `nudity, explicit, nsfw` などが含まれます。

---

## ディレクトリ構成

```
ai-pose-costume-gallery/
├── index.html              ★ 統合スタジオ（GitHub Pages のトップ）
├── studio/
│   ├── studio.css          スタジオのスタイル
│   ├── i18n.js             中 / 英 / 日 の文言
│   ├── generator.js        生成 API 适配（Pollinations / OpenAI / カスタム）
│   └── studio.js           選択・生成・ギャラリー処理
├── galleries/
│   ├── pose/index.html     ポーズ集（A4 印刷レイアウト付き）
│   └── costume/index.html  衣装集
│                            ↑ 画像パスはすべて原サイトへの絶対 URL
├── data/
│   ├── pose.json           ポーズデータ（スタジオの選択に使用）
│   └── costume.json        衣装データ（スタジオの選択に使用）
├── tools/
│   ├── sync.py             2 つの元プロジェクトから galleries/ と data/ を再生成
│   ├── pose_terms.json     ポーズ用語の英訳表
│   ├── fetch_originals.py  原寸 PNG を必要に応じて取得（オフライン用）
│   └── verify.py           データとパスの整合性チェック
├── .github/workflows/pages.yml   GitHub Pages 自動デプロイ
├── NOTICE.md               素材の著作権と出典
├── LICENSE                 コードは MIT
└── README.md / README.en.md / README.ja.md
```

### 素材の再同期

`galleries/` と `data/` は 2 つの元プロジェクトから**生成**されます。

```bash
python3 tools/sync.py                # 同期（../ai-pose-gallery と ../ai-costume-gallery が必要）
python3 tools/sync.py --local-assets # 画像もリポジトリに配置（約 237 MB、自律完結版）
python3 tools/verify.py              # 件数・フィールド・パス参照・3 言語 README の検証
```

デフォルトでは画像を同期しません（ページとデータに原サイトの絶対 URL を書き込みます）。
**原サイト非依存で完結する版**が必要なら `--local-assets` を付けてください：
ポーズ原図はローカルで WebP（900×1200）に変換され、「原寸 PNG をダウンロード」ボタンは
引き続き原サイトを指します。

---

## 元サイトとの違い

**違いは 1 つだけ：画像をリポジトリに持たず、原サイトの URL を直接参照します。**

元の PNG は合計で約 2.1 GB あり、GitHub のリポジトリと Pages デプロイが極端に重くなります。
URL 参照にすればリポジトリは約 2.5 MB に収まり、clone もデプロイも瞬時に完了します。
代わりに元サイトへ到達できない環境では画像が表示されません。

オフラインや自律完結版が必要なら `python3 tools/sync.py --local-assets` を実行するか、
`python3 tools/fetch_originals.py` で原寸 PNG を個別に取得してください。

機能面では、統合スタジオを追加した点を除き、2 つのギャラリーは閲覧・絞り込み・検索・拡大表示・
**A4 印刷レイアウト**・「原寸 PNG のダウンロード」まで元サイトと同一の動作です。

---

## クレジットと出典

**原著者：ギア（@giaaibusi）** — https://x.com/giaaibusi

| 元サイト | リンク |
|---|---|
| ポーズ集 POSE-DB-01 | https://ai-pose-gallery.pages.dev/ |
| 衣装集 COSTUME-DB-01 | https://ai-costume-gallery.pages.dev/ |

本リポジトリは**非公式の中国語ローカライズ／統合版**であり、原著者とは所属関係がありません。
画像の著作権は原作者に帰属し、原サイトの条件に従います：**創作利用（商用含む）は無料で
クレジット表記も不要**ですが、**画像データそのものの再配布・転載・再販は禁止**です。
画像は AI 生成のフィクション（グレーの人形線画／衣装だけの画像）であり、
**実在の人物や未成年者の表現には使用しないでください**。全文は [NOTICE.md](NOTICE.md) をご覧ください。

---

## ライセンス

- **コード**（スタジオ・スクリプト・スタイル・文書）：[MIT](LICENSE)
- **画像素材**：著作権は原著者に帰属し、原サイトの条件に従います
