import { infraConfigResources } from "./infra-config";
import { rdsResources } from "./rds";
import { efsResources } from "./efs";
import { s3Resources } from "./s3";

// AWS Backup 用 IAM Role
const backupRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-backup-role-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-backup-iar-${$app.stage}`,
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "backup.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup",
      "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores",
      // S3 バックアップに必要な追加ポリシー
      "arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Backup",
      "arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Restore",
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-backup-iar-${$app.stage}`,
    },
  }
);

// Backup Vault（バックアップの保存先）
const backupVault = new aws.backup.Vault(
  `${infraConfigResources.idPrefix}-backup-vault-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-backup-vault-${$app.stage}`,
    tags: {
      Name: `${infraConfigResources.idPrefix}-backup-vault-${$app.stage}`,
    },
  }
);

// Backup Plan
const backupPlan = new aws.backup.Plan(
  `${infraConfigResources.idPrefix}-backup-plan-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-backup-plan-${$app.stage}`,
    rules: [
      {
        ruleName: "daily-backup",
        targetVaultName: backupVault.name,
        // 毎日 18:00 UTC (= JST 03:00) にバックアップ
        schedule: "cron(0 18 * * ? *)",
        startWindow: 60,
        completionWindow: 180,
        lifecycle: {
          // 35 日間保持
          deleteAfter: 35,
        },
      },
      {
        ruleName: "weekly-backup",
        targetVaultName: backupVault.name,
        // 毎週日曜 19:00 UTC (= JST 04:00) にバックアップ
        schedule: "cron(0 19 ? * SUN *)",
        startWindow: 60,
        completionWindow: 360,
        lifecycle: {
          // 90 日間保持
          deleteAfter: 90,
        },
      },
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-backup-plan-${$app.stage}`,
    },
  }
);

// Backup Selection（対象リソースの指定）
new aws.backup.Selection(
  `${infraConfigResources.idPrefix}-backup-selection-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-backup-selection-${$app.stage}`,
    planId: backupPlan.id,
    iamRoleArn: backupRole.arn,
    resources: [
      // Aurora クラスター
      rdsResources.cluster.arn,
      // EFS ファイルシステム（ClickHouse データ）
      efsResources.efsFileSystem.arn,
      // S3: Langfuse blob / event / clickhouse（ログ系は除外）
      s3Resources.langfuseBlobBucket.arn,
      s3Resources.langfuseEventBucket.arn,
      s3Resources.langfuseClickhouseBucket.arn,
    ],
  }
);

export const backupResources = {
  backupVault,
  backupPlan,
  backupRole,
};
