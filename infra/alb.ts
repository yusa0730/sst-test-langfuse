// import { infraConfigResources } from "./infra-config";
// import { vpcResources } from "./vpc";
// import { securityGroupResources } from "./security-group";
// import { s3Resources } from "./s3";
// import { acmResources } from "./acm";

// console.log("======alb.ts start======");

// const alb = new aws.lb.LoadBalancer(
//   `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
//   {
//     name: `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
//     loadBalancerType: "application",
//     internal: true,
//     // internal: false,
//     subnets: vpcResources.albProtectedSubnets.map((subnet) => subnet.id),
//     securityGroups: [securityGroupResources.albSecurityGroup.id],
//     accessLogs: {
//       bucket: s3Resources.albAccessLogBucket.id,
//       enabled: true,
//     },
//     connectionLogs: {
//       bucket: s3Resources.albConnectionLogBucket.id,
//       enabled: true,
//     },
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
//     },
//   },
// );

// const targetGroup = new aws.lb.TargetGroup(
//   `${infraConfigResources.idPrefix}-${$app.stage}`,
//   {
//     name: `${infraConfigResources.idPrefix}-tg-${$app.stage}`,
//     targetType: "ip",
//     port: 3000,
//     protocol: "HTTP",
//     vpcId: vpcResources.vpc.id,
//     healthCheck: {
//       enabled: true,
//       path: "/",
//       port: "traffic-port",
//       protocol: "HTTP",
//       healthyThreshold: 5,
//       unhealthyThreshold: 2,
//       interval: 30,
//       timeout: 5,
//       matcher: "200",
//     },
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-tg-${$app.stage}`,
//     }
//   }
// );

// const httpsListener = new aws.lb.Listener(
//   `${infraConfigResources.idPrefix}-https-listener-${$app.stage}`,
//   {
//     loadBalancerArn: alb.arn,
//     port: 443,
//     protocol: "HTTPS",
//     certificateArn: acmResources.albCertificate.arn,
//     sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
//     defaultActions: [
//       {
//         type: "fixed-response",
//         fixedResponse: {
//           contentType: "text/plain",
//           statusCode: "404",
//           messageBody: "404 Not Found",
//         },
//       },
//     ],
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-https-listener-${$app.stage}`,
//     },
//   },
// );

// new aws.lb.ListenerRule(
//   `${infraConfigResources.idPrefix}-https-listener-rule-${$app.stage}`,
//   {
//     listenerArn: httpsListener.arn,
//     priority: 1,
//     conditions: [
//       {
//         httpHeader: {
//           httpHeaderName: "X-Custom-Header",
//           values: [`${infraConfigResources.idPrefix}-cloudfront`],
//         },
//       },
//     ],
//     actions: [
//       {
//         type: "forward",
//         targetGroupArn: targetGroup.arn
//       },
//     ],
//   }
// );

// // Aレコード登録
// new aws.route53.Record(
//   `${infraConfigResources.idPrefix}-alb-route53-a-record-${$app.stage}`,
//   {
//     zoneId: infraConfigResources.hostedZone.zoneId,
//     name: `alb.langfuse.${infraConfigResources.domainName}`,
//     type: aws.route53.RecordType.A,
//     aliases: [
//       {
//         name: alb.dnsName,
//         zoneId: alb.zoneId,
//         evaluateTargetHealth: true,
//       },
//     ],
//   }
// );

// export const albResources = {
//   alb,
//   httpsListener,
//   targetGroup
// };


// =========ALB インターネットフェイシング用==========
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";
import { s3Resources } from "./s3";

console.log("======alb.ts start======");

const alb = new aws.lb.LoadBalancer(
  `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
    loadBalancerType: "application",
    internal: false,
    subnets: vpcResources.publicSubnets.map((subnet) => subnet.id),
    securityGroups: [securityGroupResources.albSecurityGroup.id],
    accessLogs: {
      bucket: s3Resources.albAccessLogBucket.id,
      enabled: true,
    },
    connectionLogs: {
      bucket: s3Resources.albConnectionLogBucket.id,
      enabled: true,
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-alb-${$app.stage}`,
    },
  },
);

const targetGroup = new aws.lb.TargetGroup(
  `${infraConfigResources.idPrefix}-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-tg-${$app.stage}`,
    targetType: "ip",
    port: 3000,
    protocol: "HTTP",
    vpcId: vpcResources.vpc.id,
    healthCheck: {
      enabled: true,
      path: "/",
      port: "traffic-port",
      protocol: "HTTP",
      healthyThreshold: 5,
      unhealthyThreshold: 2,
      interval: 30,
      timeout: 5,
      matcher: "200",
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-tg-${$app.stage}`,
    }
  }
);
const httpListener = new aws.lb.Listener(
  `${infraConfigResources.idPrefix}-http-listener-${$app.stage}`,
  {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [
      {
        type: "forward",
        targetGroupArn: targetGroup.arn,
      },
    ],
  },
);

export const albResources = {
  alb,
  httpListener,
  targetGroup
};