# CAT-TDD導入状態と機械的PR検査

このプロジェクトは `surumeneco/CAT-TDD` の正本を参照する。正本の配置は
[CAT-TDD](https://github.com/surumeneco/CAT-TDD) の
`.cat-system/docs/開発フロー.md` / `.cat-system/docs/AI実行契約.md` であり、
このリポジトリのCIをCATの正本仕様と誤認しない。

## 今回組み込む検査

`.github/workflows/refactor-evidence.yml` は `develop` 宛の全PRで
`scripts/refactor-change-evidence.mjs` を実行する。

- `src/**` と `index.html` の実装変更には、同一PR内の `tests/**` 回帰テストと `docs/**` のスコープ・挙動説明が必要。
- PR題名が `refactor:` で始まり、実装変更を含む場合は、PR内のテスト一式を**変更前のbaseコミットの製品コード**で実行する。既存の外部意味のオラクルが変更前でもGreenであることを必要条件とする。これはsourceを変更しないworktreeをGitに作成して行い、実行後に削除する。
- それ以外のPRは、事前Greenを誤って要求しない。Bugfixは新規テストが旧コードでRedとなりうるためである。
- いずれもGitHub Actionsが実行結果を決める。文書内の自己申告だけではpassにしない。

## 正式CAT gateとの境界

この検査は**PR差分とrefactor pre-baselineの決定論的preflight**であり、
CAT-TDDの正式な `process-closure`, `model-conformance`,
`implementation-conformance` ではない。
それらを「CI成功」から推測してpassと宣言しない。

正式なCAT適合性の判定は、正本テンプレートの
`Room0/<repository>` に実際の開発対象を接続し、
`Lifecycle/Issues` → `Tasks` → `Works`,
confirmed仕様・TestModel・Queue・制約を定義したWorkに対して、
CAT runtimeの検証器を実行する必要がある。各Gateは独立した実行証拠を要する。
現在このリポジトリにはそれらのWork・confirmed仕様・TestModelが存在しないため、
**正式3 Gateはnot-run**とし、偽のconformance artifactは作成しない。

このPR検査はその前段の整備として有効であるが、正式CAT導入の代用ではない。
