# ADR-0005：ブラウザ版を npm パッケージにする（assetsBase、CSS の閉じ込め、色の変数）

**日付**：2026-10-19
**状態**：採用

## 背景

ADR-0004 で、画面（`src/`）はホスト（`src/host/`）を通して、デスクトップ（Tauri）とブラウザのどちらでも動くようにした。ブラウザ版を DX ポータル（Django + Vite + React 19 の島、Tailwind v4 を自前で使う）に載せるため、`@jazmf-dx/pdf-one-web`（GitHub Packages）として出す（docs/WASM.md §5）。載せる側のページは私たちのものではない。次の 3 つが問題になる。

- wasm、日本語フォント、pdf.js のワーカーと CMap などの重いファイルを、どこから、誰が配るか
- 私たちの CSS（Tailwind の preflight と utility、`:root`・`body` の指定）が、置く側のページを壊してはいけない。置く側の CSS が私たちの画面を壊すのも避けたい
- 色を置く側のデザインに合わせられること

## 決定

### 形

```tsx
import { PdfOneApp } from "@jazmf-dx/pdf-one-web";
import "@jazmf-dx/pdf-one-web/style.css";

<div style={{ height: "…" }}>
  <PdfOneApp assetsBase="/static/pdf-one/0.3.0/" colorScheme="light" />
</div>
```

- 入口は `src/web.tsx`。`vite.web.config.ts`（`npm run build:web`）が `web/dist/`（`index.js`、`index.d.ts`、`style.css`、`assets/`）を作る。`web/package.json` が `@jazmf-dx/pdf-one-web`（版は `pdf-one/package.json` と同じ）
- **`assetsBase`**：パッケージの `assets/`（wasm、Noto Sans JP、pdf.js のワーカー・CMap・標準フォント・JavaScript デコーダ、ライセンス）を置いた URL。置く側が静的ファイルとして配る。サーバーへの通信は、これを読むだけ。wasm-bindgen の JS は `index.js` に入れる（そのため wasm の「既定の場所」を指す `new URL(…, import.meta.url)` は、ビルドで外してエラーにする。ファイルがパッケージの外に勝手にコピーされないように）
- React 19 は peerDependencies。pdfjs-dist、zustand、lucide-react、@tanstack/react-virtual は `index.js` に入れる
- 1 ページに 1 つ。文書と設定のストア（zustand）、ホスト、pdf.js の設定はモジュールに 1 つ。アンマウントしても開いた文書は消さない（SPA の画面遷移で、保存していない変更を黙って捨てないため）
- ページとのかかわり：ショートカットは `window` で受ける（専用のページに置く前提）。`document.title` は変えない。保存していない変更があれば `beforeunload` で警告。`localStorage` のキーには `pdf-one:` を付ける（置く側と同じオリジンなので。デスクトップのキーは変えない）。印刷は、印刷の間だけ `body` の直下に印刷用の要素を足し、ほかの要素を隠す

### CSS を `.pdf-one` に閉じる

- 画面のルートの要素（`components/Root.tsx`）に class `.pdf-one` を付け、画面の CSS はこの要素に掛ける。ルート自身が `width/height: 100%`。デスクトップでは `html`・`body`・`#root` を 100% にする指定を `src/desktop.css` に分けた（`main.tsx` が読む）
- パッケージの `style.css` は、`build/postcss-scope.ts`（PostCSS のプラグイン、30 行ほど）で、出来上がった CSS の全セレクタを `.pdf-one` の下に入れる。`:root`・`html`・`body`・`:host` はルート自身に、`*` と `::before` などはルートとその子孫に。`@property` と（名前を変えた）`@keyframes` は外のまま。外に出たセレクタが 1 つでもあればビルドが失敗する
- **`@layer` は外す**。レイヤーの中の CSS は、レイヤーの外の CSS に必ず負ける。置く側の `button { … }` のような指定（外にある）が、画面のボタンを青く塗ってしまう。`.pdf-one` の下の指定は `.pdf-one button`（優先度が高い）になるので、外すと勝てる。外しても内側の順序は変えない（レイヤーに入っていたものを先に、入っていなかったものを後に置く）。ブラウザでデスクトップ版（`npm run dev`）とパッケージの画面のすべての要素の computed style を比べ、レイヤーを残すと置く側の指定で 209 項目が変わり、外すと 0 になることを確かめた（開いた文書・ダイアログ・右クリックのメニュー。ライト・ダーク）
- `@keyframes` は名前がページ全体で共有されるので `pdf-one-` を付ける（`animation` と `--animate-*` の参照も直す）
- **`rem` は `calc(N * var(--pdf-one-rem))` に変える**。`rem` は置く側の `html` の文字の大きさで、`html { font-size: 62.5% }` のページでは画面が縮み、設定の「文字を大きく」（デスクトップでは `html` の文字の大きさを変える）はページを変えてしまう。`--pdf-one-rem`（既定 16px、大きく 18.4px、さらに大きく 20.8px）は `src/web.css` が持ち、ルートの `data-text` で切り替える。デスクトップは今のまま `html` を変える
- ルートは、置く側から継承しうる文字の指定（`text-align`、`line-height`、`letter-spacing`…）を自分で決め直す。見出しなど、置く側の CSS が要素名で直接指しうるもの（`h1 { color: red }`）の色とフォントは `inherit` に戻す（`src/web.css`）
- 防げないもの：置く側の CSS が、画面の要素に直接当たる、`.pdf-one …` より優先度が高い指定（ID、`!important`）。画面の中だけを見る CSS のリセット（`all: revert` など）は、画面の見た目を壊すので入れない

### 色の変数

- 色は `.pdf-one` の CSS 変数 `--pdf-one-bg`、`-panel`、`-raised`、`-line`、`-fg`、`-dim`、`-accent`、`-danger`、`-success`、`-warn`、`-hover`、`-canvas`、`-tabbar`、`-scrollbar`。置く側は `.pdf-one { --pdf-one-accent: … }` で上書きする
- 既定値は `:where(.pdf-one)`（優先度 0）に置くので、置く側の指定が常に勝つ
- ライト・ダークは、ルートの `data-color-scheme`（`colorScheme` の props。`"system"` なら付けない）と `prefers-color-scheme`。ADR-0002 の動き（OS に合わせる）はデスクトップで変えない

## 結果

- デスクトップ版の見た目と動きは変わらない（ブラウザで同じ状態の computed style が一致することを確かめた）。画面の色の変数名が `--bg` などから `--pdf-one-bg` などに変わった（`src/index.css`、`Overlay.tsx`、`StampDialog.tsx`）
- パッケージの `style.css` は約 290 kB（gzip 52 kB）。`index.js` は約 1 MB（gzip 275 kB）で、Tauri の API（`isTauri()` で使わない分岐）も入る
- ダイアログ・通知・右クリックのメニューは `position: fixed`（`z-index` 40〜50）で、親の中ではなく画面全体に出る
- pdf.js の CSS の `light-dark()`（注釈のコメントのボタンなど）は、ビルドの変換（古いブラウザ向け）で `prefers-color-scheme` だけに従う形になり、`colorScheme` を OS と逆にしても変わらない。この画面でほとんど使わない部分で、デスクトップのビルドも同じ
- wasm の Rust 依存（lopdf など）のライセンス表記は、まだ `assets/` に入れていない
