<div align="center">

# ポーズ × 衣装 生成スタジオ
### POSE-DB-01 × COSTUME-DB-01 · Studio

**[中文](README.md) · [English](README.en.md)**

ポーズ選び · 衣装選び · 生成 API の設定 · 一括生成と保存

</div>

---

## これは何ですか

日本語の AI 絵付け向けリファレンス集——**ポーズ集**と**衣装集**——を一か所にまとめ、
さらに**統合スタジオ**を追加しました。左でポーズ、右で衣装を選び、生成 API を設定して
クリックするだけで生成。結果はブラウザ内のローカルギャラリーへ自動保存されます。

| | 内容 | 数 |
|---|---|---|
| 🧍 **ポーズ集** | 顔のないグレーの人形線画（3:4）、各ポーズ 5 角度 | 288 ポーズ / **1,439 枚** |
| 👗 **衣装集** | 人物の入っていない衣装だけの画像（2:3）、8 カテゴリ | **1,407 セット** |
| 🎨 **統合スタジオ** | ポーズ × 衣装 × 生成 API → 生成して保存 | 3 種の API |

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
① ポーズを選ぶ  →  ② 衣装を選ぶ  →  ③ 生成設定  →  生成  →  ギャラリーへ自動保存
```

1. **ポーズ**：シリーズ（4）、アングル（5）、カテゴリで絞り込み、または ID・ポーズ名で検索。
2. **衣装**：カテゴリ（8）で絞り込み、または ID・キーワードで検索（中国語・英語どちらも可）。
3. **API**：3 種の画像生成 API から選び、フォームに記入すればすぐ使えます。
4. **「画像を生成」をクリック**：結果がそのまま表示され、PNG としてダウンロードできます。
   **同時にローカルギャラリー（IndexedDB）へ自動保存**されるので、リロードしても消えません。
5. **ギャラリー**：プロンプトの再利用・ダウンロード・削除・全削除。画像は自分のブラウザ内だけに
   保存され、**アップロードされることはありません**。

### 3 種の画像生成 API

| API | キー | 画像入力 | 備考 |
|---|---|---|---|
| **Pollinations** | 不要 | ✗ | 既定。ブラウザから直接呼べます。画像は第三者サービスが生成します |
| **OpenAI 互換** | 必要 | ✓ | `/v1/images/generations`、参考画像があれば `/v1/images/edits`。多くのサービスは CORS 非対応のため、エラー時は「エンドポイント」に自前のプロキシを指定してください |
| **カスタム URL** | 任意 | ✗ | 任意の URL テンプレート。`{prompt}` `{width}` `{height}` `{seed}` `{model}` `{negative}` が使えます |

エンドポイント・キー・モデル・シードはブラウザの `localStorage` に保存され、**サーバーへは送信されません**。
共用端末では使い終わったらサイトデータを削除してください。

### プロンプトは自動で組み立てられます

ポーズと衣装を選ぶと、画像モデルが理解できる英語表現にプロンプトが合成されます。

```
full-body single subject, glamorous style, standing pose, three-quarter view,
wearing cream blouse ribbon ivory mini skirt shorts jacket beige tights,
outfit: 奶油色 女式衬衫 蝴蝶结 象牙白 短款 半身裙 短裤 夹克 米色 连裤袜,
full body character, fashion illustration, clean plain background, ...
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
