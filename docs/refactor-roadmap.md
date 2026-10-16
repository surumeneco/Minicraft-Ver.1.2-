# 残存リファクタリング計画

初期基準: `develop` @ `a4356983abb568d242d5cad0408bdff4ddda5516`。最新確認基準: `develop` @ `623bc503c2653e27609070943b2155e534a15102`（2026-10-16、PR #62統合後）。
目的: ゲームの表示・計算・データ形式・保存形式を変えず、責務境界とテスト可能性を改善する。
対象外: 仕様変更、見た目変更、ゲームバランス、描画最適化自体、現行セーブ形式の破壊。
原則: **既存挙動を回帰テストで固定 → 小単位の変更 → CI → developへ統合**。
提出済みの `PR/` ブランチと `main` は変更しない。

## 現在の状態（2026-10-16、PR #62統合後）

- `develop`: `623bc503c2653e27609070943b2155e534a15102`。統合後Node.js **295テスト成功・失敗0**（[Run #38845727284](https://github.com/surumeneco/Minicraft-Ver.1.2-/actions/runs/38845727284)）。PR #62の構造CI・実Chromium CI・リファクタ事前Green・GPU全フレームSHA-256比較の4チェックがGreen。
- 本ラウンドでは、PR #59〜#62を`develop`へ統合。 `main`・既存の提出済み `PR/**` ブランチは変更していない。

| PR | 実施範囲・変更前オラクル |
| --- | --- |
| [#59](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/59) | Chromium WebGL全フレームのRGBAをSHA-256比較、手動実行時の基準SHAを明示入力 |
| [#60](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/60) | 弓矢の更新後位置・視線描画を`updateArrowPose`へ分離。旧コードで3件の描画/消滅回帰テスト成功 |
| [#61](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/61) | TNT導火線の点滅表示を`updatePrimedTntFlash`へ分離。旧コードで2件の周期/爆発前順序テスト成功 |
| [#62](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/62) | リソースパックのタイル解像度（16–128px）を`selectPackTileSize`へ分離。旧コードで2件の上限/下限/複数画像テスト成功 |

### 検証範囲と外部前提の境界

- **証明済み**：固定したWebGLシーンについて、同一Chromium/SwiftShader環境のPRベースと候補ソースの全RGBAフレームハッシュが等しい。差分を許容しないゲートだが、未描画ブロック・時刻・GPUを網羅しない。
- **取得が必要**：ユーザーが過去に実際に保存した `minicraft_v2` データがなければ、実ファイルを使った互換試験の最終判断はできない。合成旧形式の読込/再保存は既に試験済み。
- **正式CAT-TDD**：正本に基づくconfirmed仕様・Work・TestModelおよびNormative Authorityの証拠が揃っていないため、正式な3 Gateは **not-run** とする。通常CIの成功をCAT認定と同一視しない。
- **追加リファクタリング**：コード全体の責務分解に絶対的な終点はない。さらに分割できる関数は残るが、全関数を無条件に細分化することは目的に含めない。以後も不変条件・テストの意義を明確にした単位で進める。

以下の「PR #58統合後」およびそれ以前は作業時点の履歴として保存する。現行判定は本節を優先する。

## 現在の状態（2026-10-15、PR #58統合後）

- `develop` HEAD: `6805e24edc0360d2d2e0f6ca35933857702069ba`。Node.js回帰テスト **288件成功・0件失敗**（統合後Structural parity Run #38684895190）。
- PR #50〜#58はいずれも`develop`へ統合済み。productionコード差分のあるPR #52、#56〜#58では、変更前Green、変更後Node/Chromium、baseとのGPU描画差分ゲートも成功。
- 追加した描画差分CIは、同じGPU/ブラウザでbase/headを固定シーンに描画し、現時点では全画素SHA-256比較の強化をPR #59で進める。全種類のGPUや全シーンの同一性とは区別する。
- `main`および以前の提出済み`PR/**`ブランチは変更していない。

| PR | 対象・検証結果 |
| --- | --- |
| [#50](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/50) | TNTの実導火線終了→爆発→地形/チェスト/Mob副作用 |
| [#51](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/51) | 実GUIの防具軽減・Shift盾・ゾンビ近接攻撃 |
| [#52](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/52) | 回路登録と旧セーブ編集走査でBlock IDアクセサ共通化、4回帰テスト |
| [#53](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/53) | 実回路1200tick + 120回のレバーON/OFF往復とフレームcatch-up制限 |
| [#54](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/54) | base/headの固定WebGLシーン画素比較GitHub Actions導入 |
| [#55](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/55) | ゾンビ長期追跡・被弾、死亡復活、敵Mob解放 |
| [#56](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/56) | Mob歩行ポーズをAI/物理から分離、4回帰テストと全GPU差分検査 |
| [#57](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/57) | 地形鉱石選択後の洞窟/溶岩上書き抽出、全ボクセルオラクル |
| [#58](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/58) | チャンク内の草/花/バラ低木ジオメトリを分離、3回帰テストと実GPU差分検査 |

### 未完了として区別する範囲

- **実ユーザーの歴史的セーブとの互換確認**：`minicraft_v2`の合成レガシー形式は試験済み。実セーブファイルが入手できておらず、全実保存データに対する移行結果は検証できない。
- **正式CAT-TDD 3 Gate**：自動pre-change Green・scope evidenceは導入済み。ただし正本のconfirmed仕様・Work・TestModel・Normative Authorityの承認証拠がなく、`process-closure` / `model-conformance` / `implementation-conformance` は `not-run`。スクリプト成功で代替しない。
- **他の構造リファクタリング**：ワールド全域生成・描画材質・UI・リソースパックなどにはさらに内部責務の分割候補がある。すべてを抽出し終えたとは宣言しない。
- **レンダリングの環境範囲**：固定した複数ブロックを含む実GPUシーンで比較できるが、全ハードウェア/全時間帯/全種類の地形やテクスチャを網羅するものではない。

以下の「PR #48統合後」および以前の節は当時の履歴。最新判定には本節を優先する。

## 現在の状態（2026-10-15、PR #48統合後）

- `develop` HEAD: `9ab9c7358fdee13cebc5c3921a4609ee2eaa08a7`。Node.js **276テスト成功・失敗0**（PR #48構造CIと統合後構造CI）、Chromium実ブラウザCIはPR #48時点で成功。統合後ブラウザCIは別途外部実行結果で確認する。
- 初期PR #1〜#37の成果に加え、以下のPR #38〜#48をすべて`develop`へ統合済み。`main`と既存の提出済み`PR/**`ブランチには変更なし。

| PR | 検証済みの主な対象 |
| --- | --- |
| [#38](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/38) | ブラウザ実マウス押下・解放・Mobの素手攻撃 |
| [#39](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/39) | WebGL2のGPU描画バッファ実読出し（非透明・非黒のスモーク検査） |
| [#40](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/40) | VM実rsTickの比較器・観測器・ホッパー・ピストン4ケース |
| [#41](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/41) | CIの変更スコープ・回帰テスト・文書証拠／リファクタ前Green |
| [#42](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/42) | 回路スキャンの下位8bit IDと高位状態を正規アクセサへ変更 |
| [#43](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/43) | 実マウス長押しによる2個の連続ブロック破壊 |
| [#44](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/44) | 実マウス右長押しによる2個の連続ブロック設置 |
| [#45](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/45) | 2×2 UIの複数素材レシピ・途中不一致・正確な消費 |
| [#46](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/46) | クラフトした武器の実GUI装備・近接ダメージ・耐久・Mob除去 |
| [#47](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/47) | 実チャンクの回路登録・ダスト強度・ランプON/OFF・比較器1tick遅延。VM側方位も実定義へ修正 |
| [#48](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/48) | 実チャンクのピストンアニメーション・ブロック移動、ホッパーの実チェスト転送、TNTのPrimed Entity生成 |

### 現在も残っている範囲と完了の条件

1. **Mobの長期行動とプレイヤー防御**：自律移動中の戦闘・敵からの継続被弾・盾/防具の実UI連携・死亡/リスポーンを、独立のE2Eで固定する。
2. **複雑な機構と長期クロック**：実TNT爆発によるチャンク破壊・連鎖爆発・Mob/プレイヤーダメージ、回路の長周期安定性・複雑な機構間接続を再現環境で確認する。
3. **描画厳密性**：現在はフレームバッファ非黒・非透明とテクスチャアトラス変化のスモーク確認のみ。GPU描画結果のUV/頂点色/AO・チャンク境界を、変更前後の画像オラクルで比較する。
4. **構造上の残り**：Block ID直接ビット演算の未移行サイト、ワールド生成・メッシュ・描画素材・UI/入力の残る複合責務を、意味を保ったテスト先行の独立PRで抽出する。
5. **実セーブデータ**：合成旧スキーマのロード・保存・リロードは通過したが、利用者の歴史的な実保存ファイルは未提供。全実ファイルとの互換は未確認。
6. **CAT-TDDの正式Gate**：PRの差分／pre-change Green検査は導入済み。ただし正本のconfirmed仕様/Work/TestModelがなく、process-closure・model-conformance・implementation-conformanceは依然`not-run`。CI成功を適合証拠と置き換えない。

以下の「PR #36統合後」の節は当時の履歴であり、最新の状態・残作業の判定はこの節を優先する。

## 最新状況（2026-10-15、PR #36統合後）

現在の`develop`はNode.js **265テスト成功 / 失敗0**（Actions #38659175936）とChromium実ブラウザCI成功（#38659175937）。過去の「未検証」「未統合」という記述は当時の履歴であり、最新状態は本節と以下の各PRの追記を優先する。

| PR | 変更範囲 | develop統合SHA | 統合後構造CI / Chromium CI |
| --- | --- | --- | --- |
| [#33](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/33) | チェストUIクリック（全量取出／1個返却）・E閉鎖 | `154817a3b89fafde76832a2ccca162e915c61000` | #38657885487 / #38657885298 成功 |
| [#34](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/34) | 回路機構適用の責務分離と4統合テスト | `be5597479eaff64e7dabdfa54b3b9ed227e643e3` | #38658402112 / #38658402074 成功 |
| [#35](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/35) | 盾の実UI装備・クラフト材料出入のブラウザ検証 | `b63994647cb0dcd27c4ef21f4d91b5683f14dd3f` | #38658854619 / #38658854620 成功 |
| [#36](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/36) | 実クラフトレシピ完成品クリックのChromium検証 | `179f18aa451903f9f08fb6169ab47a2477925090` | #38659175936 / #38659175937 成功 |

優先して残る作業：
1. **操作とMobのブラウザE2E**：ブロック破壊・設置のマウス長押し、実ポインタロック時の連打/解放、Mobへの物理クリック攻撃、装備時の防御・耐久・戦闘挙動、複数素材レシピとクリック連打。
2. **回路の実体連動**：コンパレーター・ピストン・ホッパー・TNTアニメーションと長期クロックを、実チャンク・Mob・描画を含めた環境で検証。
3. **描画とブロックID境界**：メッシュUV/チャンク境界/照明/AO・GPU出力の画像比較、およびBlock IDアクセサの残存箇所調査と変更前後のパリティテスト。
4. **セーブ形式・移行**：実ユーザーの過去の保存ファイルとの互換性。現状は合成の旧形式JSON、実ノイズ・編集マーカーのパリティのみ。
5. **正式なCAT-TDDゲート**：変更の対象・実行証拠・レビュー・スコープの正式な自動検査は未完成。

`main`および提出済み`PR/01-structure-and-pages`・`PR/02-bugfixes-and-refactor`は本バッチでも変更していない。今回のリファクタは従来のゲーム仕様/保存構造を変更しない範囲とする。

## 残作業の順序

| 順位 | 範囲（主なファイル） | 目的と完了基準 | 状態 |
| --- | --- | --- | --- |
| 1 | Block ID/状態の境界（01, 03, 05, 06, 07） | 8bit ID/高位状態の契約をテスト化し、基礎ヘルパーを導入。今後の全呼出箇所統一は未着手 | 一部完了（blockBaseId/blockState） |
| 2 | メッシュの頂点色・照明・AO（03, 05） | 頂点色の角AO・ブロック光、光源探索・減衰伝播を分離済。atlas UV更新などは残存 | 一部完了（meshVertexColor/collectBlockLightSources/propagateBlockLight） |
| 3 | 地形生成・装飾（03） | 地形列・樹木装飾・保存済み編集の適用を独立化。鉱石・洞窟、草花の細分化は残存 | 一部完了（fillTerrainColumn/decorateChunkTrees/replayChunkEdits） |
| 4 | 回路・機構（06） | リピーター遅延、オブザーバー変化検知、ピストンアニメーション完了、TNTブロック走査・ダメージ、回路tick時間制御を分離。信号源の収集を分離済み。導火線管理・回路全体の副作用整理と統合検証は残存 | 一部完了（updateRepeaterState/updateObserverState/finishPistonAnimation/collectBlastBlockChanges/damageBlastEntities/advanceCircuitClock 等） |
| 5 | Mob・戦闘・投射物（05） | Mob判断・移動・スポーン・体力処理、近接ヒットと死亡ドロップ、矢の速度生成・移動・命中を分離済。Mob描画・クリーパー爆発・攻撃全般の統合検証は残存 | 一部完了（applyMeleeHit/dropDefeatedMob/calculateArrowVelocity 等） |
| 6 | 移動・入力・ゲームループ（04-1, 08） | HUD・衝突・移動速度・速度ベクトル・フレーム時刻とFPS・空腹度・カメラ・水中表示を分離済。入力ポーズ・長押し再発行の一部を分離済み。フレーム全体の連携テストは残存 | 一部完了（advanceFrameClock/advanceHungerClock/updatePlayerCamera/updateUnderwaterVisuals 等） |
| 7 | 所持品・クラフト・UI（04-0, 09） | 装備・所持品・ホットバー・2×2クラフトの画面生成とクラフト完成時の副作用を分離。インベントリ開閉・クラフト完成/返却・保存済みクラフト欄初期化を分離。装備/チェスト/DOM連携と保存の統合検証は残存 | 一部完了（renderInventoryEquipmentPanel/OwnedSlots/Hotbar/Crafting） |
| 8 | リソースパック（10） | ファイル選択・ZIPエントリ走査・画像デコード呼出し・atlas描画を分離。実ZIPのSTORE/DEFLATEからPNGバイト列復元、標準アトラス復元の副作用順をモックで検証。PNGデコード・実ブラウザでの適用/復元は未検証 | 一部完了（collectPackHits/scanZipBlockEntries/decodePackImages/paintPackAtlas） |
| 9 | テクスチャ・設定・起動（01, 02, 11） | 設定の読込・数値範囲/型の正規化を関数に抽出。ノイズ・生成画像・DOM反映・起動順は残存 | 一部完了（hydrateSettings） |

## 先行成果（本計画以前）

インベントリ分類/2x2クラフト、チェスト、ドロップ物、ブロック書込、
チャンク境界再描画/ストリーミング、セーブ、流体スケジューラ/セル遷移、
チャンクメッシュの生成・形状UV・材質選択をそれぞれfeature経由で統合済み。

## 未検証項目・注意

- Node.js CIはWebGL表示・ユーザー操作の実機確認の代わりにはならない。
- `docs/architecture.md` の「今後の段階」は初期作成時の記述を含み、進捗は本計画を優先する。
- block ID/状態のエンコードを変更するとセーブと表示に及ぶため、まず調査・テストだけ実施する。
- 各ステージ完了時はこの表の状態とコミット、テスト実績を更新する。

## 実施履歴

- 2026-10-11: 頂点単位の遮蔽3点・ブロック光参照・陰影合成を `meshVertexColor()` として抽出。変更前後のCI成功。
- 2026-10-11: ブロックID下位8bit・状態の算術右シフトを明文化し、基本ヘルパーを導入。既存IDを再採番しない。

- 2026-10-11: 地形列のレイヤ生成と編集履歴の再適用を独立化。海岸/雪・洞窟/岩盤・樹木・編集反映の回帰テストを追加。

- 2026-10-11: 光源の探索と隣接6方向への減衰伝播を分離。チャンク境界、遮蔽、重複光源、光源撤去の回帰テストを追加。

- 2026-10-11: 回路コンテナのスタック充填処理を既存のチェスト充填関数に統一し、部分充填/強度の回帰テストを追加。

- 2026-10-11: 樹種別装飾を `decorateChunkTrees()` に抽出。オーク・トウヒ・アカシア、葉が幹を上書きする既存挙動をテスト。

## 追加の一括実行（2026-10-11）

- `feature/refactor-world-tree-decoration`: 樹木装飾を抽出し、樹種別形状とアカシアの幹上書き挙動を固定。
- `feature/refactor-redstone-dust-propagation`: 16反復のダスト電力伝播を独立化。断線、距離減衰、上限を固定。
- `feature/refactor-mob-ai-decision`: Mobのターゲティング・クールダウン・徘徊判断を移動物理から分離。
- `feature/refactor-resource-pack-hit-selection`: テクスチャ別名・アトラス順・tint指定の選択処理を分離。
- `feature/refactor-game-hud-presentation`: ゲームループ内のHUD文字列生成を分離。
- `feature/refactor-settings-hydration`: 保存済み設定の正規化を適用処理から分離。デフォルト、不正JSON、数値の上限/下限を検証。

### 次の作業候補（未完了）

1. ワールド生成の鉱石・洞窟、草花の抽出と保存済みワールドの広域スナップショット比較。
2. 回路の比較器・ピストン・ホッパー・TNT・アニメーションの副作用順固定と抽出。
3. Mob移動物理・投射物・スポーンとプレイヤー衝突処理の責務分離。
4. インベントリの状態更新と描画、リソースパックZIP解析/atlas反映の分離。
5. 描画マテリアル・設定UI・起動初期化の連携テスト。

実機未検証: WebGL表示、実際のゲーム操作、古い実セーブデータ、ZIPファイルとブラウザのDecompressionStream互換。

## 追加実施：回路、Mob、ZIP、投射物（2026-10-11）

- `feature/refactor-piston-push-selection`: `collectPistonPushLine()` を追加。押し出し順、上限12個、移動不可、液体、高度境界、格納を回帰テストで確認。
- `feature/refactor-mob-motion-physics`: `advanceMobPhysics()` を追加。重力、水中浮力、流体加速度、衝突、自動ジャンプ、スライム反発を回帰テストで確認。
- `feature/refactor-resource-pack-zip-scanner`: `scanZipBlockEntries()` を追加。ZIP内画像パス、名前の正規化、重複、未対応圧縮方式、EOCDなしのエラーを検証。**DEFLATE形式の実データ展開・破損ZIPの網羅的検証は未実施。**
- `feature/refactor-arrow-motion-collision`: `advanceArrowMotion()` と `resolveArrowCollision()` を追加。重力、位置、Mob/プレイヤーへの命中、盾、ターゲットブロック、寿命を固定。

### 続行の優先順位

1. 回路更新：`rsTick()` 内のコンパレーター・リピーター・オブザーバー出力と、`hopperStep()`、`animTick()`、TNTの副作用を段階的に分離。
2. プレイヤー移動：`loop()` の状態取得、衝突、カメラ、フレーム更新の分離とブラウザ実機の動作検証。
3. インベントリ：`renderPlayerInventory()` からデータ選択・装備・2×2クラフト画面の構築を分離。
4. リソースパック：DEFLATE展開・画像デコード・atlas更新・復元をそれぞれ検証して分離。
5. ワールド地形/描画：洞窟、鉱石、植生、照明・テクスチャの既存数値と画像の検証を拡充。

ブラウザ実機確認とCAT-TDD正式ゲートは未実施。CI成功は検証した範囲の挙動一致を示すもので、視覚的一致や既存セーブ全種の互換性を保証しない。

## 追加実施：ホッパー・コンパレーター・インベントリ・プレイヤー衝突（2026-10-11）

- `feature/refactor-hopper-transfer`: `hopperDirection()`、`hopperPushOutput()`、`hopperPullInput()` を抽出。搬出優先、上部コンテナ優先、落下アイテムの逆順探索、コンテナ欠損・方向を回帰テストで固定。
- `feature/refactor-comparator-output`: `calculateComparatorOutput()` を抽出。コンテナ信号優先、背面の代替入力、左右最大入力、比較・減算モードの値を固定。
- `feature/refactor-inventory-panel-sections`: `renderPlayerInventory()` の装備・所持品・ホットバー・クラフト構築を4関数に分割。27/9/4スロット、表示順、各クリック操作を固定。通知文字列の既存の演算子優先順位も維持。
- `feature/refactor-player-collision-step`: `advancePlayerCollision()` を抽出。移動、しゃがみ時の端判定、段差、水中の上昇、スライム、飛行解除を固定。

### 次回以降の残作業

1. 回路の出力信号収集・各パルス減衰処理、TNTの導火線更新と爆発エフェクト、ピストン周辺の視覚表現を機能単位に分割。
2. プレイヤー速度・水中判定・スタミナ/満腹度の進行とフレーム制御、Mobスポーン・被ダメージの分離。
3. インベントリの状態更新・装備操作・2×2クラフトの責務整理とDOM統合テスト。
4. ZIP DEFLATE展開・実画像のatlas適用/解除とテクスチャ・設定の再描画連携。
5. 地形生成・描画処理の残存部分とブロック状態アクセサ利用の拡大。

実機未検証の項目（WebGL描画、操作、既存セーブ、実ZIPデータ）とCAT-TDD正式ゲートは依然として未実施。

## 追加実施：回路状態遷移・TNT・ピストン完了・時刻管理（2026-10-12）

- `feature/refactor-repeater-observer-transitions` → `ad8f908`: `updateRepeaterState()`、`updateObserverState()` を抽出。リピーター遅延・中断、オブザーバー初回観測・変化時のパルスと向きをテスト。
- `feature/refactor-tnt-blast-effects` → `5b3ce18`: `collectBlastBlockChanges()`、`damageBlastEntities()` を抽出。チェスト内容物の先行ドロップ、連鎖導火線、破壊対象、エンティティ被害・反動と処理順を固定。
- `feature/refactor-piston-animation-completion` → `00d2f30`: `finishPistonAnimation()` を抽出。0.1秒の進行、ブロックの更新順、吸着/通常格納、エンティティ移動・終了時解放をテスト。
- `feature/refactor-circuit-tick-scheduling` → `481afd9`: `advanceCircuitClock()` を抽出。流体→回路→TNT→ピストンの更新順、10Hz更新、1フレーム3回制限、処理遅延の消化/破棄をテスト。

**別課題にする挙動候補:** `pushEnt()` はピストン伸長時に複数セルを順に調べるため、移動したエンティティが次のセルにも該当すると連続して複数ブロック分移動する。既存挙動を回帰テストに固定したが、仕様として妥当かは別途判断が必要。リファクタリングの範囲では変更していない。

**検証範囲:** 各featureにおける変更前・変更後のNode.js CIは成功。ブラウザ実機、WebGL視覚的一致、実セーブデータ、CAT-TDD正式ゲートの確認は未実施。

## 追加実施：プレイヤー速度・Mob生成/被ダメージ・画像アトラス・Mob更新（2026-10-12）

- `feature/refactor-player-velocity` → `310880a`: `playerMoveSpeed()` と `advancePlayerVelocity()` を抽出。飛行、ダッシュ、しゃがみ、水流・水中、蜂蜜、ジャンプ、落下速度下限を回帰テストで固定。
- `feature/refactor-mob-spawn-selection` → `d5218b3`: `selectMobSpawn()` を抽出。候補判定と `addMob()` を分離し、乱数の呼び出し順、昼夜、地面、上限、出現座標を回帰テストで固定。
- `feature/refactor-player-damage-mitigation` → `ba1604d`: `calculateArmoredDamage()` を抽出。装備4部位、70%軽減上限、最低1ダメージ、HP更新、死亡時処理順を固定。
- `feature/refactor-resource-pack-atlas-paint` → `f6e231e`: `paintPackAtlas()` を抽出。アトラスのベース画像、タイル順、ガラスの透明化、草の重ね描き・色乗算、保存失敗時の既存通知を模擬Canvasテストで固定。**実ブラウザや実PNGでの視覚確認は未実施。**
- `feature/refactor-mob-tick-scheduling` → `34596b8`: `advanceMobTimers()` と `updateMobPopulation()` を抽出。スポーン時刻、満HP時の回復タイマー維持、遠距離Mob削除と更新順序を固定。

### 続行対象（この節を最新とする）

1. プレイヤーゲームループ：入力・視点/カメラ・フレーム時刻・空腹度の更新の分離とDOM統合テスト。
2. Mob戦闘：スポーン・移動以外の攻撃、死亡ドロップ、投射物生成・Mob描画の副作用を分離。
3. インベントリ/クラフト：状態変更、装備操作、所持数とUI同期の検証を強化。
4. リソースパック：実ZIPのDEFLATE展開、PNGデコード、ブラウザでのアトラス適用/復元を検証。
5. レッドストーン/地形/描画：信号収集・爆発の時刻管理、鉱石/洞窟、テクスチャ更新、ブロックIDアクセサ使用範囲の整理。

各実装ブランチで変更前・変更後のCI成功を確認。新しい統合developの最終CI結果は別途確認すること。ブラウザ実機・実セーブの動作検証、CAT-TDD正式ゲートは未実施。

## 追加実施：ゲームループ時刻・Mob近接戦闘・矢生成・水中表示・PNGデコード（2026-10-12）

- `feature/refactor-frame-clock-hunger` → `f5a0b49`: `advanceFrameClock()`、`advanceHungerClock()` を分離。50ms刻み制限・FPS平滑化、300秒の空腹減少、ポーズとメッセージ時の停止、セーブ順を変更前後のCIで確認。
- `feature/refactor-mob-melee-loot` → `2d3fd61`: `applyMeleeHit()`、`dropDefeatedMob()` を分離。近接攻撃、耐久度、ノックバック、非敵対Mobの逃走、Mob削除後の独立ドロップ確率判定順を確認。
- `feature/refactor-arrow-launch-vector` → `ee6ac0f`: `calculateArrowVelocity()` を分離。発射位置、放物線初速、3回の乱数使用、メッシュ生成とシーン追加後に速度乱数を使う順序を確認。
- `feature/refactor-camera-underwater-view` → `026fb40`: `updatePlayerCamera()`、`updateUnderwaterVisuals()` を分離。位置・視点回転・FOV閾値、霧・背景・雲・オーバーレイの水中遷移をモックテストで固定。
- `feature/refactor-resource-pack-decode` → `1661fd0`: `decodePackImages()` を分離。対象ファイル選別・逐次処理・不正PNGのスキップ・デコード成功後の順序をモックで固定。**実PNGデコード、壊れた実ZIPの互換性と見た目は未検証。**

### これから優先する未完了の検証・分離

1. `src/js/04-1-input.js` の入力イベントとゲームループ・装備・インベントリ状態の責務整理と、ブラウザE2Eによる操作確認。
2. インベントリ所持数/クラフト処理の一貫性と、チェスト・保存・装備との状態遷移テスト。
3. 画像パック実ZIP（deflate-raw）・実PNG・アトラス復元とWebGLの描画互換性テスト。
4. 残るワールド生成の鉱石/洞窟/植生、回路の信号収集、描画色・Block IDアクセサの段階的整理。
5. 画面操作・Mob戦闘・セーブ復元・WebGL描画の実機確認とCAT-TDD正式ゲートの検証。

今回の回帰テストはNode.js vm、模擬DOM、模擬デコード・画像レンダラを含む。CI成功はブラウザでの視覚的一致やすべての動作互換性を保証しない。

## 追加実施：入力イベントのポーズ遷移（2026-10-14）

- `feature/refactor-input-pause-transition-20261014`：`04-1-input.js` の Escape 押下時のポーズ遷移を `openPauseMenuFromKeyboard(e)` に抽出。分岐条件、キー状態クリア、インベントリ/チェストの閉鎖、セーブ、長押し停止、ARIA属性、Pointer Lock解除の副作用順序を変更しない。
- `tests/refactor-input-pause-transition.test.mjs`：実イベント登録を模擬し、Escape 通常/リピート/開始前/ポーズ中、各種ショートカット、キークリア、セーブ時点、タイマー解放順を固定。変更前のテストコミット `3f0ab8a` でCI成功（Run #38496384238）。実装コミット `b7544c5` でもCI成功（Run #38496435713）。
- 初回テストコミット `2ec3379` はモックの `drag` 参照先を誤って失敗。レガシーの `let drag` を参照するテストに修正して成功したため、製品コードの挙動変更は不要だった。

### 依存関係と次の作業

- キー入力はゲームループの `keys`、選択中のホットバーと `setSel()`、インベントリ/チェスト状態、タイマー、Pointer Lock、セーブに直接結合している。今回抽出したのはポーズ開始処理のみ。
- 未完了：クリック/長押しイベント間の再発行と解除の検証、インベントリ・装備・クラフト・チェストの状態遷移、実ZIP/PNG、ワールド・回路・描画の残処理、およびブラウザ/E2E・実セーブ・WebGL・CAT-TDD正式ゲート。
- Node.jsのイベントモックによる成功はブラウザ実機操作の保証ではない。

## 追加実施：マウスボタン解放の状態整理（2026-10-14）

- `feature/refactor-input-mouse-release-20261014`：`04-1-input.js` の `mouseup` におけるタイマー解除と押下状態クリアを `releaseMouseInput()` に抽出。食事のtimeout、設置/破壊のinterval、ドラッグ、各フラグとタイマー値の更新順序を維持する。
- `tests/refactor-input-mouse-release.test.mjs`：実イベント登録の回帰テストで、全フラグの解除、タイマー値0への変更、副作用順、非押下時やポーズ中でもmouseupを処理する既存挙動を固定。
- 変更前テストのみのコミット `65305de` でCI成功（Run #38496664184）。実装コミット `a6e06a9` でCI成功（Run #38496697794）。
- Escapeポーズ時とmouseup時ではタイマー値を0へ戻すかどうかが異なるため、両処理を統一していない。マウス押下の再発行/繰り返し条件は未分離・未検証。

## 追加実施：クラフト完成時の状態遷移（2026-10-14）

- `feature/refactor-inventory-craft-completion-20261014`：`09-inventory.js` の2×2クラフト完成ボタンから `completeCraftingOutput(r)` を抽出。レシピ参照、素材スロット消去、完成品付与、通知テキスト、再描画の順序を維持した。
- `tests/refactor-craft-state-completion.test.mjs`：実際の `putInCraft` / `find2x2Recipe` / `consumeCraftSlots` と画面イベントを組み合わせ、所持数減少のタイミング、二重消費なし、レシピ不一致、空きスロット不足、完成品付与を固定。
- 変更前のテストコミット `23188fd` でCI成功（Run #38496900586）。実装コミット `c032613` でCI成功（Run #38496937526）。
- 保存・復元を跨ぐクラフトスロットの更新、実DOMクリック連打、チェストとの受け渡し、装備の再描画は引き続き統合テスト対象。クラフト通知の演算子優先順位は意図的に変更していない。

## 追加実施：リソースパックの実ZIP/DEFLATE検証（2026-10-14）

- `feature/refactor-resource-pack-zip-inflate-20261014`：ZIPエントリのDEFLATE展開を `inflateZipBlockPayload(raw)` に抽出。既存のSTORE、未対応方式のスキップ、複数エントリの順序を変更せず、元の `DecompressionStream('deflate-raw')` を使用。
- `tests/refactor-resource-pack-real-zip.test.mjs`：ZIPのローカルヘッダー・中央ディレクトリ・終端レコードを持つ実形式のZIPをNode.jsで生成。格納PNG、`zlib.deflateRawSync` で圧縮したPNG、無関係なパス、ファイル名の大小文字、重複、未対応方式、破損した圧縮ストリーム、終端レコード欠落を検証。PNG本体は1×1の実PNGデータで、展開バイト列の同一性を確認。
- 変更前のテストコミット `8ce8112` でCI成功（Run #38497149698）。実装コミット `62c13c1` でCI成功（Run #38497207488）。
- **未検証:** `createImageBitmap` による実PNG画像のデコード、ブラウザのDecompressionStream互換性、Canvasでのアトラス更新・復元、WebGLの視覚的一致、実ユーザーパック、古いセーブデータ。

## 追加実施：標準アトラス復元の責務分離（2026-10-14）

- `feature/refactor-resource-pack-atlas-reset-20261014`：`resetPack()` のCanvasサイズ更新・元画像復元・`refreshAtlas()` を `restoreDefaultPackAtlas()` に抽出。保存済みパック削除→アトラス再描画→通知の順を変更しない。
- `tests/refactor-resource-pack-atlas-reset.test.mjs`：保存キー削除、Canvas縦横更新、元画像の再描画、atlasのテクスチャ更新、通知の順を模擬Canvasでテスト。ストレージ削除例外があっても復元する動作、およびCanvas描画例外を成功扱いしない動作を固定。
- 変更前テストのみの `2e117b0` でCI成功（Run #38497381055）。実装 `83faf5a` でCI成功（Run #38497417631）。
- **未検証:** ブラウザCanvasによる見た目とテクスチャ転送、`createImageBitmap` 実PNGデコード、旧保存のアトラス画像を起動時に復元する経路、WebGL表示と古いセーブデータの相互作用。

## 追加実施：押下継続中の入力再発行（2026-10-14）

- `feature/refactor-held-mouse-dispatch-20261014`：`04-1-input.js` の180ms長押し再発行を `repeatHeldBlockBreak()` / `repeatHeldBlockPlacement()` に抽出。タイマー設定、ガード、ターゲットMob/ブロック選別、合成`MouseEvent('mousedown')`のイベント属性と副作用順を維持。
- `tests/refactor-held-mouse-dispatch.test.mjs`：元のイベント登録・interval callbackを実行する4件の回帰テスト。左押下のMob優先、ターゲット/押下解放、右押下のインタラクティブブロック除外、食料・ポーズ・ポインタ条件を検証。
- テストのみのコミット `0cc8ed5` でCI成功（Run #38501336207）。実装 `ab3df21` でCI成功（Run #38501386757）。
- **未検証:** ブラウザにおける合成mousedownのイベント配送先、ポインタロック状態、実マウスの同時押し/解放、長押しタイマーの実時間、インベントリ・チェストとのE2E連携。再発行による既存の副作用そのものは変更しない。

## 追加実施：インベントリ開閉とクラフト素材返却（2026-10-14）

- `feature/refactor-inventory-state-actions-20261014`：`09-inventory.js` から `toggleInventoryView()` と `returnCraftIngredient(id,i)` を抽出。既存の `toggleInv` 再割当位置、チェストを優先して閉じる分岐、Pointer Lockの取得/解放、描画の次フレーム遅延、素材返却→スロット消去→再描画の順を維持。
- `tests/refactor-inventory-state-actions.test.mjs`：開く/閉じる/チェスト優先/ロック例外/遅延描画キャンセル/素材返却/空スロットを6件で検証。
- テストのみ `bc3c252` のCI成功（Run #38501596468）。実装 `1f8d7fb` のCI成功（Run #38501643331）。
- **未検証:** 実DOMのクリック連打、チェスト・クラフト・装備・保存の複合状態遷移、ポインタロックの実ブラウザ挙動。古いDOMへの連打も含め動作を修正していない。

## 追加実施：保存済みリソースパックの起動時復元（2026-10-14）

- `feature/refactor-resource-pack-saved-atlas-20261014`：起動時に`PK`から設定を読み、`N`一致時に`Image.onload`でCanvasと`refreshAtlas()`を更新する処理を `restoreSavedPackAtlas()` に抽出。画像ロード非同期、例外処理、保存キーと再描画順を変更していない。
- `tests/refactor-resource-pack-saved-atlas.test.mjs`：保存画像の復元要求とload callbackの順序、アトラス寸法とimageSmoothing、保存形式不一致、欠損/不正JSON、ストレージ例外、未ロード時の既定画像維持を4件で固定。
- テストのみ `9102318`：CI成功（Run #38501818761）。製品コード抽出 `87db19c`：CI失敗（Run #38501860860）。既存アトラスresetテストのソース範囲抽出が新しい関数宣言の途中で切れてSyntaxErrorになったことが原因で、`tests/refactor-resource-pack-atlas-reset.test.mjs` の抽出終端を新しい関数境界に対応（`404fca3`）。修正後CI成功（Run #38501928865）。既存の副作用検証項目は削減していない。
- **未検証:** 実ブラウザでのImageデコード、Canvas視覚的一致、保存済みテクスチャ画像の起動後適用、各種PNGエラーイベント、WebGLのテクスチャ転送と描画。

## 追加実施：保存データからクラフト欄への初期化（2026-10-14）

- `feature/refactor-craft-slot-hydration-20261014`：`09-inventory.js` の `pendingCraftSlots` に基づくインベントリ起動時の2×2クラフト欄初期化を `hydrateCraftSlots(saved)` に抽出。4スロット、整数かつ正値のみ採用、欠損・不正値はnullへ正規化する既存規則を維持。
- `tests/refactor-craft-slot-hydration.test.mjs`：`04-0-player-ui.js` の `restoreSurvivalState()` と `09-inventory.js` の実初期化を連結し、保存済み配列の内容・切り詰め・補完・数値検証・生存状態の復元を5件で固定。
- テストのみ `d9261f2` のCI成功（Run #38502124816）。実装 `2b3610d` のCIは失敗（Run #38502165235）：既存 `tests/issue-5-crafting.test.mjs` が初期化1行だけを取り出し新しい依存関数を読み込まずReferenceErrorに。検証アサーションを変えず、依存関数もVMへ読み込むよう修正（`ff0b176`）。修正後CI成功（Run #38502233863）。
- 保存形式は変更しない。引き続き、実ブラウザでのロード直後のインベントリ描画、チェストや装備との同時操作、画面操作とセーブの統合E2Eは未検証。

## 追加実施：レッドストーン信号源の収集（2026-10-14）

- `feature/refactor-circuit-source-emission-20261014`：`rsTick()` から `collectCircuitSignalSources(list)` を抽出。レッドストーン登録の選別・状態取得後に呼び出し、出力Map `EM` の初期化、ボタン/ターゲット/オブザーバーのカウンタ減算、感圧板の設置判定、6方向と指向性信号出力を従来順に実施する。
- `tests/refactor-circuit-source-emission.test.mjs`：元の`rsTick()`をVM実行する4件の回帰テスト。ブロック/トーチ/レバーの6方向、リピーター/オブザーバー/コンパレーターの指向性、減算後パルス、コンパレーターの前tick `c.out`、遠距離と不正な登録の処理を検証。
- 変更前テストのみ `3303be6` でCI成功（Run #38502491758）。実装 `e1defbe` でCI成功（Run #38502534633）。
- **未検証:** 実ブラウザ上の回路・描画の同期、信号伝播と全機構の統合・複雑なクロック回路、TNT導火線/アニメーションの長時間副作用。既存のタイミングや出力強度の仕様は変更していない。

## 2026-10-14 継続実施分の統合結果

| PR | 範囲 | develop 統合SHA | 統合後Actions | 状態 |
| --- | --- | --- | --- | --- |
| #16 | 入力長押し時の破壊・設置再発行の分離 | `7ce525462e235b4445f50e614f65793b423fafc1` | #38501489970 成功 | 統合済み |
| #17 | インベントリ開閉・クラフト材料返却 | `c5a892d917a4661da315460f08b8cfed8e5a7d4f` | #38501735801 成功 | 統合済み |
| #18 | 保存済みリソースパックの起動時復元 | `d620bafe0d301bad5213ca57351f873e8ee3677f` | #38502022053 成功 | 統合済み |
| #19 | 保存からクラフト4枠への初期化 | `a4404d002d4a685a5234bf07beb9f5ca004f9d03` | #38502335830 成功 | 統合済み |
| #20 | レッドストーン信号源の収集 | `af61ba4a33961388cb170a20ddc4d369dc152c06` | #38502630072 成功（249テスト） | 統合済み |

本バッチの回帰テスト追加は合計23件（順に4・6・4・5・4）。全件について変更前テストCI、抽出後の修正済みCI、統合後CIで成功を確認した。途中でテストのソース抽出範囲または依存関数読込不足によって生じたCI失敗は、各記録どおりテスト実行環境のみを修正して解消し、不成功状態を統合していない。`main`および`PR/01-structure-and-pages`・`PR/02-bugfixes-and-refactor`は変更していない。

### 継続対象（優先順位）

1. **入力・インベントリE2E**：マウス長押し・キーボード・ポインタロック・装備・チェスト・クラフトと画面更新をブラウザで統合検証。保存・再開も含む。
2. **実リソースパック**：実ブラウザの`DecompressionStream`/`createImageBitmap`、CanvasとWebGLでの見た目、アトラスの適用・解除・保存復元の一致。
3. **ワールド生成**：鉱石・洞窟・植生の処理抽出、固定seedと編集済みワールドでの広域スナップショット回帰比較。
4. **回路・描画**：ダスト伝播と回路側各副作用、TNT導火線・各種機構の統合テスト、Block IDアクセサの適用範囲拡大、メッシュUV・画像復元の検証。
5. **実機・プロセスゲート**：既存セーブデータ互換、Mob戦闘と描画、WebGL、CAT-TDD正式ゲート。ブラウザ実機確認は未実施。

旧ゲーム動作の変更を伴う不具合修正・最適化は含めない。

## 追加実施：鉱石・洞窟・地表ブロック選択の分離（2026-10-14）

- `feature/refactor-terrain-voxel-selection-20261014`: `fillTerrainColumn()`内の海岸・雪原・通常地表/土層・鉱石・洞窟/溶岩へのブロック値選択を`terrainBlockValue(x,y,z,h,sd,bio)`へ分離した。既存の算出条件、ノイズ呼び出し順、岩盤上書き、標高返却値は維持。
- 変更前に`tests/refactor-terrain-voxel-parity.test.mjs`を追加。元コードの独立した固定参照と、原点/負座標/遠隔の3チャンク（合計768列）の全ボクセル値・高さ・ノイズ参照順を比較。海面/雪/洞窟/岩盤の追加比較を含む。
- テストのみ`451f642` のCI成功（Run #38506746790）。実装`b04da28`のCI成功（Run #38506787803）。
- **未検証:** 固定seedによる本番ノイズ関数を含む広域ワールドスナップショット、実保存済み編集との互換、ブラウザ描画・チャンク境界。これらは模擬ノイズの回帰テストと区別する。

## 追加実施：TNT導火線と爆発エフェクト更新の分離（2026-10-14）

- `feature/refactor-tnt-visual-tick-20261014`: `primedTick(dt)`の逆順TNT導火線・落下物理・爆発判定を`updatePrimedTnt(dt)`、爆発フラッシュの拡大・透明度更新・削除を`updateExplosionVisuals(dt)`へ分割。爆発で生成したFXを同tickの後半に更新する従来順序を維持。
- `tests/refactor-tnt-primed-visuals.test.mjs`: TNTの点滅/落下/着地/爆発、生成FXの同tick更新、既存FXの透明度と寿命、複数TNT逆順走査を4件でテスト。
- 初回テストコミット`52f29d5`のCIはテストfixtureが爆発時に配列から削除されたTNTを参照して失敗（Run #38506968144）。fixtureが元オブジェクトを保持するよう修正した`2c48ec1`のCI成功（Run #38507016671）。製品コード抽出`437e6d2`のCI成功（Run #38507085825）。テストの検証条件は維持。
- **未検証:** ブラウザ実機のFX表示、実レッドストーンとの継続動作・長期tickタイミング、複雑なTNT連鎖時の時間経過。描画最適化やゲーム仕様修正は対象外。

## 2026-10-14 追加の統合結果とブラウザ検証の障害

| PR | 範囲 | develop統合HEAD | 統合後Actions | 状態 |
| --- | --- | --- | --- | --- |
| #22 | 地形のブロック選択（鉱石・洞窟・植生のうち地表部分） | `5ddc3a3734a52225cf5f994df33aca27b725817e` | #38506879722 成功 | 統合済み |
| #23 | TNT導火線・落下と爆発エフェクトの更新 | `f5721391252e880cd137d6a3222f6acd55478d76` | #38507196103 成功 | 統合済み |
| #25 | Chromium browser smoke（テストとCIのみ） | — | #38507757181 **失敗** | Draft・**未統合** |

- Chromium CIの実行環境: GitHub Actions Ubuntu / Chromium Headless / Playwright。実WebGL2コンテキスト、画面起動、インベントリ・ポーズ操作、保存・リロード、実DEFLATE ZIPに含む実PNGを`createImageBitmap`でデコードしアトラスへ適用、アトラス復元の各操作を実行。スクリーンショットはAction成果物に保存。**視覚的なピクセル一致は未評価**。
- **未解決・別課題:** `updatePlayerCamera()` / `loop()` が `ReferenceError: cfg is not defined`を発生することを初回起動・リロード双方で確認。推定要因は`08-game-loop.js`のrAFが`11-settings.js`の`cfg`宣言より先に実行される読み込みタイミング競合だが、因果関係の確証はまだない。GitHub Issue #24に証拠・調査仮説を登録。`cfg`例外を無視するテスト緩和は行わず、CI失敗のDraft PR #25は統合しない。
- Pointer Lock中、開始ガイドのボタンに対するマウスクリックがガイド親要素に遮られた。検証では明示的にPointer Lockを解除して進んだ。自然なUI操作での期待挙動は別途確認対象。
- 現状では**ブラウザ実機の完全合格・ゲームループ継続・WebGL表示の視覚的一致・実セーブデータ互換性は未達**。本番データではなく自動生成データの検証範囲である。
- 続行候補: ブラウザ起動競合の原因確定（仕様変更と分離した修正PR）、長押しとチェスト・装備・Mob/実セーブのE2E、鉱石/洞窟/植生の実ノイズ分布スナップショット、回路全体とメッシュ/Block IDアクセサの統合検査、CAT-TDD正式ゲート。

## 追加実施：樹種別の樹冠配置分離（2026-10-14）

- `feature/refactor-tree-crown-placement-20261014`: `decorateChunkTrees()`から `decorateTreeCrown(kind,tx,tz,h,tall,leaf,set)`へ樹冠形状を分離。幹生成の後に樹冠を更新する順序、葉が幹を上書きするアカシア、soft葉の既存遮蔽、チャンク外への配置無視を変更しない。
- `tests/refactor-tree-crown-parity.test.mjs`: 樹種oak/spruce/acacia/jungle/birch×原点・負座標・チャンク境界の計20条件で、旧実装固定参照と全ボクセル値・生成高さ・ノイズ参照順を比較。海岸・低高度・高度制限条件を追加検証。
- 変更前テストコミット `16b2834`、CI Run #38508188733 成功。実装コミット `f11c8a4`、CI Run #38508243349 成功。
- **未検証:** 本番ノイズ関数込みの固定seedでの大域分布、保存済みワールド全体での実データ比較、ブラウザWebGL表示とピクセル一致。これらは上記模擬環境の一致と区別する。

## 2026-10-14 本バッチの最終確認（PR #27まで）

| PR | 統合HEAD | 統合後CI |
| --- | --- | --- |
| [#22](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/22) 地形ボクセル値 | `5ddc3a3734a52225cf5f994df33aca27b725817e` | #38506879722 成功 |
| [#23](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/23) TNT/FX tick | `f5721391252e880cd137d6a3222f6acd55478d76` | #38507196103 成功 |
| [#26](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/26) 診断結果記録 | `5098e128e4a4a2ead9859f374aab921968d08036` | #38508057983 成功 |
| [#27](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/27) 樹冠配置 | `9971ad930fb7ab2c360854ea0b47928c61308809` | #38508333632 成功 |

- 最終確認時点ではNode.js回帰テスト **257件成功・0件失敗**。本バッチの新規テストは8件（#22:2 / #23:4 / #27:2）。本番コードの変更は上記3領域の責務抽出のみ。
- ブラウザ側の未統合Draft [#25](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/25) は、実WebGL2・操作・ZIP/PNG読込・セーブの検査を実行した一方、`cfg`未初期化の例外によりCI不合格。原因候補は [Issue #24](https://github.com/surumeneco/Minicraft-Ver.1.2-/issues/24) を参照。**ゲームループ継続・WebGLの視覚的同一性は未確認**。
- `main`と提出済み`PR/01-structure-and-pages`・`PR/02-bugfixes-and-refactor`の保護対象SHAに変更なし。
- 今後：Issue #24の因果関係を調査し、必要なら仕様変更と分離した修正PRでブラウザCIを合格させる。実セーブファイルを用いた互換検証、長押し/装備/チェスト/Mobの実機操作、実ワールド広域生成、回路・Block ID・描画全域、CAT-TDD正式ゲートは未完了として継続する。

## 2026-10-14：Chromium常設CIと本番ノイズのスナップショット

- [PR #29](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/29)：ゲームループ初回の`requestAnimationFrame(loop)`を`08-game-loop.js`末尾から`11-settings.js`の`applyCfg()`後へ移動し、ブラウザの`ReferenceError: cfg is not defined`を修正した。登録時機のみの不具合修正であり、ループ1フレーム中の更新順は不変。既存ポーズ回帰テストの初回スケジュール期待値も実際の移動先に対応。feature CI #38559817161成功、統合後CI #38560160208成功。
- [PR #30](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/30)：Chromium/Playwright常設CI導入。WebGL2取得、ゲームループ継続、開始ガイド/インベントリ/ポーズ、JSONセーブと再読込、実DEFLATE ZIPからのPNGデコード、アトラス適用と保存復元の**Canvas画像バイト同一**・既定アトラス再描画、全JavaScript実行時例外なしを確認。feature CI #38560237258、統合後CI #38560420105成功。画像の見た目・ピクセル単位のWebGL画面比較は対象外。旧Draft #25は後継に置換・閉鎖、Issue #24は解決済み。
- `feature/world-noise-save-snapshot-20261014`：`tests/refactor-real-world-noise-snapshots.test.mjs`を追加。旧`01-block-registry.js`の実`hs/vn/vn3`と実`03-world.js`で8チャンク生成（原点・負座標・遠隔座標）、全80層×16×16ボクセルのLEバイト列SHA-256・標高・ブロック数・水量・樹木関連ブロック数を固定。さらに編集済み3箇所を反映した別スナップショットを固定。樹種の数値IDだけはVMの再現用固定マップであり、実レジストリ全体や実保存ファイルの互換性検証ではない。
- 変更前に実ノイズ出力値を取得したCI #38560851898成功、固定ゴールデン値を追加したCI #38560995253成功。続いて`biomeAt`から純粋な`classifyBiome(a,b,h)`を抽出、ノイズ取得→必要時の高さ取得→分類の順を変更せずに最終CI #38561076944成功。
- **今後の優先事項**：既存ユーザー由来の旧保存実例の互換性、Mob/装備/チェスト/長押し/リロードのブラウザ統合、チャンク境界における描画ピクセル差分、レッドストーン回路の連動、CAT-TDDの正式実行記録。

## 2026-10-14：Chromiumの旧形式保存データ検証拡張

- [PR #32](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/32)：従来形式に相当する欠損フィールドを含む**合成保存データ**を隔離されたChromium `localStorage`へ事前投入し、`loaded`を確認。旧ホットバーID（24/25→1）、所持品、チェスト格納内容、チャンク編集Map、HP/満腹度のフォールバック、空クラフト枠の初期化をブラウザ上で検証。
- 復元後`save(false)`を実行してシリアライズしたデータの`invCount`/`ch`/`e`/`craftSlots`を確認し、ページ再読込後の所持品継続をチェック。旧形式のユーザー実ファイルは入手していないため「実際の古いセーブデータで互換検証が完了」とは扱わない。
- 従来のブラウザスモークテストで、旧時点の全視点角度や厳密なtick直後の`worldClock`を期待して誤判定しうることが判明。前者は視点ロック/入力による変化、後者は正常なゲームループの時間経過のため、保存を検証する対象フィールドと進行状態を切り分けた。異常を隠すための包括的な例外無視は導入していない。
- `.github/workflows/browser-smoke.yml`：`develop`へのpushに加え、**すべての`develop`宛PRイベント**でChromium CIが動く設定に変更。後続PRでも実ブラウザエラーを捕捉するゲートとなる。テスト追加後のPR CI成功：#38562186347（Chromium）、#38562186360（構造）。
- **継続未完了**：ユーザーの実旧セーブファイルとの照合、Mob戦闘と装備/チェストの実UI操作、任意プラットフォームのGPUと視覚的なWebGLピクセル比較、CAT-TDD正式ゲート。

## 2026-10-14：Chromiumチェスト操作の回帰検証

- `feature/browser-chest-interaction-20261014`：Chromiumに合成セーブを読み込ませた後、ゲーム開始→Pointer Lock解除→ガイドを閉じる→`openChest`経由でチェストUIを開き、**実DOMへの左クリック**でスタック全数取得、**右クリック**で1個返却、`E`キーでUIを閉じる状態遷移を検証。アイテム数とチェストのスロット内容の前後一致を確認する。
- 対象のチェストデータとアイテム数はテスト内で生成し、`openChest`をブラウザ側から呼び出す。ゲーム画面内でレイキャストしチェストブロックを開く操作、実ユーザーの保存データや同時押しは依然として検証対象外。
- 統合後のブラウザCIを継続必須とし、構造テストだけで完了扱いにしない。

## 2026-10-15：レッドストーン回路の連動テスト・機構適用責務分離

- [PR #33](https://github.com/surumeneco/Minicraft-Ver.1.2-/pull/33)（先行統合済み）：実ChromiumのチェストUIで左クリックのスタック全取得、右クリックの1個返却、Eキーによる閉鎖を検証。feature構造CI #38562940282、Chromium CI #38562940425が成功、`develop`統合後CI（構造 #38657885487、Chromium #38657885298）も成功。
- `feature/refactor-integrated-circuit-consumers-20261015`：`06-circuits.js` の`rsTick()`から`applyCircuitConsumers(list,dust,nd)`へダスト状態適用・ランプ/TNT/リピーター/コンパレーター/オブザーバー/ピストン/ディスペンサー/ドロッパー/ホッパーの副作用処理を分離。電源収集→16パスダスト伝播→ブロック変化蓄積→装置副作用→変更一括適用の順序は不変。
- `tests/refactor-circuit-consumer-integration.test.mjs`：実`outAt/cpow/rsTick`で電源からダストを経てランプの点消灯、リピーター遅延、TNT単回起爆、ディスペンサー立ち上がり検出と電源切断後の再発火を4件の状態連動テストで確認。
- 変更前テストのみCI #38658020214成功。抽出直後 #38658070298 は引数`dust`の受け渡し漏れで失敗（実装上の抽出不具合でありテスト緩和ではない）。`dust`を明示的に渡す修正`6822830`で #38658131905成功。
- **残る検証範囲**：TNT実オブジェクト/各種回路装置の連鎖、長時間クロック回路の状態、レッドストーン・Mob・装備・入力・描画のブラウザ実運用E2E、実ユーザー旧セーブ。回路統合テストは世界状態のMapと機構を仮想化したNode.js VMであり、ブラウザの視覚的な一致は意味しない。

## 2026-10-15：実ブラウザインベントリ・装備・クラフト操作

- `feature/browser-inventory-equipment-crafting-20261015`：合成旧セーブを読み込んだChromium上でチェスト操作→Eで閉じる→Eでインベントリを開く→「インベントリ」タブの実スロットをクリックして盾を装備→表示を再描画して装備欄反映を確認する。さらに鉄インゴットの実スロットをクリックして2×2クラフト枠へ移し、枠のクリックで返却。所持数と枠の前後一致およびEによる閉鎖を検証。
- 上記は既存プレイヤーUIイベント処理とブラウザDOMの連動試験。レシピ完成品の作成、実マウス長押し、攻撃/Mob戦闘、装備の効果量、実ユーザー旧保存ファイル、GPUピクセル差分の検証は未完了。

## 2026-10-15：Chromiumでのレシピ完成品生成

- `feature/browser-craft-completion-20261015`：プレイヤーインベントリに実レッドストーン素材を追加し、実DOMクリックで2×2クラフト枠に置き、「レッドストーンダスト」のレシピ一致表示を確認。完成品スロットをクリックし、素材が1つ減少、完成ブロックが1つ増加し、クラフト枠が空になることをChromiumで検証。
- 前段で実施済みの盾の装備、鉄インゴットの投入・返却、チェストの1個／スタック移送、保存・再読込と同じブラウザ文脈で動作させる。
- **未検証**：2×2を超える多素材レシピ、完成品クリック連打の実時間、マウス長押し、Mob戦闘、ユーザー実保存ファイル、WebGL画面のピクセル一致。

## 2026-10-15：実マウス押下／解放とMob攻撃のChromium E2E

- Chromium上の実mousedown/mouseupをWebGLキャンバスに送り、左長押し・右長押しタイマーの有効化／解放を検証する。入力状態の比較はブラウザ実時間で実施。標的ブロック不在の場合の繰返しによる破壊／設置回数はここでは主張しない。
- プレイヤーを空中に配置してカメラ方向の手前に本物のMobメッシュを生成し、実カメラRayで当たり判定を確認した後、Chromiumからクリックして近接ダメージを検証する。
- 未検証：プレイヤーの長押しによる連続ブロック破壊／設置・物理衝突、Mob長期AI・戦闘中の敵からのダメージ、任意GPUの描画パリティ。

## 2026-10-15：GPUフレームバッファ検査

- Chromium Headlessでゲームを起動してシーンをレンダリングし、同じJSタスクでWebGL2の`readPixels`を実行する。描画バッファに有効な幅・高さ、非透明ピクセル、非黒ピクセルが存在することを確認する。WebGLコンテキストが取得できるだけの検証から、GPUレンダリング出力の検証へ範囲を拡大する。
- **証明範囲の限界**：GPU出力が存在することのスモークチェックであって、全ブロックのUV・AO・照明や前回バージョンとの画素単位の一致を意味しない。これらを完了と記録しない。

## 2026-10-15：回路機構の追加連動テスト

- 実`rsTick()`と実`outAt/cpow`を連結したVM検証に4件追加：コンパレーターの前tick出力・電源遮断後の遅延反映、オブザーバーの前方ブロック変更検知と背面パルス、ホッパーの4tick周期、ピストンの電源ON/OFF通知。
- テストは実回路ステージと状態遷移を通すが、実`hopperStep`や`pistonTick`等の物理ブロック移動はイベントとして記録する。複雑な長周期クロック、実ブロック編集・描画・実Mobの副作用をカバーしたとは扱わない。
- この変更はテストと文書のみ。生産コード、ゲーム仕様、保存形式は変更しない。

## 2026-10-15：CAT-TDDへの接続準備・refactor事前Greenゲート

- `scripts/refactor-change-evidence.mjs` / `.github/workflows/refactor-evidence.yml`：`develop`宛PRのproduction差分には、テストと挙動・スコープ記録を必須とする。`refactor:`のproduction PRでは、新しいテスト一式をbase時点の旧実装で走らせる **pre-change Green** を追加する。BugfixのRedを不当に拒否しない。
- `tests/refactor-change-evidence.test.mjs`：diff分類、テスト欠損、文書欠損、refactor baseline、bugfix、doc/test-onlyの選別を6件で固定する。
- [CAT-TDD正本](https://github.com/surumeneco/CAT-TDD)の正式3 Gateは、Work・confirmed仕様・TestModelの成果物と独立実行証拠が未準備のため **not-run**。Green CIをCAT適合passへ昇格させない。詳細は `docs/cat-tdd-integration.md`。

## 2026-10-15：回路登録走査のBlock ID/状態アクセス境界

- `06-circuits.js` の`rsTick`登録走査で下位8bitのID抽出`v&255`と状態`v>>8`を共通`blockBaseId(v)`/`blockState(v)`呼出しへ統一した。符号付きビット演算の既存セーブエンコードは変更しない。
- 変更前にVMの回路ハーネスへ同等アクセサを用意し、高位状態17のリピーターでも登録IDが変わらない回帰テストを追加。変更前CI #38661350206成功、実装後CI #38661397550成功。
- この変更は`rsTick`の登録走査の範囲であり、全ファイルの直接ビット演算置換ではない。処理全体の置換を安全に完了したとは記録しない。

## 2026-10-15：マウス長押しでの連続ブロック破壊ブラウザE2E

- 実ゲーム内の高高度でカメラ視線上に2つの通常ブロックを配置。Chromiumの実マウス押下を保持し、最初の直接破壊後に約180ms毎の繰返し経路を通して**両方のブロックが消失**するまで確認し、mouseupでタイマーと保持状態が解放されることを検証する。
- スクリーンショットのみではなく実`getB`で世界状態を確認する。現時点で右ボタンの継続設置、実ユーザー旧セーブ、Mobの長期AIは別途検証対象。

## 2026-10-15：右長押しの連続ブロック設置E2E

- Chromiumの右ボタンを押下保持し、視線の先にある実ワールドブロックの手前2セルへ、実`getB`の状態として選択ブロックを連続設置する検証を追加。
- 1個目は実マウス押下、2個目は既存の180ms長押し処理が生成する`mousedown`によって設置されることをイベントの`isTrusted`で識別する。解放で保持状態とタイマーをリセット。
- 追加の実ブラウザ検証であり、実装や保存形式、ブロック配置のゲーム内ルールは変更しない。

## 2026-10-15：複数素材の2×2クラフト完了E2E

- 鉄インゴット2個と棒1個を、実Chromiumで素材所持欄から2×2へ3回クリック投入する。
- インゴット2個のみの段階では「レシピなし」となること、棒を加えると「鉄の剣」が表示されること、完成品クリック後に素材消費が正確で完成品が1個増え、クラフト欄が空になることを検証する。
- 単素材クラフトに続く、異なる素材・重複素材・投入途中のレシピ照合とUI副作用の統合検証。保存形式の変更はない。

## 2026-10-15：装備した武器のMob近接攻撃ブラウザE2E

- 2×2クラフトUIで生成した鉄の剣を実インベントリのスロットから装備し、Mobを実マウスクリックで攻撃する。装備中ID・武器固有ダメージ・耐久消費・Mobの死亡時除去を検証する。
- Mobの位置は入力操作試験中にテスト側で安定化させる。Mob自律移動の包括的E2Eとは区別。productionコードに変更はない。

## 2026-10-15：実チャンク・レッドストーン回路のブラウザ統合検証

- ブラウザ起動中の実チャンクに`setB`でレッドストーン電源・ダスト2個・ランプを構築。登録済み回路の`rsTick`と実`applyChanges`を走らせ、ダスト強度15/14・ランプON、電源撤去後のOFFを実`getB`で比較する。
- 最初のダストを実コンパレーターへ置換し、入電→1tick後の出力・遮断→1tick後のOFFを検証。終了時はテストブロックを撤去する。
- 従来のVMモックのイベント検証と異なり、本テストでは実世界チャンク書込み・RS登録とブロック状態変化まで接続する。ただしピストン・ホッパー・TNTの実世界副作用やGPU視覚差分は別途。

- 初回ブラウザ検証でVM側のテスト仮想D4方向定義がproductionの方向配列と南北逆であると判明。ブラウザ実環境のコンパレーターはD4[2]（南・+Z）にし、VMハーネスのD4も実コードと一致させた。元のテストの成功を機構全体の向きパリティ証明には使わない。

## 2026-10-15：実チャンク上の機構3種類E2E

- ピストン：実ワールドのピストンの背面に電源、正面に石系ブロックを置き、`rsTick()`と`animTick(.15)`で延伸予約→実アニメーション完了→ブロック移動・ヘッド設置を確認。電源除去→引戻しアニメーション完了後も移動済みブロックが残る（非粘着型）ことを確認。
- ホッパー：上下の実チェストから中継アイテムが4tick目にホッパーへ、8tick目に下のチェストへ移ることを実コンテナ配列で検証。
- TNT：電源ONのTNTが実ブロックから除去され、`primed`の可視`THREE.Group`と4秒の導火線が生成されることを確認。テストの設置ブロックとPrimed Entityは終了時に撤去。
- **対象外**：実爆発による地形破壊／Mobへの爆風・描画ピクセル比較・長時間の自動クロック安定性。対象外を完了と扱わない。

## 2026-10-15：TNTの導火線完了・爆発副作用の実ブラウザ検証

- 実チャンクで通電したTNTをprimedとして発火後、導火線をテスト用短縮して`primedTick`で実`blast`へ遷移させる。導火線エンティティ除去、爆発エフェクト生成、近接ブロック破壊、チェスト内素材のドロップ、至近距離Mob被弾と消滅を確認。ゲーム本体の爆発仕様には変更なし。
- テスト座標・ドロップ/エフェクトは終了時に後片付け。別TNTへの連鎖、プレイヤーの実UI防御、長期時計は独立検証対象。

## 2026-10-15：実GUI防具・Shift盾・敵の近接攻撃ブラウザE2E

- ChromiumのインベントリUIで鉄チェストプレートを装備後、実`hurt(10)`と`calculateArmoredDamage(10)`で残HP・軽減量を確認。
- 実キーボードのShiftで盾を構え、近くのゾンビの実`chooseMobSpeed`攻撃で前方の近接ダメージを防ぐこと、Shiftを放すと防具軽減後のHP減少が再開することを確認。実Mobを追加・削除し、テスト中にのみ足場を生成。
- Mob自律移動の長期tick・リスポーン時の全周辺状態復旧・描画のピクセル変化はこの範囲外。

## 2026-10-15：回路登録と旧セーブ編集走査のBlock ID境界

- `rsReg`と`scanRS`が参照する`v&255`を既存の`blockBaseId(v)`へ統一。登録状態、保存編集からの復元時座標、非回路高位state ID誤認の防止をテスト先行で4ケース固定した。
- productionコードの最小変更前Node構造CI #38682774195成功。セーブ形式・内部登録Map構造・並び順は変えない。
- スコープは回路登録と編集走査の2箇所。全ファイルの直接ビット演算置換とは扱わない。

## 2026-10-15：回路の長期10Hz相当動作と遅延フレーム処理

- 実チャンク内のレバー→ダスト→ランプを実`rsTick`で通電600tick（60秒相当）、非通電600tick、さらに120回のON/OFF往復（240tick）で検証。持続時の信号強度・ランプ状態、連続切替の誤動作0件、ブロック撤去後の登録解放を確認する。
- 実`advanceCircuitClock(.8)`で1フレーム最大3tick・残り`.5s`が`.3s`を超える場合の積み残し切捨て、次フレームでホッパーの4tick目が処理される挙動を検証。
- CPU処理上のtick相当であり、実時間2分のブラウザ放置や異なるGPUでの描画・ネットワーク同期ではない。

## 2026-10-15：PR変更前後のGPUレンダリング画素比較ゲート

- `tests/browser/visual-parity.mjs`と専用GitHub Actionsにより、production JS/HTML変更PRではbaseコミットと候補コミットを同じChromium/SwiftShaderで実描画し、固定シード・ワールド・カメラ・光条件の96×60 RGBサンプルを比較する。閾値超過差分が1%を超えたら失敗。
- 画素が非空である従来のスモーク検証に加え、**変更前後の出力が一致することの証拠**を導入。全GPU・全描画状態での完全画素一致までは対象外。詳細は`docs/visual-parity.md`。

## 2026-10-15：敵Mobの長期追跡・連続攻撃・死亡復活E2E

- 床を実チャンクに作成し、プレイヤーの5ブロック前方にゾンビを生成。実`stepMob(.1)`を最大180回進め、接近、実`hurt()`によるHP減少を検証する。
- 連続戦闘後、実`hurt(1000)`により死亡→`respawn()`のHP/満腹度/座標回復・敵Mob解放を検証する。実時間長期の完全自律プレイ・複数種Mob同時混在は対象外。

## 2026-10-15：Mob更新の描画ポーズ投影を分離

- `stepMob`に残っていた歩行位相・4本の脚の回転・描画グループの位置/向き更新を`updateMobPose`へ抽出。AI判断、導火線終了、移動物理、世界底部での早期除去との副作用順は変更しない。
- 4件のテストで移動後の脚位相・向き、立ち止まり、爆発優先終了、世界底部除去を旧コードで固定。source変更前Node CI #38684048811成功。PR変更前Greenと変更前後WebGL画素比較もゲート。

## 2026-10-15：地形生成の洞窟上書き条件を分離

- `terrainBlockValue`で表土・下層/鉱石を選んだ後の洞窟/溶岩上書きを`applyCaveOverride`へ抽出。鉱石noise→cave noiseの呼出し順、深度y=4境界、y=11/12の溶岩/空気、地表・水の処理は変更しない。
- 既存の広域チャンク全ボクセル/ノイズ呼出し順オラクルに、上記の深度境界を明示する回帰テストを追加。変更前CI #38684348702成功。変更後はrefactor事前GreenとChromium、旧版とのWebGL差分検証を実施する。

## 2026-10-15：チャンクメッシュ草花生成の責務分離

- `mesh(c)`内に混在していた草・花・バラ低木の頂点/色/三角形構築処理を`appendChunkGrassGeometry(GS,c,x,y,z,seed)`へ抽出。チャンク走査の順序・雑草の枝数・花の形状・3D座標/色・描画GPUの振る舞いは変更しない。
- 変更前に3テストで刈り込み、草の四辺形・三角形頂点、白/黄/赤花、バラ低木の構築数とノイズ問い合わせ順を固定。変更前CI #38684656484成功。PRの旧コード回帰Green・変更前後GPU差分・Chromiumが通るまで統合しない。

## 2026-10-16：矢の姿勢描画を物理・当たり判定から分離

- `05-entities.js` の `arrowTick` で衝突除去を終えた後の位置・進行方向描画を `updateArrowPose(a)` に独立化。物理更新→命中判定→終了物除去→生存する矢の `position.set`/`lookAt` という順序を保持する。
- 旧実装を使う変更前Greenテストを追加し、矢2個の逆順更新、消滅矢の描画呼出し無し、更新済み速度に基づく視線を検証する。既存の矢物理・命中回帰テストも継続。
- `main`および提出済み `PR/**` には変更しない。GPUのbase/head完全フレーム比較CIで描画等価を確認する。

## 2026-10-16：TNT導火線の点滅表示を運動・爆発処理から分離

- `06-circuits.js` で導火線の減算後に実行されていた赤/白マテリアル選択、帯の色、1.06倍スケーリングを `updatePrimedTntFlash(p)` に抽出。演算順と引数/状態の受け渡しを変更しない。
- 変更前CI #38845031208で、新しい「1秒未満で周期4→8切替」「最後の描画更新→除去→blast」という2件を旧実装上で先行Green確認済み。既存のTNT演出テストも通過。
- 実用描画の同一性はPRの全フレームWebGL SHA-256比較と実Chromium smokeで確認する。実ユーザー旧セーブ・正式CAT-TDD Gateは今回対象外。

## 2026-10-16：リソースパックのアトラスタイル解像度算定を分離

- `10-resource-packs.js` の `applyPack` 内で画像デコードや描画と混在していたタイル解像度計算を `selectPackTileSize(hits)` に独立化。ヒット順の最大値・短辺採用・16pxの下限・128pxの上限とアルゴリズムの数値順序を変更しない。
- テストを先に追加し、16/20/64/128px、512pxからの上限丸め、4pxからの下限丸め、選択画像複数件での最大優先を旧実装で検証。変更前Structural CI #38845522837成功。
- 実描画の同一性はChromiumと全フレームWebGL画素比較ゲートで確認する。既存pack保存仕様は不変。

## 2026-10-16：入力の衝突・長押し設置におけるBlock ID境界

- `04-1-input.js` の `hit` / `hitSwim` の非衝突ブロック判定と、`repeatHeldBlockPlacement` の操作対象種別判定について、直接の `&255` を既存 `blockBaseId` アクセサに置換する。共通IDのエンコード方法、判定の短絡順、座標走査、設置の実行条件は変更しない。
- 新規 `tests/refactor-input-block-id-boundaries.test.mjs` に4件の回帰テストを追加し、状態ビット0/1/13/29の通過可能ブロック・薄いブロックと実衝突箱、旧実装固有の `v<256` 短絡、対話型ターゲットの連続設置抑止と通常ブロックの継続発火を固定する。
- 変更前の製品コードでも新テストがGreenであることをPRのrefactor baselineゲートで要求する。Node/Chromium/固定シーンWebGL全RGBA SHA-256比較の成功を統合条件とする。全入力経路の直接ビット演算を今回一括移行したものとは扱わない。
