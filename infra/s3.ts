import { infraConfigResources } from "./infra-config";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const albAccessLogBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-alb-access-log-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-alb-access-log-bucket-${$app.stage}`,
    forceDestroy: true,
    policy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: "arn:aws:iam::582318560864:root",
          },
          Action: "s3:PutObject",
          Resource: [
            `arn:aws:s3:::${infraConfigResources.idPrefix}-alb-access-log-bucket-${$app.stage}/*`
          ],
        }
      ],
    }),
  },
);

const albConnectionLogBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-alb-connection-log-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-alb-connection-log-bucket-${$app.stage}`,
    forceDestroy: true,
    policy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: "arn:aws:iam::582318560864:root",
          },
          Action: "s3:PutObject",
          Resource: [
            `arn:aws:s3:::${infraConfigResources.idPrefix}-alb-connection-log-bucket-${$app.stage}/*`
          ],
        }
      ],
    }),
  },
);

// ログバケット
const cloudFrontLogBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-cloudfront-log-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-cloudfront-log-bucket-${$app.stage}`,
    forceDestroy: true,
    policy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: "arn:aws:iam::582318560864:root",
          },
          Action: "s3:PutObject",
          Resource: [
            `arn:aws:s3:::${infraConfigResources.idPrefix}-cloudfront-log-bucket-${$app.stage}/*`
          ],
        }
      ],
    }),
  },
);

// aclの設定
new aws.s3.BucketOwnershipControls(
  `${infraConfigResources.idPrefix}-cdn-log-bucket-ownership-controls-${$app.stage}`,
  {
    bucket: cloudFrontLogBucket.id,
    rule: {
      objectOwnership: "BucketOwnerPreferred",
    },
  },
);

const langfuseBlobBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-blob-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-blob-bucket-${$app.stage}`,
    forceDestroy: false,
  },
);

// aclの設定
new aws.s3.BucketOwnershipControls(
  `${infraConfigResources.idPrefix}-blob-bucket-ownership-controls-${$app.stage}`,
  {
    bucket: langfuseBlobBucket.id,
    rule: {
      objectOwnership: "BucketOwnerPreferred",
    },
  },
);

const langfuseEventBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-event-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-event-bucket-${$app.stage}`,
    forceDestroy: false,
  },
);

// aclの設定
new aws.s3.BucketOwnershipControls(
  `${infraConfigResources.idPrefix}-event-bucket-ownership-controls-${$app.stage}`,
  {
    bucket: langfuseEventBucket.id,
    rule: {
      objectOwnership: "BucketOwnerPreferred",
    },
  },
);

const langfuseClickhouseBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-clickhouse-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-clickhouse-bucket-${$app.stage}`,
    forceDestroy: false,
  },
);

// aclの設定
new aws.s3.BucketOwnershipControls(
  `${infraConfigResources.idPrefix}-clickhouse-bucket-ownership-controls-${$app.stage}`,
  {
    bucket: langfuseClickhouseBucket.id,
    rule: {
      objectOwnership: "BucketOwnerPreferred",
    },
  },
);

const clickhouseBackupBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-${$app.stage}`,
    forceDestroy: false,
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-${$app.stage}`,
    },
  }
);

// 公開ブロック
new aws.s3.BucketPublicAccessBlock(
  `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-pab-${$app.stage}`,
  {
    bucket: clickhouseBackupBucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  }
);

// オブジェクト所有
new aws.s3.BucketOwnershipControls(
  `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-ownership-${$app.stage}`,
  {
    bucket: clickhouseBackupBucket.id,
    rule: {
      objectOwnership: "BucketOwnerPreferred",
    },
  }
);

// サーバーサイド暗号化（まずは AES256 で十分）
new aws.s3.BucketServerSideEncryptionConfiguration(
  `${infraConfigResources.idPrefix}-clickhouse-backup-bucket-sse-${$app.stage}`,
  {
    bucket: clickhouseBackupBucket.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "AES256",
        },
      },
    ],
  }
);

const clickhouseScriptBucket = new aws.s3.Bucket(
  `${infraConfigResources.idPrefix}-clickhouse-script-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-clickhouse-script-${$app.stage}`,
    forceDestroy: false,
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-script-${$app.stage}`,
    },
  }
);

new aws.s3.BucketObject(
  `${infraConfigResources.idPrefix}-backup-script-${$app.stage}`,
  {
    bucket: clickhouseScriptBucket.id,
    key: `clickhouse/${$app.stage}/backup_clickhouse.sh`,
    source: new pulumi.asset.FileAsset(
      "infra/scripts/clickhouse/backup_clickhouse.sh"
    ),
    serverSideEncryption: "AES256",
  }
);

new aws.s3.BucketObject(
  `${infraConfigResources.idPrefix}-restore-script-${$app.stage}`,
  {
    bucket: clickhouseScriptBucket.id,
    key: `clickhouse/${$app.stage}/restore_clickhouse.sh`,
    source: new pulumi.asset.FileAsset(
      "infra/scripts/clickhouse/restore_clickhouse.sh"
    ),
    serverSideEncryption: "AES256",
  }
);

export const s3Resources = {
  albAccessLogBucket,
  albConnectionLogBucket,
  cloudFrontLogBucket,
  langfuseBlobBucket,
  langfuseEventBucket,
  langfuseClickhouseBucket,
  // clickhouseScriptBucket
};
