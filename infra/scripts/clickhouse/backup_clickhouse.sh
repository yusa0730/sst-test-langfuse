#!/usr/bin/env bash
set -Eeuo pipefail

# =========================================================
# ClickHouse backup script
#
# このスクリプトは ClickHouse の BACKUP を起動し、
# system.backups をポーリングして完了を待つためのものです。
#
# 対応:
# - database 単位の backup
# - table 単位の backup
# - dry-run
# - ログ保存
# =========================================================

SCRIPT_NAME="$(basename "$0")"

# -----------------------------
# 1. デフォルト値
# -----------------------------
HOST=""
PORT="9000"
USER_NAME="clickhouse"
PASSWORD=""
CLIENT_BIN="clickhouse-client"

MODE="database"      # database | table
DATABASE_NAME="default"
TABLES=""            # mode=table のとき "traces,observations" のように指定
BACKUP_PATH=""

LOG_FILE=""
DRY_RUN=0

# -----------------------------
# 2. ヘルプ
# -----------------------------
usage() {
  cat <<'EOF'
Usage:
  backup_clickhouse.sh \
    --host clickhouse-1.langfuse.local \
    --password 'xxxxx' \
    --backup-path 'clickhouse-backups/default-full-20260318' \
    [--mode database|table] \
    [--database default] \
    [--tables traces,observations] \
    [--port 9000] \
    [--user clickhouse] \
    [--log-file ./backup.log] \
    [--dry-run] \
    [--client-bin clickhouse-client]

Options:
  --host         ClickHouse host
  --port         ClickHouse port
  --user         ClickHouse user
  --password     ClickHouse password
  --mode         database or table
  --database     Database 名
  --tables       mode=table のときの対象テーブル一覧
  --backup-path  Disk('s3_backup', '...') のパス
  --log-file     ログファイル
  --dry-run      実行せず内容だけ表示
  --client-bin   clickhouse-client のパス
EOF
}

# -----------------------------
# 3. ログ
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
# 4. 引数
# -----------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --host) HOST="$2"; shift 2 ;;
      --port) PORT="$2"; shift 2 ;;
      --user) USER_NAME="$2"; shift 2 ;;
      --password) PASSWORD="$2"; shift 2 ;;
      --mode) MODE="$2"; shift 2 ;;
      --database) DATABASE_NAME="$2"; shift 2 ;;
      --tables) TABLES="$2"; shift 2 ;;
      --backup-path) BACKUP_PATH="$2"; shift 2 ;;
      --log-file) LOG_FILE="$2"; shift 2 ;;
      --dry-run) DRY_RUN=1; shift ;;
      --client-bin) CLIENT_BIN="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
    esac
  done
}

validate_args() {
  [[ -n "$HOST" ]] || die "--host is required"
  [[ -n "$PASSWORD" ]] || die "--password is required"
  [[ -n "$BACKUP_PATH" ]] || die "--backup-path is required"

  if [[ "$MODE" != "database" && "$MODE" != "table" ]]; then
    die "--mode must be database or table"
  fi

  if [[ "$MODE" == "table" && -z "$TABLES" ]]; then
    die "--tables is required when --mode table"
  fi
}

init_runtime() {
  if [[ -z "$LOG_FILE" ]]; then
    LOG_FILE="./backup_$(date '+%Y%m%d_%H%M%S').log"
  fi

  touch "$LOG_FILE"

  log "script=${SCRIPT_NAME}"
  log "host=${HOST}"
  log "port=${PORT}"
  log "user=${USER_NAME}"
  log "mode=${MODE}"
  log "database=${DATABASE_NAME}"
  log "backup_path=${BACKUP_PATH}"
  log "log_file=${LOG_FILE}"
  log "dry_run=${DRY_RUN}"
}

# -----------------------------
# 5. ClickHouse 実行
# -----------------------------
ch_query() {
  local query="$1"

  "$CLIENT_BIN" \
    --host "$HOST" \
    --port "$PORT" \
    --user "$USER_NAME" \
    --password "$PASSWORD" \
    --query "$query"
}

exec_query() {
  local query="$1"

  if [[ $DRY_RUN -eq 1 ]]; then
    log "[DRY-RUN] $query"
    return 0
  fi

  ch_query "$query"
}

# -----------------------------
# 6. backup 実行後に状態を監視
# -----------------------------
# BACKUP ... ASYNC の結果から backup id を取り出し、
# system.backups を見て完了まで待つ
wait_backup() {
  local backup_id="$1"

  if [[ $DRY_RUN -eq 1 ]]; then
    log "dry-run: skip polling backup id=${backup_id}"
    return 0
  fi

  while true; do
    local row status error
    row="$(ch_query "SELECT status, coalesce(error, '') FROM system.backups WHERE id = '${backup_id}' FORMAT TabSeparatedRaw" || true)"
    status="$(printf '%s' "$row" | awk -F'\t' 'NR==1{print $1}')"
    error="$(printf '%s' "$row" | awk -F'\t' 'NR==1{print $2}')"

    log "backup id=${backup_id} status=${status}"

    case "$status" in
      BACKUP_CREATED)
        return 0
        ;;
      BACKUP_FAILED)
        log "backup id=${backup_id} failed: ${error}"
        return 1
        ;;
      CREATING_BACKUP|BACKUP_CANCELLED|"")
        sleep 2
        ;;
      *)
        sleep 2
        ;;
    esac
  done
}

start_async_backup_and_wait() {
  local query="$1"

  if [[ $DRY_RUN -eq 1 ]]; then
    exec_query "$query"
    return 0
  fi

  local out backup_id
  out="$(ch_query "$query" 2>&1 || true)"
  echo "$out" | tee -a "$LOG_FILE"

  backup_id="$(printf '%s' "$out" | awk 'NR==1{print $1}')"
  [[ -n "$backup_id" ]] || die "Could not parse backup id from output"

  wait_backup "$backup_id"
}

# -----------------------------
# 7. mode ごとの query を作る
# -----------------------------
run_database_backup() {
  local query
  query="BACKUP DATABASE ${DATABASE_NAME} TO Disk('s3_backup', '${BACKUP_PATH}') ASYNC"

  log "starting database backup"
  start_async_backup_and_wait "$query"
  log "database backup finished"
}

run_table_backups() {
  IFS=',' read -r -a table_list <<< "$TABLES"

  local table path query
  for table in "${table_list[@]}"; do
    table="$(echo "$table" | xargs)"
    [[ -z "$table" ]] && continue

    path="${BACKUP_PATH%/}/${table}"
    query="BACKUP TABLE ${DATABASE_NAME}.${table} TO Disk('s3_backup', '${path}') ASYNC"

    log "starting table backup: table=${table} path=${path}"
    start_async_backup_and_wait "$query"
    log "table backup finished: ${table}"
  done
}

# -----------------------------
# 8. main
# -----------------------------
main() {
  parse_args "$@"
  validate_args
  init_runtime

  if [[ "$MODE" == "database" ]]; then
    run_database_backup
  else
    run_table_backups
  fi

  log "all backup steps finished"
}

main "$@"