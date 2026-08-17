# Discord 20MB メディア圧縮ツール (GitHub Pages対応)

Discordの最新無料添付上限（**20MB**）に合わせて、動画・画像・音声をブラウザ上で安全に最適圧縮するWebサイトです。

サーバー不要・静的ファイルのみで構成されているため、**GitHub Pages** で完全無料で誰でも公開・運用できます。

---

## 🚀 GitHub Pages への公開手順 (2ステップ・3分で完了)

### 方法A: GitHubのWeb画面からファイルをアップロードする場合（おすすめ）

1. **GitHubで新しいリポジトリを作成**
   - GitHubにログインし、右上「+」➔「**New repository**」をクリック。
   - Repository name に好きな名前（例: `discord-compressor`）を入力。
   - 「**Public**」を選択し、「Create repository」をクリック。

2. **ファイルをアップロード**
   - 作成されたリポジトリ画面の「**uploading an existing file**」をクリック。
   - このフォルダ内のすべてのファイル（`index.html`, `style.css`, `app.js`, `.nojekyll` など）をドラッグ＆ドロップしてアップロード。
   - 画面下の「**Commit changes**」をクリック。

3. **GitHub Pages を有効化**
   - リポジトリ上部の「**Settings**」タブ ➔ 左メニューの「**Pages**」をクリック。
   - **Branch** の設定で `main`（または `master`）を選択し、フォルダは `/ (root)` のまま「**Save**」をクリック。
   - 数十秒〜1分ほど待つと、画面上部に公開URL（例: `https://<ユーザー名>.github.io/discord-compressor/`）が表示され、世界中からアクセスできるようになります！🎉

---

### 方法B: Git コマンドを使う場合

```bash
cd discord-compressor
git init
git add .
git commit -m "Initial commit for Discord 20MB Compressor"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/discord-compressor.git
git push -u origin main
```
その後、リポジトリの **Settings ➔ Pages** から Branch を `main` に設定して保存してください。

---

## 🛠️ 主な機能・仕組み

- **完全クライアントサイド（ブラウザ内完結）**: 動画や画像はお使いのブラウザ内部（WebAssembly FFmpeg / Canvas）でのみ処理されます。外部サーバーを一切介さないため、高速かつ完全にプライバシーが保護されます。
- **高精度20MB自動調整**: 再生時間から自動でビットレートを計算し、Discordの20MB制限を安全にクリアするサイズ（約19.5MB）に圧縮します。
- **対応フォーマット**: 動画 (MP4, MOV, WebM, AVI, MKV)、画像 (PNG, JPG, WebP, GIF)、音声 (MP3, WAV, M4A, FLAC)。
- **GitHub Pages 最適化**: `.nojekyll` および `coi-serviceworker` を同梱しており、GitHub Pages環境で高速・安定動作します。
