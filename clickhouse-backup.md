## ECS タスクに入るコマンド
```
aws ecs execute-command \
  --cluster sst-test-langfuse-cluster-production \
  --task arn:aws:ecs:ap-northeast-1:218317313594:task/sst-test-langfuse-cluster-production/4ccc93407cc54193be2f4b762887147e \
  --container sst-test-langfuse-clickhouse-ecs-task-production \
  --interactive \
  --command "/bin/sh"
```

## バックアップ手順
### ClickhouseにS3バックアップの設定が適用されているか確認するコマンド
```
clickhouse-client \
  --host clickhouse.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT name, path, type FROM system.disks"
```

- 実行結果が以下のようになっていればS3にバックアップ可能
```
default /var/lib/clickhouse/    Local
s3_backup               ObjectStorage
```

## 既存のClickHouseのデータベースバックアップを指定のS3にアップロードするコマンド(踏み台用のEC2で実行する)
```
clickhouse-client \
  --host clickhouse.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "BACKUP DATABASE default TO Disk('s3_backup', 'clickhouse-backups/default-full-20260317') ASYNC"
```

- 以下コマンドでバックアップが完了しているかを確認する
```
clickhouse-client \
  --host clickhouse.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT id, status, error, start_time, end_time FROM system.backups ORDER BY start_time DESC LIMIT 5 FORMAT Vertical"
```
## restore手順
### blob_storage_file_log の restore 手順

これは restore 対象です。

0. 念のため件数確認

すでにデータが入っているなら、いきなり insert すると重複します。

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.blob_storage_file_log"
```

0 件ならそのまま進めて大丈夫です。

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.blob_storage_file_log_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.blob_storage_file_log AS default.blob_storage_file_log_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore できたか確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.blob_storage_file_log_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.blob_storage_file_log_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.blob_storage_file_log"
```

5. 本番テーブルへ投入
blob_storage_file_log が 0 件であることを確認済みなら、これで進めます。

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.blob_storage_file_log SELECT * FROM default.blob_storage_file_log_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.blob_storage_file_log"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.blob_storage_file_log"
```

7. 問題なければ試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.blob_storage_file_log_restored"
```

### event_log
0. 件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.event_log"
```

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.event_log_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.event_log AS default.event_log_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore 確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.event_log_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.event_log_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.event_log"
```

5. 本番テーブルへ投入
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.event_log SELECT * FROM default.event_log_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.event_log"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.event_log"
```

7. 試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.event_log_restored"
```

### observations
0. 件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.observations"
```

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.observations_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.observations AS default.observations_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore 確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.observations_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.observations_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.observations"
```

5. 本番テーブルへ投入
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.observations SELECT * FROM default.observations_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.observations"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.observations"
```

7. 試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.observations_restored"
```

### scores
0. 件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.scores"
```

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.scores_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.scores AS default.scores_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore 確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.scores_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.scores_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.scores"
```

5. 本番テーブルへ投入
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.scores SELECT * FROM default.scores_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.scores"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.scores"
```

7. 試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.scores_restored"
```

### traces
0. 件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.traces"
```

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.traces_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.traces AS default.traces_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore 確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.traces_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.traces_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.traces"
```

5. 本番テーブルへ投入
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.traces SELECT * FROM default.traces_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.traces"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.traces"
```

7. 試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.traces_restored"
```

### project_environments
これは 最後に確認して、必要なら実施です。
先に traces を入れたあとで 0 件のままなら restore します。

0. 件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.project_environments"
```

0 件のままなら、以下に進みます。

1. 試験 restore テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE IF EXISTS default.project_environments_restored"
```

2. restore
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE TABLE default.project_environments AS default.project_environments_restored FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```

3. restore 確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.project_environments_restored"
```

4. DDL 比較
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.project_environments_restored"
```

```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SHOW CREATE TABLE default.project_environments"
```

5. 本番テーブルへ投入
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.project_environments SELECT * FROM default.project_environments_restored"
```

6. CH1 / CH2 で件数確認
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.project_environments"
```

```
clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT count(*) FROM default.project_environments"
```

7. 試験テーブル削除
```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "DROP TABLE default.project_environments_restored"
```

project_environments だけは、traces を入れた後にまだ不足している時だけ実施してください。