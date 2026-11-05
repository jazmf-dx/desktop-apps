# 社内版

jazmf-dx/desktop-apps でだけ扱う、会社の PC（主に Windows）向けのビルド。中身は hamirilo/workbench（upstream）と同じコードで、ツールごとに重ねる設定ファイル（`<tool>/src-tauri/tauri.corp.conf.json`）で名前・ID・更新の配信先・署名の鍵を社内版のものにしている。

対象は upstream にある 5 ツール（Shelf・Clip・Meter・Renamer・Disk Analyzer）。大きいアプリは別のリポジトリにある（Video Studio の社内版は jazmf-dx/video-studio、PDF One は jazmf-dx/pdf-one）。

| | 個人版（upstream） | 社内版 |
|---|---|---|
| 機能 | すべて | 同じ（外している機能はない） |
| アプリ内アップデート | hamirilo/workbench の `<tool>-updater` から | jazmf-dx/desktop-apps の `corp-<tool>-updater` から。社内版専用の鍵で署名し、検査を通して公開した版だけが届く |
| 製品名・ID | `Shelf` / `dev.workbench.shelf` など | `Shelf Corp` / `dev.workbench.shelf.corp` など |
| インストーラ | macOS の .dmg、Windows の -setup.exe | Windows の -setup.exe だけ |
| リリースの tag | `<tool>-v<版>` | `corp-<tool>-v<版>` |

ID が違うので、設定やログなどアプリのフォルダは個人版とは別になる。

## 守ること：upstream と同じファイルは変えない

jazmf-dx は「upstream ＋ 社内版だけのファイル」にしておく。upstream にあるファイル（各ツールの `src/`・`src-tauri/src/`・`tauri.conf.json`、`README.md`、`CLAUDE.md`、`<tool>.yml` など）を jazmf-dx で直接変えると、upstream がそのファイルを変えるたびに取り込みで衝突し、差がだんだん広がっていく。

| やりたいこと | どこで、どうやるか |
|---|---|
| 機能の改修・バグ修正（社内で見つけたものも含む） | upstream で直して、取り込む |
| 社内版で機能を外したい | まず upstream に、外せる仕組みを汎用の形で足す（stockroom の `docs/LIMITS.md` と同じ考え方）。社内版ではその設定を使うだけにする |
| 製品名・ID・インストーラ・配信先・公開鍵 | `<tool>/src-tauri/tauri.corp.conf.json` |
| 社内版のビルドと公開の手順 | `corp.yml`・`corp-publish.yml`・この文書 |

社内版にしか要らない変更も、コードに「社内版なら」と書くのではなく、「この機能を外せる」という形で upstream に入れる。更新の配信先と「更新内容を見る」のページは、コードが `plugins.updater.endpoints` の 1 つ目から決める（各ツールの `src-tauri/src/feed.rs`）。`corp-<tool>-updater` を指せばページは `corp-<tool>-v<版>` になるので、コードは変えなくてよい。

`main` への PR では `fork-guard` ワークフローが、upstream との差が下の「社内版だけのファイル」に収まっているかを確かめ、ほかのファイルが変わっていたら失敗する。

GitHub の画面に出る「This branch is N commits ahead of hamirilo/workbench:main」は、社内版のコミットと取り込みのマージの数なので、増えていって問題ない。「Contribute」から upstream への PR は作らない（社内版のファイルが upstream に入ってしまう）。

## 社内版だけのファイル

社内版のために置くのは、次の新しいファイルだけにする。

- `<tool>/src-tauri/tauri.corp.conf.json`：製品名・ID・インストーラの種類（NSIS だけ）、updater の配信先（`corp-<tool>-updater`）と公開鍵を社内版のものにする
- `.github/workflows/corp.yml`：tag `corp-<tool>-v<版>` で、テストとビルドをして、下書きのリリースを作る
- `.github/workflows/corp-publish.yml`：検査を通った下書きを公開し、`corp-<tool>-updater` の `latest.json` を差し替える
- `.github/workflows/fork-guard.yml`：PR で、upstream との差がこれらのファイルだけかを確かめる
- `docs/CORP.md`：この文書

ツールを社内版に足すときは、そのツールの `tauri.corp.conf.json` を置くだけでよい（ワークフローは tag からツールを決める）。

## 開発

社内版の設定で動かすとき（ツールのディレクトリで）：

```bash
bun run tauri dev --config src-tauri/tauri.corp.conf.json
```

## upstream の取り込み

