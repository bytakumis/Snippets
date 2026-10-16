# 比較するモデル

モデルIDの `/` より前は開発元・公開元を表します。OpenRouterで実際に処理を担当する配信事業者は別の場合があり、実行記録の `provider` に保存します。

多くは文章を長く生成する代わりに、指定した選択肢やYes/Noの確率を返す判定向けモデルです。以下は2026年10月14日に確認したOpenRouterのモデル説明です。

| モデル | 開発元・公開元 | どんなモデルか |
|---|---|---|
| [Classify-1](https://openrouter.ai/scaledown/classify-1) | ScaleDown | 文章・文書を指定した選択肢、Yes/No、段階評価で判定するモデル。 |
| [Microsoft Decision-1](https://openrouter.ai/microsoft/microsoft-decision-1) | Microsoft | 高速な判断向けの小型モデル。固定した回答候補ごとの確率を返す。 |
| [GPT-6 Luna Decisions](https://openrouter.ai/openai/gpt-6-luna-decisions) | OpenAI | GPT-6 Lunaを判定APIで利用するモデル。文章・JSON・画像を入力できる。 |
| [d1](https://openrouter.ai/liquid/d1) | Liquid AI | 選択・スコア・Yes/Noを返す構造化判定モデル。System One形式のAPIを採用。 |
| [Jev 1.13](https://openrouter.ai/typesafe/jev-1.13) | TypeSafe | ソフトウェアの判断向けに、自由文ではなく型のある回答を返すSystem Oneモデル。 |
| [Clef Flash](https://openrouter.ai/cloudflare/clef-flash) | Cloudflare | Qwen3.5-9Bを調整したClefシリーズの高速版。 |
| [Clef](https://openrouter.ai/cloudflare/clef) | Cloudflare | Qwen3.8-27Bを調整した、画像にも対応するClefシリーズのモデル。 |
| [Solar Decide](https://openrouter.ai/upstage/solar-decide) | Upstage | Solar Mini 4を使った、選択・スコア・Yes/Noの判定モデル。 |
| [Decider V1.1 27B](https://openrouter.ai/perplexity/pplx-decider-v1.1-27b) | Perplexity | 270億パラメータの判定モデル。V1の後継チェックポイント。 |
| [Kev 4B](https://openrouter.ai/jaredpalmer/kev-4b) | Jared Palmer | Qwen3.5-4B-BaseにLoRAと選択用の出力層を加えた、小型の重み公開モデル。 |
| [Clef Omni](https://openrouter.ai/cloudflare/clef-omni) | Cloudflare | Qwen3-Omni-30B-A3Bを調整したMoEモデル。文章・画像・音声・動画に対応。 |
| [Drex v2.0](https://openrouter.ai/nace-ai/drex-v2.0) | Nace.AI | 総パラメータ350億、判断時に使う部分は30億のMoE判定モデル。 |
| [Tev1 4B Experimental](https://openrouter.ai/togethercomputer/tev1-4b-experimental) | Together AI | Qwen3.5-4Bを調整し、2〜24個の候補から選ぶ実験的モデル。 |
| [Mercury Decide](https://openrouter.ai/inception/mercury-decide) | Inception | System One形式で選択・スコア・Yes/Noを返す構造化判定モデル。 |
| [Span-01](https://openrouter.ai/respan/span-01) | Respan | 会話の一部分に、指定した行動が含まれる確率を返すモデル。評価・ガードレール向け。 |

`4B` は40億、`27B` は270億パラメータという規模の表記です。MoEは入力に応じて一部の専門部分を使う仕組みです。規模だけでは日本語の精度は決まりません。今回の比較では全モデルに同じ日本語の文章を送ります。

Tev1は、公開元の説明では通常のチャットAPIで選択肢の文字を生成する方式です。OpenRouterのDecisionモデル一覧にも掲載されているため、この比較では他モデルと同じDecisions APIを使います。別APIへの自動切り替えは行いません。

接続確認ではTev1も共通のDecisions APIでYes/No・分類に回答しました。一方、Span-01はYes/Noには回答しましたが、分類は「noul質問のみ対応」というHTTP 400でした。Span-01にも同じ60文×2回を送り、未対応の分類はAPIエラーとして記録します。回答正答率は有効回答を分母にするため、回答件数・予定件数に対する正解数も合わせて比較してください。
