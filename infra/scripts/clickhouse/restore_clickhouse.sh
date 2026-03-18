#!/usr/bin/env bash
set -Eeuo pipefail

# =========================================================
# ClickHouse restore script
#
# このスクリプトは、S3 にある ClickHouse バックアップから
# 各テーブルを安全寄りに restore するためのものです。
#
# 特徴:
# - いきなり本テーブルに戻さず、一時テーブルに restore する
# - DDL / DESCRIBE の差分を確認する
# - 本テーブルが空のときだけ INSERT する
# - dry-run あり
# - resume あり
# - 実行ログあり
# =========================================================

SCRIPT_NAME="$(basename "$0")"

# -----------------------------
# 1. デフォルト値
# -----------------------------
HOST=""
PORT="9000"
USER_NAME="clickhouse"
PASSWORD=""
BACKUP_PATH=""
CLIENT_BIN="clickhouse-client"

LOG_FILE=""
STATE_FILE="./restore.state"

DRY_RUN=0
RESUME_AUTO=0
RESUME_FROM=""
REPLICA_HOST="clickhouse-2.langfuse.local"

# restore する順番
# project_environments は最後にしたいので最後に置く
ALL_TABLES=(
  "traces"
  "observations"
  "scores"
  "event_log"
  "blob_storage_file_log"
  "project_environments"
)

# 今回実行する対象テーブル一覧
RESTORE_PLAN=()

# -----------------------------
# 2. ヘルプ表示
# -----------------------------
usage() {
  cat <<'EOF'
Usage:
  restore_clickhouse.sh \
    --host clickhouse-1.langfuse.local \
    --password 'xxxxx' \
    --backup-path 'clickhouse-backups/default-full-20260317' \
    [--port 9000] \
    [--user clickhouse] \
    [--log-file ./restore.log] \
    [--state-file ./restore.state] \
    [--resume] \
    [--resume-from traces] \
    [--replica-host clickhouse-2.langfuse.local] \
    [--dry-run] \
    [--client-bin clickhouse-client]

Options:
  --host             接続先 ClickHouse ホスト
  --port             ClickHouse ポート
  --user             ClickHouse ユーザー
  --password         ClickHouse パスワード
  --backup-path      Disk('s3_backup', '...') の中のパス
  --log-file         ログファイル
  --state-file       resume 用の進捗ファイル
  --resume           前回成功した次のテーブルから再開
  --resume-from      指定テーブルから再開
  --replica-host     件数確認用のレプリカホスト
  --dry-run          更新を行わず、何をするかだけ表示
  --client-bin       clickhouse-client のパス
EOF
}

# -----------------------------
# 3. ログ関連
# -----------------------------
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR: $*"
  exit 1
}

# -----------------------------
# 4. 引数を読む
# -----------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --host) HOST="$2"; shift 2 ;;
      --port) PORT="$2"; shift 2 ;;
      --user) USER_NAME="$2"; shift 2 ;;
      --password) PASSWORD="$2"; shift 2 ;;
      --backup-path) BACKUP_PATH="$2"; shift 2 ;;
      --log-file) LOG_FILE="$2"; shift 2 ;;
      --state-file) STATE_FILE="$2"; shift 2 ;;
      --resume) RESUME_AUTO=1; shift ;;
      --resume-from) RESUME_FROM="$2"; shift 2 ;;
      --replica-host) REPLICA_HOST="$2"; shift 2 ;;
      --dry-run) DRY_RUN=1; shift ;;
      --client-bin) CLIENT_BIN="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
    esac
  done
}

# -----------------------------
# 5. 引数チェック
# -----------------------------
validate_args() {
  [[ -n "$HOST" ]] || die "--host is required"
  [[ -n "$PASSWORD" ]] || die "--password is required"
  [[ -n "$BACKUP_PATH" ]] || die "--backup-path is required"

  if [[ -n "$RESUME_FROM" ]]; then
    ensure_known_table "$RESUME_FROM"
  fi
}

# -----------------------------
# 6. 実行前初期化
# -----------------------------
init_runtime() {
  if [[ -z "$LOG_FILE" ]]; then
    LOG_FILE="./restore_$(date '+%Y%m%d_%H%M%S').log"
  fi

  touch "$LOG_FILE"

  log "script=${SCRIPT_NAME}"
  log "host=${HOST}"
  log "port=${PORT}"
  log "user=${USER_NAME}"
  log "backup_path=${BACKUP_PATH}"
  log "log_file=${LOG_FILE}"
  log "state_file=${STATE_FILE}"
  log "dry_run=${DRY_RUN}"
  log "resume_auto=${RESUME_AUTO}"
  log "resume_from=${RESUME_FROM:-<none>}"
  log "replica_host=${REPLICA_HOST:-<disabled>}"
}

# -----------------------------
# 7. ClickHouse 実行ヘルパ
# -----------------------------
# host を受け取り、その host に対して query を実行する
ch_query() {
  local host="$1"
  local query="$2"

  "$CLIENT_BIN" \
    --host "$host" \
    --port "$PORT" \
    --user "$USER_NAME" \
    --password "$PASSWORD" \
    --query "$query"
}

