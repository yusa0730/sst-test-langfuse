## ECS タスクに入るコマンド
```
aws ecs execute-command \
  --cluster sst-test-langfuse-cluster-production \
  --task arn:aws:ecs:ap-northeast-1:218317313594:task/sst-test-langfuse-cluster-production/4ccc93407cc54193be2f4b762887147e \
  --container sst-test-langfuse-clickhouse-ecs-task-production \
  --interactive \
  --command "/bin/sh"
```


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


- 
```
clickhouse-client \
  --host clickhouse.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "RESTORE DATABASE default FROM Disk('s3_backup', 'clickhouse-backups/default-full-20260317')"
```





```
clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT version, dirty, sequence FROM default.schema_migrations WHERE version = 1 ORDER BY sequence"

clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT version, dirty, sequence FROM default.schema_migrations WHERE version = 1 ORDER BY sequence"

clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "ALTER TABLE default.schema_migrations DELETE WHERE version = 1"

clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "SELECT max(sequence) FROM default.schema_migrations"

clickhouse-client \
  --host clickhouse-2.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "INSERT INTO default.schema_migrations (version, dirty, sequence) VALUES (1, 0, 1773286727227591163)"

clickhouse-client \
  --host clickhouse-1.langfuse.local \
  --port 9000 \
  --user clickhouse \
  --password '7SENQoY5GU7qwqe0' \
  --query "ALTER TABLE default.schema_migrations DELETE WHERE version = 1"
```