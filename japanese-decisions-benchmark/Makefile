.DEFAULT_GOAL := help

NODE ?= node
ARGS ?=
export RUN_DIR

.PHONY: help dry-run smoke run test report

help:
	@printf '%s\n' \
		'make dry-run  実行条件を確認（通信なし）' \
		'make smoke    接続確認（30リクエスト・有料）' \
		'make run      全件比較（1800リクエスト・有料）' \
		'make test     スクリプトのテスト（通信なし）' \
		'make report RUN_DIR=runs/対象ディレクトリ  HTMLを再生成' \
		"例: make run ARGS='--limit 10 --repeats 1'"

dry-run:
	$(NODE) benchmark.mjs --dry-run $(ARGS)

smoke:
	$(NODE) --env-file-if-exists=.env benchmark.mjs --case-ids c01_b1,c01_c1 --repeats 1

run:
	$(NODE) --env-file-if-exists=.env benchmark.mjs $(ARGS)

test:
	$(NODE) --test benchmark.test.mjs

report:
	@test -n "$$RUN_DIR" || { printf '%s\n' 'RUN_DIRを指定してください: make report RUN_DIR=runs/対象ディレクトリ'; exit 1; }
	$(NODE) benchmark.mjs --report-only "$$RUN_DIR"
