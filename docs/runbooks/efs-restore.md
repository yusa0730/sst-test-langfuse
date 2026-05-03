# EFS リストア手順書

## 概要

AWS Backup から EFS（ClickHouse データ）をリストアする際の手順書。

### 対象リソース

| リソース | ID |
|---|---|
| EFS（本番） | `fs-023a17ae641eee00b` |
| Backup Vault | `sst-test-langfuse-backup-vault-production` |
| ECS クラスター | `sst-test-langfuse-cluster-production` |
| ECS サービス | `sst-test-langfuse-clickhouse-ecs-service-v2-production` |

### 重要な注意事項

- **AWS Backup は EFS をリストアする際、ルート直下ではなく `aws-backup-restore_<タイムスタンプ>/` というディレクトリに復元する**
- リストア後は必ず Access Point のパスをこのディレクトリに合わせる必要がある
- 作業前に必ず ClickHouse ECS サービスを停止すること

---

## 手順

### Step 1: ClickHouse を停止する

ECS コンソール → クラスター `sst-test-langfuse-cluster-production` → サービス `sst-test-langfuse-clickhouse-ecs-service-v2-production` → `サービスを更新` → 必要なタスク数を `0` → `更新`

タスクが完全に停止したことを確認する（タスクタブで確認）。

---

### Step 2: オンデマンドバックアップを取得する（必要な場合）

> スケジュールバックアップからリストアする場合はこの手順をスキップ。

`AWS Backup` → `保護されたリソース` → `オンデマンドバックアップを作成`

| 項目 | 値 |
|---|---|
| リソースタイプ | `EFS` |
| ファイルシステム ID | `fs-023a17ae641eee00b` |
| バックアップウィンドウ | `今すぐバックアップを作成` |
| 保持期間 | 任意 |
| バックアップボールト | `sst-test-langfuse-backup-vault-production` |
| IAM ロール | `sst-test-langfuse-backup-iar-production` |

`ジョブ` → `バックアップジョブ` でステータスが `完了` になるまで待つ。

---

### Step 3: リストアを実行する

`AWS Backup` → `バックアップボールト` → `sst-test-langfuse-backup-vault-production` → 復元ポイントを選択 → `アクション` → `復元`

| 項目 | 値 |
|---|---|
| Restore type | `Full restore` |
| Restore location | `Restore to a new file system` |
| パフォーマンスモード | `汎用`（General Purpose） |
| IAM ロール | `sst-test-langfuse-backup-iar-production` |

`ジョブ` → `復元ジョブ` でステータスが `完了` になるまで待つ（数分〜10分程度）。

**完了日時（UTC）を控えておく。** ディレクトリ名の特定に使用する。

例: 完了日時 `2026-04-05T16:26:03 UTC` → ディレクトリは `aws-backup-restore_2026-04-05T16-26-03-xxxxxxxxx Z`

---

### Step 4: リストア済み EFS の ID を確認する

EFS コンソール → ファイルシステム一覧 → 新しく作成されたファイルシステムの ID をメモする。

```
例: fs-036eda57118204c38
```

---

### Step 5: Mount Target を作成する

EFS コンソール → リストア済み EFS → `ネットワーク` タブ → `管理` → `マウントターゲットを追加`

| AZ | サブネット | セキュリティグループ |
|---|---|---|
| ap-northeast-1a | clickhouse 用 protected サブネット | `sst-test-langfuse-efs-sg-production` |
| ap-northeast-1c | clickhouse 用 protected サブネット | `sst-test-langfuse-efs-sg-production` |

ステータスが `利用可能` になるまで待つ。

---

### Step 6: リストアディレクトリのパスを確認する

Bastion にログインし、EFS をマウントしてリストアディレクトリのパスを確認する。

```bash
# マウント
sudo mkdir -p /mnt/efs-root
sudo mount -t nfs4 \
  -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport \
  <新しいEFS_ID>.efs.ap-northeast-1.amazonaws.com:/ \
  /mnt/efs-root

# リストアディレクトリの確認
sudo find /mnt/efs-root -maxdepth 1 -name "aws-backup-restore*"
```

出力例:
```
/mnt/efs-root/aws-backup-restore_2026-04-05T16-26-03-082479370Z
```

このパスをメモしておく。

---

