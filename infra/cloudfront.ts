import { infraConfigResources } from "./infra-config";
import { s3Resources } from "./s3";
import { wafResources } from "./waf";
import { acmResources } from "./acm";
import { albResources } from "./alb";


console.log("========cloudfront.tsスタート==========");

s3Resources.cloudFrontLogBucket.bucketRegionalDomainName.apply((domain) => {
  console.log("bucketRegionalDomainName", domain);
});

const vpcOriginForAlb = new aws.cloudfront.VpcOrigin(
  `${infraConfigResources.idPrefix}-vpc-origin-${$app.stage}`,
  {
    vpcOriginEndpointConfig: {
      arn: albResources.alb.arn,
      httpPort: 80,
      httpsPort: 443,
      name: `${infraConfigResources.idPrefix}-vpc-origin-${$app.stage}`,
      originProtocolPolicy: "https-only",
      originSslProtocols: {
        items: ["TLSv1.2"],
        quantity: 1,
      },
    },
    // timeouts: {
    //   create: "600s",
    //   delete: "600s",
    //   update: "600s",
    // },
    tags: {
        Name: `${infraConfigResources.idPrefix}-vpc-origin-${$app.stage}`,
    },
  }
);

// レスポンスヘッダーポリシー
const cdnResponseHeadersPolicy =
  new aws.cloudfront.ResponseHeadersPolicy(
    `${infraConfigResources.idPrefix}-cdn-response-headers-policy-${$app.stage}`,
    {
      name: `${infraConfigResources.idPrefix}-cdn-response-headers-policy-${$app.stage}`,
      securityHeadersConfig: {
        strictTransportSecurity: {
          override: true,
          accessControlMaxAgeSec: 31536000,
          includeSubdomains: true,
        },
        frameOptions: {
          override: true,
          frameOption: "DENY",
        },
        xssProtection: {
          override: true,
          modeBlock: true,
          protection: true,
        },
        contentTypeOptions: {
          override: true,
        },
        referrerPolicy: {
          override: true,
          referrerPolicy: "strict-origin-when-cross-origin",
        },
      },
    },
  );

const cdn = new sst.aws.Cdn(
  `${infraConfigResources.idPrefix}-cdn-${$app.stage}`,
  {
    // domain: `langfuse.${infraConfigResources.domainName}`,
    domain: {
      name: `langfuse.${infraConfigResources.domainName}`,
      dns: sst.aws.dns({
        zone: infraConfigResources.hostedZone.zoneId
      }),
      cert: acmResources.cloudfrontCertificate.arn
    },
    comment: `${infraConfigResources.idPrefix}-cdn-${$app.stage}`,
    origins: [
      {
        originId: albResources.alb.id,
        // domainName: albResources.alb.dnsName,
        domainName: `alb.langfuse.${infraConfigResources.domainName}`,
        vpcOriginConfig: {
          vpcOriginId: vpcOriginForAlb.id,
          originKeepaliveTimeout: 10,
          originReadTimeout: 10,
        },
        customHeaders: [{
            name: "X-Custom-Header",
            value: `${infraConfigResources.idPrefix}-cloudfront`,
        }],
      }
    ],
    defaultCacheBehavior:
    {
      targetOriginId: albResources.alb.id,
      viewerProtocolPolicy: "https-only",
      allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      cachedMethods: ["GET", "HEAD"],
      minTtl: 0,
      defaultTtl: 3600,
      maxTtl: 86400,
      // AllViewerExceptHostHeader
      originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
      // UseOriginCacheControlHeaders
      cachePolicyId: "83da9c7e-98b4-4e11-a168-04f0df8e2c65",
      responseHeadersPolicyId: cdnResponseHeadersPolicy.id,
      compress: true,
    },
    transform: {
      distribution: {
        // webAclId: wafResources.cdnWaf.arn,
        loggingConfig: {
          bucket: s3Resources.cloudFrontLogBucket.bucketRegionalDomainName,
          prefix: `${infraConfigResources.idPrefix}-cdn-${$app.stage}`,
        },
      },
    },
  },
);

export const cloudfrontResources = {
  cdn,
};