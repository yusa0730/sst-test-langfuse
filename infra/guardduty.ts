import { infraConfigResources } from "./infra-config";
import { s3Resources } from "./s3";

// GuaruDuty用のIAMロール
const presignedUrlGuarddutyIamRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-cdn-bucket-guardduty-role-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-cdn-bucket-guardduty-iar-${$app.stage}`,
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Principal: {
            Service: "malware-protection-plan.guardduty.amazonaws.com",
          },
        },
      ],
    }),
    inlinePolicies: [
      {
        name: `${infraConfigResources.idPrefix}-cdn-bucket-guardduty-iap-${$app.stage}`,
        policy: $jsonStringify({
          Version: "2012-10-17",
          Statement: [
            // 一旦は全て権限をつける
            {
              Effect: "Allow",
              Action: ["*"],
              Resource: ["*"],
            },
          ],
        }),
      },
    ],
  },
);

// GuardDuty
const presignedUrlGuardduty = new aws.guardduty.MalwareProtectionPlan(
  `${infraConfigResources.idPrefix}-cdn-bucket-guardduty-malware-protection-plan-${$app.stage}`,
  {
    role: presignedUrlGuarddutyIamRole.arn,
    actions: [
      {
        taggings: [
          {
            status: "ENABLED",
          },
        ],
      },
    ],
    protectedResource: {
      s3Bucket: {
        bucketName: s3Resources.presignedUrlCdnBucket.bucket,
      },
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-cdn-bucket-guardduty-malware-protection-plan-${$app.stage}`,
    },
  },
);

// export
export const uploadBucketGuardDutyResources = {
  presignedUrlGuarddutyIamRole,
  presignedUrlGuardduty,
};