# SELECT / SHOW / DESCRIBE など
fetch_query() {
  local query="$1"
  ch_query "$HOST" "$query"
}

# INSERT / RESTORE / DROP など
exec_query() {
  local query="$1"

  if [[ $DRY_RUN -eq 1 ]]; then
    log "[DRY-RUN] $query"
    return 0
  fi

  ch_query "$HOST" "$query"
}

# -----------------------------
# 8. テーブル / state 関連
# -----------------------------
ensure_known_table() {
  local table="$1"
  local found=0

  for t in "${ALL_TABLES[@]}"; do
    if [[ "$t" == "$table" ]]; then
      found=1
      break
    fi
  done

  [[ $found -eq 1 ]] || die "Unknown table: ${table}"
}

table_index() {
  local target="$1"
  local i

  for i in "${!ALL_TABLES[@]}"; do
    if [[ "${ALL_TABLES[$i]}" == "$target" ]]; then
      echo "$i"
      return 0
    fi
  done

  echo "-1"
}

read_state() {
  if [[ -f "$STATE_FILE" ]]; then
    cat "$STATE_FILE"
  fi
}

write_state() {
  local table="$1"

  # dry-run は実際に進捗を進めたくない
  if [[ $DRY_RUN -eq 1 ]]; then
    log "dry-run: state file is not updated"
    return 0
  fi

  echo "$table" > "$STATE_FILE"
  log "state updated: last_successful=${table}"
}

temp_table_name() {
  local table="$1"
  echo "${table}_restored"
}

# -----------------------------
# 9. 今回の restore 対象一覧を作る
# -----------------------------
# ここが「読みやすさ」のポイント
# ループの前に、今回どのテーブルを実行するか決める
resolve_start_index() {
  local start_index=0

  # 明示指定が最優先
  if [[ -n "$RESUME_FROM" ]]; then
    start_index="$(table_index "$RESUME_FROM")"
    [[ "$start_index" != "-1" ]] || die "resume-from table not found: ${RESUME_FROM}"
    echo "$start_index"
    return 0
  fi

  # --resume の場合は state file を読む
  if [[ $RESUME_AUTO -eq 1 ]]; then
    local last_successful
    last_successful="$(read_state || true)"

    if [[ -z "$last_successful" ]]; then
      echo "0"
      return 0
    fi

    local last_index
    last_index="$(table_index "$last_successful")"
    [[ "$last_index" != "-1" ]] || die "state file contains unknown table: ${last_successful}"

    echo $((last_index + 1))
    return 0
  fi

  # 指定がなければ最初から
  echo "0"
}

