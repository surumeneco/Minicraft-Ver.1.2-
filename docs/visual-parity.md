# WebGLレンダリングの変更前後比較

`.github/workflows/visual-parity.yml` は、`develop`宛のproduction script/`index.html`変更PRで
`tests/browser/visual-parity.mjs` を実行する。PRのbase SHAをGit worktreeにcheckoutし、
同一のGitHub runner・同一Chromium/SwiftShaderで旧コードと新コードを別ポートから読み込む。

- 両方の実ゲームを起動し、起動前の`Math.random`系列を同一シードに固定
- 実`applyChanges` / `mesh`で同じ模様・段差のテクスチャブロックを配置
- 同一のP位置・yaw/pitch・ワールド時刻・霧色を使用し、Mobと雲を表示対象から外す
- 実`ren.render(scene,cam)`と`WebGL2.readPixels`で取得した固定96×60サンプルのRGBを比較
- RGB各画素の最大チャンネル差が10を超える箇所が全体の1%を超えたら失敗
- フレームバッファが取得できない、描画色の変化が8種類に満たない場合も失敗

これは **厳密に設定した再現シーン・サンプル位置での差分ゲート**である。
全画素完全一致、全チャンク・全テクスチャ/UV・すべての光源の網羅、すべての
GPU/OSでの同一描画、スクリーンショットの目視検査までは主張しない。
新しい描画仕様を意図的に導入する場合は単なるrefactorとして通さず、仕様変更として別途根拠を整備する。

正式CAT-TDDの`process-closure`等とは別の外部実行証拠であり、代替しない。
