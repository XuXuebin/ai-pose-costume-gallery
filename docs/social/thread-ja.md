# 日本語スレッド（7 連）

## 1/7

日本の AI 絵付け向けリファレンス集 2 つを中国語にローカライズし、
「ポーズを選ぶ + 衣装を選ぶ → その場で生成」までつなげました。

ポーズ集 1,439 枚 / 衣装集 1,407 セット
素材はすべて原サイトの条件に従っています。

https://xuxuebin.github.io/ai-pose-costume-gallery/

## 2/7

ポーズ集：288 ポーズ × 5 アングル（正面/上/下/横/斜め）= 1,439 枚。
顔のないグレーの人形線画（3:4）。AI 人物描画の姿勢参考に。

衣装集：人物のいない衣装だけの画像（2:3）1,407 セット。春夏秋冬＋ランジェリー/パーティ/水着/セクシー、計 8 カテゴリ。

原サイトはこの 2 ページが別々。

## 3/7

1 ページにまとめました 👇
① ポーズ → ② 衣装 → ③ 人物の参考画像 → API 設定 → 生成

いちばん大事なのは、参考画像 3 枚を「画像のまま」API に送っている点。
説明文に翻訳してプロンプトに混ぜる方式ではありません。

## 4/7

プロンプトは自動でこうなります：
「Reference image 1 is the POSE… 2 is the OUTFIT… 3 is the CHARACTER」

API はブラウザから直接。Pollinations（キー不要）/ OpenAI 互換 / Gemini / カスタム JSON、
ローカルの Antigravity プロキシのモデル一覧も取得できます。

## 5/7

細々したこと：
· 画像は原サイト CDN を参照（リポジトリは 2.5MB、Pages は即デプロイ）
· 参考画像はブラウザ内で 896px に縮小し JPEG 化（400KB → 61KB）
· サイズは任意の WIDTHxHEIGHT、quality 指定可
· 生成結果はブラウザ内ギャラリー（IndexedDB）に保存
· UI は 中 / 英 / 日 の 3 言語

## 6/7

原著者：ギア（@giaaibusi）
ai-pose-gallery.pages.dev
ai-costume-gallery.pages.dev

素材の条件は原サイト準拠：商用可・クレジット不要。画像の再配布は禁止。
画像は AI 生成のフィクション（人形線画 / 衣装だけ）。実在の人物や未成年者の表現には使わないでください。

原著者へ感謝 🙏

## 7/7

リポジトリ：https://github.com/XuXuebin/ai-pose-costume-gallery

#AIイラスト #ポーズ参考 #衣装参考 #画像生成 #ComfyUI #StableDiffusion