```bash
git remote add upstream https://github.com/hamirilo/workbench   # 初回だけ
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

GitHub の画面の「Sync fork」でもよい。社内版だけのファイルは upstream にないので、通常は衝突しない。

取り込んだあとで `git diff upstream/main main --stat` を見ると、上の「社内版だけのファイル」だけが出る。ほかのファイルが出たら、jazmf-dx で直接変えたものがあるので、upstream に入れ直す。

### 個人版のワークフロー

upstream から来る `.github/workflows/<tool>.yml` は、jazmf-dx でも PR と `main` へのテストに使う（そのまま動かしてよい）。リリースの部分（tag `<tool>-v*` と、Run workflow の `release`）は jazmf-dx では使わない。個人版の更新ファイルに署名する鍵（`TAURI_SIGNING_PRIVATE_KEY`）は jazmf-dx に置かないので、間違えて動かしても更新ファイルが作れずに失敗する。

## 署名の鍵

アプリ内アップデートは、社内版専用の鍵で署名した更新しか受け付けない。公開鍵は各ツールの `tauri.corp.conf.json` の `plugins.updater.pubkey`。組織の鍵（公開鍵 ID `D35B5FA86D1AB335`）で、5 ツールと jazmf-dx/video-studio の社内版、jazmf-dx/pdf-one で同じ鍵を使う。個人版の鍵とは別のもので、個人版の更新が社内版に入ることはない（逆も同じ）。

鍵は 2026-11 に作った（`bunx @tauri-apps/cli signer generate -w jazmf-corp.key`）。最初の鍵（公開鍵 ID `4C2C8675C57523B3`）はパスワードが分からなくなったため、2026-11-05 に作り直した。最初の鍵で署名した社内版は、新しい鍵では更新できないので、手で入れ直してもらう。ツールを社内版に足すときは、`tauri.corp.conf.json` の `pubkey` に同じ公開鍵を入れる。

- 秘密鍵とパスワードは、Environment `corp-release` の Secret（`CORP_SIGNING_PRIVATE_KEY`・`CORP_SIGNING_PRIVATE_KEY_PASSWORD`）にだけ置く。Repository secret にはしない
- `corp-release` は、tag `corp-*` からしか使えないようにする（Settings → Environments → Deployment branches and tags）。ほかのブランチのワークフローからは鍵を読めない
- 秘密鍵のファイルは手元に残さないか、パスワード管理ツールなど安全な場所に置く。漏れたら、その鍵で署名した更新が全員の PC に入りうる
- 鍵をなくしたり作り直したりすると、それまでの社内版には更新が届かなくなる。新しい公開鍵の版を、全員に手で入れ直してもらう

## リリース

1. upstream を取り込む（上の手順）
2. 個人版と同じ番号でタグを付ける：`git tag corp-shelf-vX.Y.Z && git push origin corp-shelf-vX.Y.Z`
3. GitHub Actions の `corp` ワークフローが、tag と `tauri.conf.json` の版の一致・配信先・公開鍵を確かめ、テストし、Windows のインストーラを作って、**下書きのリリース** `corp-shelf-vX.Y.Z` に添付する
   - 添付されるのは `-setup.exe`・`latest.json`・`SHA256SUMS.txt`。ハッシュは実行のサマリーとリリースの本文にも出る
   - 下書きのうちは、アプリ内アップデートからは見えない
4. 下書きのリリースから `-setup.exe` を取り、検査に提出する。そのときに SHA-256 を控える
5. 検査を通ったら、Actions › **corp-publish** › **Run workflow** で、tag と控えた SHA-256 を入れて実行する
   - 下書きの `-setup.exe` の SHA-256 が控えと違えば、何もせずに失敗する（同じ tag でワークフローを動かし直すと添付が差し替わるので、検査のあとは動かし直さない）
   - 同じなら、リリースを公開し、`corp-shelf-updater` の `latest.json` をこの版に差し替える。この時点で、社内版を使っている全員のアプリに更新が届く
6. リリースの本文に変更点を書く（アプリの「更新内容を見る」はこのページを開く）
7. まだ社内版を入れていない人には、同じ `-setup.exe` を社内の共有の場所に置いて配る

公開したあとで問題が見つかったら、`corp-shelf-updater` の `latest.json` を前の版のもの（前の版のリリースに添付されている）に戻す。それ以降の配信は止まるが、すでに更新した PC は戻らない。直した版を、次の番号で出す。

### 版の番号

社内版の番号は、取り込んだ upstream の番号と同じにする。アプリに出る番号は `tauri.conf.json` の `version` で決まり、このファイルは jazmf-dx では変えないので、自然に揃う。

社内版は検査を通す版だけを出すので、間の版は飛ばしてよい。番号が同じなら、社内版のある版は個人版の同じ番号の版と同じコードになる。

`tauri.corp.conf.json` だけを変えて出し直すときは、コードの番号が変わらないので、中身の違うインストーラが同じ番号でできてしまう。そのときは次のどちらかにする。

- 基本：upstream の番号が上がるのを待つ。急ぐなら upstream でパッチ版を出してから、社内版を作る
- 急ぎで番号を上げられないとき：タグに枝番を付ける（`corp-shelf-v0.1.9-2`）。アプリの表示は 0.1.9 のままなので、どちらの版かは控えた SHA-256 で見分ける。アプリ内アップデートは番号が上がらないと届かないので、この版は手で入れ替えてもらう。`corp-publish` は枝番の付いた tag を受け付けない

インストーラはコード署名をしていないので、初回は SmartScreen の警告が出る。
