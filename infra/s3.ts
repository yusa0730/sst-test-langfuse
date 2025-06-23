import { infraConfigResources } from "./infra-config";

const albAccessLogBucket = new aws.s3.BucketV2(
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

const albConnectionLogBucket = new aws.s3.BucketV2(
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
const cloudFrontLogBucket = new aws.s3.BucketV2(
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

const langfuseBlobBucket = new aws.s3.BucketV2(
  `${infraConfigResources.idPrefix}-blob-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-blob-bucket-${$app.stage}`,
    forceDestroy: true,
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

const langfuseEventBucket = new aws.s3.BucketV2(
  `${infraConfigResources.idPrefix}-event-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-event-bucket-${$app.stage}`,
    forceDestroy: true,
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

const langfuseClickhouseBucket = new aws.s3.BucketV2(
  `${infraConfigResources.idPrefix}-clickhouse-bucket-${$app.stage}`,
  {
    bucket: `${infraConfigResources.idPrefix}-clickhouse-bucket-${$app.stage}`,
    forceDestroy: true,
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

export const s3Resources = {
  albAccessLogBucket,
  albConnectionLogBucket,
  cloudFrontLogBucket,
  langfuseBlobBucket,
  langfuseEventBucket,
  langfuseClickhouseBucket
};
