# 残存リファクタリング計画

初期基準: `develop` @ `a4356983abb568d242d5cad0408bdff4ddda5516`。最新確認基準: `develop` @ `1661fd0d693dea546f2b1a9d8124c5bdeece5ca7`（2026-10-12）。
目的: ゲームの表示・計算・データ形式・保存形式を変えず、責務境界とテスト可能性を改善する。
対象外: 仕様変更、見た目変更、ゲームバランス、描画最適化自体、現行セーブ形式の破壊。
原則: **既存挙動を回帰テストで固定 → 小単位の変更 → CI → developへ統合**。
提出済みの `PR/` ブランチと `main` は変更しない。

## 残作業の順序

| 順位 | 範囲（主なファイル） | 目的と完了基準 | 状態 |
| --- | --- | --- | --- |
| 1 | Block ID/状態の境界（01, 03, 05, 06, 07） | 8bit ID/高位状態の契約をテスト化し、基礎ヘルパーを導入。今後の全呼出箇所統一は未着手 | 一部完了（blockBaseId/blockState） |
| 2 | メッシュの頂点色・照明・AO（03, 05） | 頂点色の角AO・ブロック光、光源探索・減衰伝播を分離済。atlas UV更新などは残存 | 一部完了（meshVertexColor/collectBlockLightSources/propagateBlockLight） |
| 3 | 地形生成・装飾（03） | 地形列・樹木装飾・保存済み編集の適用を独立化。鉱石・洞窟、草花の細分化は残存 | 一部完了（fillTerrainColumn/decorateChunkTrees/replayChunkEdits） |
| 4 | 回路・機構（06） | リピーター遅延、オブザーバー変化検知、ピストンアニメーション完了、TNTブロック走査・ダメージ、回路tick時間制御を分離。信号収集・導火線管理・回路全体の副作用整理は残存 | 一部完了（updateRepeaterState/updateObserverState/finishPistonAnimation/collectBlastBlockChanges/damageBlastEntities/advanceCircuitClock 等） |
| 5 | Mob・戦闘・投射物（05） | Mob判断・移動・スポーン・体力処理、近接ヒットと死亡ドロップ、矢の速度生成・移動・命中を分離済。Mob描画・クリーパー爆発・攻撃全般の統合検証は残存 | 一部完了（applyMeleeHit/dropDefeatedMob/calculateArrowVelocity 等） |
| 6 | 移動・入力・ゲームループ（04-1, 08） | HUD・衝突・移動速度・速度ベクトル・フレーム時刻とFPS・空腹度・カメラ・水中表示を分離済。キー状態、フレーム全体の連携テストは残存 | 一部完了（advanceFrameClock/advanceHungerClock/updatePlayerCamera/updateUnderwaterVisuals 等） |
| 7 | 所持品・クラフト・UI（04-0, 09） | 装備・所持品・ホットバー・2×2クラフトの画面生成を分離。所持品の状態更新・装備操作・クラフト検証と描画の依存整理は残存 | 一部完了（renderInventoryEquipmentPanel/OwnedSlots/Hotbar/Crafting） |
| 8 | リソースパック（10） | ファイル選択・ZIPエントリ走査・画像デコード呼出し・atlas描画を分離。実PNG/DEFLATE読込、ブラウザでの適用と復元は未検証 | 一部完了（collectPackHits/scanZipBlockEntries/decodePackImages/paintPackAtlas） |
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
