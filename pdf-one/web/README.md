# @jazmf-dx/pdf-one-web

[PDF One](https://github.com/jazmf-dx/desktop-apps/tree/main/pdf-one)（PDF を開く・ページを整理する・書き込む・フォームに入力する）の画面を、React のコンポーネントとして Web サイトに載せるパッケージ。PDF の読み書きは WebAssembly でブラウザの中で行う。**サーバーへの通信はない**（読むのは、置く側が配る静的ファイルだけ。ファイルは端末の外に出ない）。

仕組みと決めた理由は [docs/WASM.md](../docs/WASM.md)、[ADR-0005](../decisions/adr-0005-web-package.md)。

## 使い方

```tsx
import { PdfOneApp } from "@jazmf-dx/pdf-one-web";
import "@jazmf-dx/pdf-one-web/style.css";

<div style={{ height: "calc(100vh - 64px)" }}>
  <PdfOneApp assetsBase="/static/pdf-one/0.3.0/" colorScheme="light" />
</div>
```

| props | |
|---|---|
| `assetsBase`（必須） | パッケージの `assets/` の中身を置いた URL。末尾は `/`。最初にマウントしたときの値を使う |
| `colorScheme` | `"light"` / `"dark"` / `"system"`（既定）。`"system"` は OS の設定に従う |
| `className` | ルートの要素（`.pdf-one`）に足す class |

- 親の大きさいっぱいに広がる（`width: 100%; height: 100%`）。**親に高さを与える**こと
- **1 ページに 1 つ**。開いた文書と設定はページの中で 1 つ（zustand のストア）。アンマウントするとキーボードの受け付けなどはやめるが、開いた文書は残り、同じページでまたマウントすると戻る
- React 19 は `peerDependencies`（`react`、`react-dom`）。pdf.js、zustand、lucide-react、@tanstack/react-virtual は `index.js` に入っている

## assets を配る

`assets/` の中身は静的ファイルとして置く側が配る。`assetsBase` はその URL。

```
assets/
  pdf_one_wasm_bg.wasm       PDF の読み書き（wasm-bindgen。JS の側は index.js に入っている）
  NotoSansJP-Regular.ttf     書き込む日本語の文字のフォント（SIL OFL 1.1）。5.5 MB でいちばん重い
  pdf.worker.min.mjs         pdf.js のワーカー
  cmaps/  standard_fonts/  wasm/    pdf.js が実行時に読むもの（wasm/ は JBIG2・JPEG 2000 の JavaScript 版）
  LICENSE-*.txt              フォントと pdf.js のライセンス
```

- 版ごとの置き場所（`/static/pdf-one/0.3.0/` のように版を入れる）にすると、ブラウザのキャッシュが版と一緒に切り替わる。ファイル名は版で変わらないので、同じ場所に上書きしない
- `Content-Type`：`.wasm` は `application/wasm`、`.mjs` と `.js` は `text/javascript`（ワーカーは `import` で読まれる）
- `assetsBase` が別のオリジンなら、そのオリジンが CORS を許すこと（`fetch` とワーカーの読み込みがある）
- CSP を使うページは、`assetsBase` のオリジンを `connect-src`（wasm とフォントと pdf.js のファイル）と `worker-src`（pdf.js のワーカー）で許し、WebAssembly のために `'wasm-unsafe-eval'` を足す。印刷には `img-src blob:` も要る

置く側の Vite プロジェクトの例：

```bash
npm install @jazmf-dx/pdf-one-web          # .npmrc に @jazmf-dx:registry=https://npm.pkg.github.com
```

```ts
// vite.config.ts: assets/ を public/ に写す（vite-plugin-static-copy でもよい）
import fs from "node:fs";
import { defineConfig } from "vite";

const VERSION = JSON.parse(fs.readFileSync("node_modules/@jazmf-dx/pdf-one-web/package.json", "utf8")).version;

export default defineConfig({
  plugins: [
    {
      name: "pdf-one-assets",
      buildStart() {
        fs.cpSync("node_modules/@jazmf-dx/pdf-one-web/dist/assets", `public/pdf-one/${VERSION}`, { recursive: true });
      },
    },
  ],
  define: { __PDF_ONE_BASE__: JSON.stringify(`/pdf-one/${VERSION}/`) },
});
```

```tsx
<PdfOneApp assetsBase={__PDF_ONE_BASE__} />
```

Django なら `STATICFILES_DIRS` に `node_modules/@jazmf-dx/pdf-one-web/dist/assets` を `("pdf-one/0.3.0", …)` で足して `collectstatic` する、などでもよい。

## 見た目

- **CSS は `.pdf-one`（ルートの要素）の中に閉じている**。`style.css` の全セレクタは `.pdf-one` の下にあり、Tailwind の preflight も utility も `:root`・`html`・`body` の指定も、置く側のページには効かない（`@property`、`@keyframes`、`@font-face` はページ全体のものだが、`@keyframes` の名前には `pdf-one-` を付けてある）。`rem` は置く側の `html` の文字の大きさに左右されない（設定の「文字を大きく」も、ページではなくアプリの中だけを変える）
- 逆に、置く側の CSS が画面の中に効くことは、ほぼない。`style.css` は `@layer` に入れていない（レイヤーの外の CSS は、レイヤーの中の CSS に必ず勝つので、置く側の `button { … }` のような指定が画面のボタンを塗り替えてしまう）。画面の指定は `.pdf-one button` のように優先度が高く、置く側の要素名やクラス 1 つの指定、`@layer` の中の指定（Tailwind など）には負けない。見出しや段落など、色を継承に任せている所は `inherit` に戻してある。防げないのは、ID や `!important` を使った、より強い指定
- 色は `.pdf-one` の CSS 変数で上書きできる

  ```css
  .pdf-one {
    --pdf-one-accent: #0b7285;
  }
  ```

  `--pdf-one-bg`、`--pdf-one-panel`、`--pdf-one-raised`、`--pdf-one-line`、`--pdf-one-fg`、`--pdf-one-dim`、`--pdf-one-accent`、`--pdf-one-danger`、`--pdf-one-success`、`--pdf-one-warn`、`--pdf-one-hover`、`--pdf-one-canvas`、`--pdf-one-tabbar`、`--pdf-one-scrollbar`。ライトとダークで別の値にするには、`.pdf-one[data-color-scheme="dark"]`（`colorScheme="system"` なら `@media (prefers-color-scheme: dark)` の中の `.pdf-one:not([data-color-scheme="light"])`）に書く。書き込みの色（マーカーの黄色、ペンの赤）は PDF に書く色なので変わらない
- ダイアログ、右下の通知、右クリックのメニューは `position: fixed`（`z-index` は 40〜50）で、画面全体に出る。親の中だけには収まらない

## ページとのかかわり

- **キーボード**：⌘O、⌘S、⌘P などのショートカットは `window` で受ける（ページ全体で効く）。PDF One 専用のページに置くこと。文字の入力欄にいるときは効かない
- `document.title` は変えない。ページを閉じる・離れるときに、保存していない変更があればブラウザの警告（`beforeunload`）を出す
- `localStorage` には、パネルの幅や道具の色などの設定を `pdf-one:` を付けたキーで置く。印鑑・下書き・アプリの設定はメモリだけ（ページを閉じると消える）
- 印刷は、印刷の間だけページの `body` の直下に印刷用の要素を足し、ほかの要素を隠す
- 保存は毎回ダウンロード（上書きとバックアップはない）。分割は 1 ファイルずつダウンロード

## 作る・出す

```bash
cd pdf-one
bun install --frozen-lockfile
bun run build:wasm      # Rust と wasm32-unknown-unknown、wasm-bindgen-cli 0.2.129 が要る
bun run build:web       # web/dist/ ができる
cd web && npm pack      # 中身の確認（.tgz）
```

出すのは Actions › **pdf-one-web**（[リリース](../README.md#リリース)）。