build_restore_plan() {
  local start_index
  start_index="$(resolve_start_index)"

  RESTORE_PLAN=()

  local i
  for (( i=start_index; i<${#ALL_TABLES[@]}; i++ )); do
    RESTORE_PLAN+=("${ALL_TABLES[$i]}")
  done

  if [[ ${#RESTORE_PLAN[@]} -eq 0 ]]; then
    log "restore plan is empty; nothing to do"
    return 0
  fi

  log "restore plan: ${RESTORE_PLAN[*]}"
}

# -----------------------------
# 10. テーブルの情報を取る helper
# -----------------------------
get_table_count() {
  local table="$1"
  fetch_query "SELECT count(*) FROM default.${table} FORMAT TabSeparatedRaw"
}

show_create_to_file() {
  local table="$1"
  local output_file="$2"
  fetch_query "SHOW CREATE TABLE default.${table}" > "$output_file"
}

describe_to_file() {
  local table="$1"
  local output_file="$2"
  fetch_query "DESCRIBE TABLE default.${table} FORMAT TabSeparatedRaw" > "$output_file"
}

# -----------------------------
# 11. 1テーブル分の処理
# -----------------------------
# 11-1. すでに本テーブルにデータがあればスキップ
skip_if_target_has_data() {
  local table="$1"
  local current_count

  current_count="$(get_table_count "$table")"
  log "${table}: current count = ${current_count}"

  if [[ "$current_count" != "0" ]]; then
    log "${table}: skip because target already has data"
    write_state "$table"
    return 0
  fi

  return 1
}

# 11-2. 一時テーブルに restore
restore_temp_table() {
  local table="$1"
  local temp_table
  temp_table="$(temp_table_name "$table")"

  # 念のため古い temp があれば消す
  exec_query "DROP TABLE IF EXISTS default.${temp_table}"

  # いきなり本テーブルへ戻さず temp に戻す
  exec_query "RESTORE TABLE default.${table} AS default.${temp_table} FROM Disk('s3_backup', '${BACKUP_PATH}')"
}

# 11-3. temp テーブルに行があるか確認
temp_table_has_rows() {
  local table="$1"
  local temp_table
  temp_table="$(temp_table_name "$table")"

  local restored_count
  restored_count="$(fetch_query "SELECT count(*) FROM default.${temp_table} FORMAT TabSeparatedRaw")"
  log "${table}: restored temp count = ${restored_count}"

  [[ "$restored_count" != "0" ]]
}

# 11-4. schema 比較
compare_schema() {
  local table="$1"
  local temp_table
  temp_table="$(temp_table_name "$table")"

  local target_ddl restored_ddl target_desc restored_desc desc_diff
  target_ddl="$(mktemp)"
  restored_ddl="$(mktemp)"
  target_desc="$(mktemp)"
  restored_desc="$(mktemp)"
  desc_diff="$(mktemp)"

  # SHOW CREATE TABLE: テーブル定義全体を見る
  show_create_to_file "$table" "$target_ddl"
  show_create_to_file "$temp_table" "$restored_ddl"

  # DESCRIBE TABLE: カラム構造を中心に見る
  describe_to_file "$table" "$target_desc"
  describe_to_file "$temp_table" "$restored_desc"

  log "${table}: SHOW CREATE TABLE diff follows"
  if diff -u "$target_ddl" "$restored_ddl" | tee -a "$LOG_FILE"; then
    log "${table}: SHOW CREATE TABLE is identical"
  else
    log "${table}: SHOW CREATE TABLE differs"
  fi

  log "${table}: checking DESCRIBE TABLE compatibility"
  if diff -u "$target_desc" "$restored_desc" > "$desc_diff"; then
    log "${table}: DESCRIBE TABLE compatible"
  else
    log "${table}: DESCRIBE TABLE mismatch detected"
    cat "$desc_diff" | tee -a "$LOG_FILE"
    rm -f "$target_ddl" "$restored_ddl" "$target_desc" "$restored_desc" "$desc_diff"
    return 1
  fi

  rm -f "$target_ddl" "$restored_ddl" "$target_desc" "$restored_desc" "$desc_diff"
}

# 11-5. temp → 本テーブルへ INSERT
insert_temp_into_target() {
  local table="$1"
  local temp_table
  temp_table="$(temp_table_name "$table")"

  exec_query "INSERT INTO default.${table} SELECT * FROM default.${temp_table}"
}

# 11-6. temp テーブル削除
drop_temp_table() {
  local table="$1"
  local temp_table
  temp_table="$(temp_table_name "$table")"

  exec_query "DROP TABLE IF EXISTS default.${temp_table}"
}

# 11-7. INSERT 後の件数確認
log_target_count_after_insert() {
  local table="$1"
  local after_count

  after_count="$(get_table_count "$table")"
  log "${table}: target count after insert = ${after_count}"
}

# 11-8. 1テーブル全体の流れ
process_table() {
  local table="$1"

  log "=================================================="
  log "${table}: start"
  log "=================================================="

  # すでにデータがあればスキップ
  if skip_if_target_has_data "$table"; then
    log "${table}: done (skipped)"
    return 0
  fi

  # temp に restore
  restore_temp_table "$table"

  # dry-run はここで終わり
  if [[ $DRY_RUN -eq 1 ]]; then
    log "${table}: dry-run, skipping schema compare / insert / temp count check"
    log "${table}: done (dry-run)"
    return 0
  fi

  # temp が空なら cleanup して終わり
  if ! temp_table_has_rows "$table"; then
    log "${table}: restored temp table is empty, cleaning up"
    drop_temp_table "$table"
    write_state "$table"
    log "${table}: done (empty restore result)"
    return 0
  fi

  # schema 比較
  compare_schema "$table"

  # 問題なければ本テーブルへ INSERT
  insert_temp_into_target "$table"

  # 件数確認
  log_target_count_after_insert "$table"

  # temp を消す
  drop_temp_table "$table"

  # 成功したので state 更新
  write_state "$table"

  log "${table}: done"
}

# -----------------------------
# 12. replication check
# -----------------------------
replication_check() {
  local table="$1"

  if [[ $DRY_RUN -eq 1 ]]; then
    log "${table}: dry-run, skipping replication check"
    return 0
  fi

  local primary_count
  primary_count="$(ch_query "$HOST" "SELECT count(*) FROM default.${table} FORMAT TabSeparatedRaw")"
  log "${table}: primary(${HOST}) count = ${primary_count}"

  if [[ -n "$REPLICA_HOST" ]]; then
    local replica_count
    replica_count="$(ch_query "$REPLICA_HOST" "SELECT count(*) FROM default.${table} FORMAT TabSeparatedRaw")"
    log "${table}: replica(${REPLICA_HOST}) count = ${replica_count}"
  fi
}

# -----------------------------
# 13. 実行計画を順に実行
# -----------------------------
run_restore_plan() {
  local table

  for table in "${RESTORE_PLAN[@]}"; do
    process_table "$table"
    replication_check "$table"
  done
}

# -----------------------------
# 14. main
# -----------------------------
main() {
  parse_args "$@"
  validate_args
  init_runtime
  build_restore_plan
  run_restore_plan
  log "all restore steps finished"
}

main "$@"