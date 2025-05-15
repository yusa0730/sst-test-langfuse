import { infraConfigResources } from "./infra-config";

// Wafカスタムルールを作成
const presignedUrlCdnWafCustomRule = new aws.wafv2.RuleGroup(
  `${infraConfigResources.idPrefix}-cdn-waf-custom-rule-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-cdn-waf-custom-rule-${$app.stage}`,
    description: "Waf custom rule for presigned url cdn",
    capacity: 1,
    scope: "CLOUDFRONT",
    visibilityConfig: {
      cloudwatchMetricsEnabled: true,
      metricName: `${infraConfigResources.idPrefix}-waf-custom-rule-${$app.stage}`,
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        name: "LimitPayloadTo10MB",
        priority: 0,
        action: {
          block: {}, // 10MBを超える場合はブロック
        },
        statement: {
          sizeConstraintStatement: {
            fieldToMatch: {
              body: {
                oversizeHandling: "CONTINUE",
              },
            },
            comparisonOperator: "GT",
            size: 10485760, // 10MB in bytes
            textTransformations: [
              {
                priority: 0,
                type: "NONE",
              },
            ],
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "LimitPayloadTo10MB",
          sampledRequestsEnabled: true,
        },
      },
    ],
  },
  {
    provider: infraConfigResources.awsUsEast1Provider,
  },
);

// Wafを作成
const presignedUrlCdnWaf = new aws.wafv2.WebAcl(
  `${infraConfigResources.idPrefix}-cdn-waf-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-cdn-waf-${$app.stage}`,
    description: "Waf for presigned url cdn",
    defaultAction: {
      allow: {},
    },
    scope: "CLOUDFRONT",
    visibilityConfig: {
      cloudwatchMetricsEnabled: true,
      metricName: `${infraConfigResources.idPrefix}-cdn-waf-${$app.stage}`,
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        name: "LimitPayloadSize",
        priority: 10,
        overrideAction: {
          none: {},
        },
        statement: {
          ruleGroupReferenceStatement: {
            arn: presignedUrlCdnWafCustomRule.arn,
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "LimitPayloadSize",
          sampledRequestsEnabled: true,
        },
      },
      // AWSManagedRulesAmazonIpReputationList
      {
        name: "AWS-AWSManagedRulesAmazonIpReputationList",
        priority: 20,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAmazonIpReputationList",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudwatchMetricsEnabled: true,
          metricName: "awsIpReputationList",
        },
      },
      // AWSManagedRulesAnonymousIpList
      {
        name: "AWS-AWSManagedRulesAnonymousIpList",
        priority: 30,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAnonymousIpList",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudwatchMetricsEnabled: true,
          metricName: "awsAnonymousIpList",
        },
      },
    ],
  },
  {
    provider: infraConfigResources.awsUsEast1Provider,
    dependsOn: [presignedUrlCdnWafCustomRule],
  },
);

export const wafResources = {
  presignedUrlCdnWaf,
};
