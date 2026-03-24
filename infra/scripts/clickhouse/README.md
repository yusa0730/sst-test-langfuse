# ClickHouse Backup / Restore Scripts（新人向け簡易版）

このディレクトリには、ClickHouse のバックアップ取得とリストアを行うための運用スクリプトを配置しています。

- `backup_clickhouse.sh` - ClickHouse のバックアップを取得する
- `restore_clickhouse.sh` - バックアップからデータを戻す

---

## まず覚えること

このスクリプトは **bastion EC2 上で実行する** 想定です。

基本の流れは以下です。

1. SSM で bastion に入る
2. `clickhouse-client` で疎通確認する
3. `backup` または `restore` を実行する
4. `restore` は必ず最初に `--dry-run` を使う

---

## 配置場所

ローカルリポジトリでは以下に配置します。

```txt
infra/scripts/clickhouse/
├── backup_clickhouse.sh
├── restore_clickhouse.sh
└── README.md
```

bastion 上では以下に配置される想定です。

```txt
/home/ssm-user/clickhouse-ops/
├── bin/
│   ├── backup_clickhouse.sh
│   └── restore_clickhouse.sh
├── logs/
└── run/
```

---

## `backup_clickhouse.sh`

### 何をするスクリプトか

ClickHouse のバックアップを取得します。

たとえば以下のような用途で使います。

- 日次バックアップ
- 手動バックアップ
- 特定テーブルだけのバックアップ

### よく使うコマンド

#### database 全体をバックアップ

```bash
./backup_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-$(date -u +%Y%m%d)"
```

#### 特定テーブルだけバックアップ

```bash
./backup_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --password "$CH_PASSWORD" \
  --mode table \
  --tables traces,observations,scores \
  --backup-path "clickhouse-backups/manual-$(date -u +%Y%m%d)"
```

#### dry-run

```bash
./backup_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-$(date -u +%Y%m%d)" \
  --dry-run
```

### よく使う引数

| 引数 | 意味 |
|---|---|
| `--host` | 接続先 ClickHouse ホスト |
| `--password` | ClickHouse パスワード |
| `--mode` | `database` または `table` |
| `--tables` | `mode=table` のときの対象テーブル |
| `--backup-path` | バックアップ保存先パス |
| `--dry-run` | 実行せず内容だけ確認する |

---

## `restore_clickhouse.sh`

### 何をするスクリプトか

バックアップからデータを戻します。

このスクリプトは、いきなり本テーブルへ書き戻さず、
**一時テーブルに restore して差分確認してから本テーブルへ INSERT する**作りです。

そのため、安全寄りの restore をしたいときに使います。

### よく使うコマンド

#### 最初に必ず dry-run

```bash
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-20260317" \
  --dry-run
```

#### 通常実行

```bash
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-20260317"
```

#### 途中再開

```bash
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-20260317" \
  --resume
```

#### 指定テーブルから再開

```bash
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-20260317" \
  --resume-from event_log
```

### よく使う引数

| 引数 | 意味 |
|---|---|
| `--host` | primary 側 ClickHouse ホスト |
| `--replica-host` | レプリカ側件数確認用ホスト |
| `--password` | ClickHouse パスワード |
| `--backup-path` | 復元元バックアップパス |
| `--dry-run` | まずこれで確認する |
| `--resume` | 前回の続きから再開 |
| `--resume-from` | 指定したテーブルから再開 |
| `--state-file` | resume 用進捗ファイル |
| `--log-file` | 実行ログの保存先 |

### restore の流れ

`restore_clickhouse.sh` はだいたい次の順で動きます。

1. 対象テーブルの件数確認
2. すでにデータがあるなら skip
3. `<table>_restored` に restore
4. schema 差分確認
5. 問題なければ本テーブルへ INSERT
6. temp テーブル削除
7. state file 更新
8. primary / replica の件数確認

---

## bastion EC2 での使い方

### 1. SSM で接続

```bash
aws ssm start-session --target <instance-id>
```

### 2. 作業ディレクトリへ移動

```bash
cd /home/ssm-user/clickhouse-ops/bin
```

### 3. 実行権限付与

```bash
chmod +x backup_clickhouse.sh restore_clickhouse.sh
```

### 4. パスワードを読み込む

```bash
read -s -p "ClickHouse password: " CH_PASSWORD
echo
```

### 5. ClickHouse 疎通確認

```bash
clickhouse-client --version

clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password "$CH_PASSWORD" \
  --query "SELECT version()"
```

---

## まず最初にやること

### バックアップ確認

```bash
./backup_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-$(date -u +%Y%m%d)" \
  --dry-run
```

### リストア確認

```bash
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-20260317" \
  --dry-run
```

---

## 注意事項

1. **restore は必ず dry-run から始める**
   - いきなり本実行しないこと。

2. **backup-path を間違えない**
   - 違う日付や違うパスを指定すると、意図しないデータを使うことになります。

3. **パスワードをコマンドにベタ書きしない**
   - なるべく `read -s` で入力すること。

4. **schema 差分が出たら止まって確認する**
   - 特に `DESCRIBE TABLE mismatch` は要注意です。

5. **resume は便利だがログも確認する**
   - `--resume` だけに頼らず、どこまで進んだかログを見ること。

---

## ログと state file

### ログ

通常、実行ログは以下のようなファイル名になります。

```txt
./backup_YYYYmmdd_HHMMSS.log
./restore_YYYYmmdd_HHMMSS.log
```

明示的に指定する例:

```bash
--log-file /home/ssm-user/clickhouse-ops/logs/restore.log
```

### state file

restore の再開に使います。

```txt
./restore.state
```

明示的に指定する例:

```bash
--state-file /home/ssm-user/clickhouse-ops/run/restore.state
```

---

## よくあるエラー

### `clickhouse-client: command not found`

bastion に `clickhouse-client` が入っていません。

### `Unknown table: xxx`

`restore_clickhouse.sh` の対象外テーブルを指定しています。

### `DESCRIBE TABLE mismatch detected`

カラム構造が一致していません。
そのまま進めずに差分を確認してください。

### `backup id could not be parsed`

`BACKUP ... ASYNC` の結果が想定と違う可能性があります。
ClickHouse のバージョン差異や実行ログを確認してください。

---

## 最後に

迷ったら、まずは以下です。

- **backup** は `--dry-run` で確認
- **restore** は必ず `--dry-run` で確認
- 実行ログを確認
- **わからなければ勝手に本実行しない**



### 実行手順
```
export CH_PASSWORD=parameter storeのpassword
```

```
echo $CH_PASSWORD
```

```
./backup_clickhouse.sh --host clickhouse.langfuse.local --password "$CH_PASSWORD" --backup-path "clickhouse-backups/default-full-$(date -u +%Y%m%d)" --dry-run
```

```
./backup_clickhouse.sh --host clickhouse.langfuse.local --password "$CH_PASSWORD" --backup-path "clickhouse-backups/default-full-$(date -u +%Y%m%d)"
```

バックアップされているかをbackup用のS3バケットを見て確認

sst deployを行い冗長化構成を適用する

```
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-2026MMDD"
  --dry-run
```

```
./restore_clickhouse.sh \
  --host clickhouse-1.langfuse.local \
  --replica-host clickhouse-2.langfuse.local \
  --password "$CH_PASSWORD" \
  --backup-path "clickhouse-backups/default-full-2026MMDD"
```