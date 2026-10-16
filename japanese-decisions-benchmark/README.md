# 日本語 Decision API 比較

OpenRouterを通じて、日本語60文を15モデルで各2回判定し、結果をHTMLで比較します。Node.js 22.22以降とMakeが必要です。追加ライブラリは不要です。

対象モデル（[提供元・特徴](MODEL_GUIDE.md)）: ScaleDown Classify-1、Microsoft Decision-1、GPT-6 Luna Decisions、Liquid d1、Jev 1.13、Clef Flash、Clef、Solar Decide、Decider V1.1 27B、Kev 4B、Clef Omni、Drex v2.0、Tev1 4B Experimental、Mercury Decide、Span-01。

## 準備

`.env.example` をコピーして `.env` を作り、`OPENROUTER_API_KEY` を設定してください。すでに `.env` がある場合はコピー不要です。

```sh
cp .env.example .env
```

## 実行

| コマンド | 内容 |
|---|---|
| `make dry-run` | データと実行件数を確認（通信なし） |
| `make smoke` | 15モデルの接続確認（30リクエスト） |
| `make run` | 全60文を各2回比較（1800リクエスト） |
| `make test` | スクリプトのテスト（通信なし） |
| `make report RUN_DIR=runs/対象ディレクトリ` | 保存済みの記録からHTMLを再生成（通信なし） |

件数などを絞る場合は、スクリプトの引数を渡せます。

```sh
make run ARGS='--limit 10 --repeats 1'
```

`make` でコマンド一覧、`node benchmark.mjs --help` で引数を確認できます。実APIの呼び出しには料金が発生します。

## データと結果

`cases.json` に日本語本文・質問・期待値（`expected`）・その理由（`rationale`）を定義しています。期待値と理由はモデルへ送りません。Yes/NoはOpenRouterの `noul` 型で送信し、確率0.5以上を「はい」として採点します。

実行後に表示される `runs/日時/report.html` をブラウザで開いてください。全体比較は正答率の降順です。処理時間・費用も比較し、誤判定・モデル間の不一致・判定の揺れを絞り込めます。結果はこの合成60文に対する比較です。以前のVercel結果は別の実行ディレクトリに残ります。

Span-01は接続確認時点で分類に未対応のため、分類はAPIエラーとして記録します。正答率は有効回答を分母にするので、回答件数と予定数に対する正解も確認してください。

`.env`、実行結果の `runs/`、ローカル検証記録の `VERIFICATION.md` はGit管理から除外しています。

[API仕様](https://openrouter.ai/docs/guides/community/multimodal-decisions) · [Decisionモデル一覧](https://openrouter.ai/models?output_modalities=decisions)