### Step 7: Access Point を作成する

EFS コンソール → リストア済み EFS → `アクセスポイント` タブ → `アクセスポイントを作成`

**data 用：**

| 項目 | 値 |
|---|---|
| Root directory path | `/aws-backup-restore_<タイムスタンプ>/clickhouse-data` |
| User ID | `101` |
| Group ID | `101` |
| Owner user ID | `101` |
| Owner group ID | `101` |
| Access point permissions | `750` |

**log 用：**

| 項目 | 値 |
|---|---|
| Root directory path | `/aws-backup-restore_<タイムスタンプ>/clickhouse-log` |
| User ID | `101` |
| Group ID | `101` |
| Owner user ID | `101` |
| Owner group ID | `101` |
| Access point permissions | `750` |

作成後、それぞれの Access Point ID をメモする。

---

### Step 8: File System Policy を設定する

EFS コンソール → リストア済み EFS → `ファイルシステムポリシー` タブ → `編集`

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "elasticfilesystem:ClientMount",
            "Resource": "arn:aws:elasticfilesystem:ap-northeast-1:<ACCOUNT_ID>:file-system/<新しいEFS_ID>",
            "Condition": {
                "Bool": {
                    "elasticfilesystem:AccessedViaMountTarget": "true"
                }
            }
        }
    ]
}
```

---

### Step 9: ecs-clickhouse.ts を更新して deploy する

`infra/ecs-clickhouse.ts` の volumes 設定を新しい EFS ID と Access Point ID に書き換える。

```ts
volumes: [
  {
    name: "clickhouse-data",
    efsVolumeConfiguration: {
      // TODO: テスト確認後に efsResources 参照に戻す
      fileSystemId: "<新しいEFS_ID>",
      authorizationConfig: {
        accessPointId: "<data用AccessPointID>",
        iam: "ENABLED",
      },
      transitEncryption: "ENABLED",
    },
  },
  {
    name: "clickhouse-log",
    efsVolumeConfiguration: {
      // TODO: テスト確認後に efsResources 参照に戻す
      fileSystemId: "<新しいEFS_ID>",
      authorizationConfig: {
        accessPointId: "<log用AccessPointID>",
        iam: "ENABLED",
      },
      transitEncryption: "ENABLED",
    },
  },
],
```

```bash
sst deploy --stage production
```

---

### Step 10: ClickHouse を再起動してデータを確認する

ECS コンソール → ClickHouse サービス → 必要なタスク数を `1` に戻す。

起動後、Langfuse の画面でトレースデータが表示されることを確認する。

---

### Step 11: 後片付け（テスト完了後）

本番切り替えではなくテストの場合は元の EFS に戻す。

**ecs-clickhouse.ts を元に戻す：**

```ts
fileSystemId: efsResources.efsFileSystem.id,
authorizationConfig: {
  accessPointId: efsResources.clickhouseDataAccessPoint.id, // data
  // accessPointId: efsResources.clickhouseLogAccessPoint.id, // log
  iam: "ENABLED",
},
```

```bash
sst deploy --stage production
```

**テスト用 EFS を削除する：**

EFS コンソール → テスト用 EFS → 以下の順で削除：
1. Mount Target を削除（完全削除まで数分待つ）
2. Access Point を削除
3. ファイルシステム本体を削除

---

## トラブルシューティング

### ClickHouse がデータを認識せず初期化される

**原因:** Access Point のパスが空のディレクトリを指している

**確認:** Bastion で `sudo find /mnt/efs-root -maxdepth 2` を実行して実際のデータパスを確認する

**対処:** Access Point を削除して正しいパス（`aws-backup-restore_<タイムスタンプ>/clickhouse-data`）で再作成する

---

### Bastion から EFS にマウントできない

**原因:** EFS セキュリティグループが Bastion からの NFS（ポート 2049）を許可していない

**対処:** `sst-test-langfuse-efs-sg-production` のインバウンドルールに Bastion SG からのポート 2049 を追加する（`security-group.ts` で管理済み）

---

### mv コマンドで Permission denied が発生する

**原因:** EFS の NFS マウントでは root がスクワッシュされるため uid 101 所有のファイルを操作できない

**対処:** ファイルを移動するのではなく、Access Point のパスをリストアディレクトリに向け直す（Step 7 参照）
