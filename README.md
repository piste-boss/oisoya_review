# oisoya_review

大磯屋さまの口コミ投稿ナビ・フォーム振り分けアプリです。  
スマートフォン閲覧を前提に、来訪者の回答ボリュームに合わせた 3 つのルート（初級/中級/上級）へ誘導します。  
Netlify Functions を利用して表示ラベルと遷移先 URL を管理できる構成になっています。

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## ページ構成

- `/` : レベル別にフォームへ誘導するルータ画面。
- `/admin` : ルータ設定とAI設定を管理するページ。Gemini APIキー・Googleマップリンク・GASアプリURL・生成プロンプトを登録できます。
- `/generator` : 口コミ生成ページ。管理画面で設定した情報をもとにAIが口コミ文章を生成し、コピー＆Googleマップ投稿導線を提供します。

## Netlify Functions

- `/.netlify/functions/config` : ルータ設定およびAI設定のCRUD。Netlify Blobsに保持します。
- `/.netlify/functions/distribute` : レベルに応じてリンク先をローテーションして返却します。
- `/.netlify/functions/generate` : GASアプリから取得したデータをGemini APIに渡し、口コミ文章を生成します。
- `/.netlify/functions/upload` : Blobs動作確認用のサンプル。

### 環境変数

Netlify 上で以下を設定してください。

- `NETLIFY_SITE_ID`
- `NETLIFY_BLOBS_TOKEN`（もしくは `NETLIFY_AUTH_TOKEN`）

Gemini APIキーは管理画面の「AI設定」から登録します。保存するとサーバ側のBlobsに暗号化されず保存されるため取り扱いにはご注意ください（画面上にはマスクされた形で表示されます）。
