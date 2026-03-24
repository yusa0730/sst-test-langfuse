import { infraConfigResources } from "./infra-config";
import { securityGroupResources } from "./security-group";
import { vpcResources } from "./vpc";

console.log("========nlb.ts start========");

const nlb = new aws.lb.LoadBalancer(
  `${infraConfigResources.idPrefix}-nlb-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-nlb-${$app.stage}`,
    loadBalancerType: "network",
    internal: true,
    subnets: vpcResources.clickHouseProtectedSubnets.map((subnet) => subnet.id),
    securityGroups: [securityGroupResources.nlbSecurityGroup.id],
    enableCrossZoneLoadBalancing: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-nlb-${$app.stage}`,
    },
  }
);

// Target Group for ClickHouse HTTP interface (port 8123)
const clickhouseHttpTargetGroup = new aws.lb.TargetGroup(
  `${infraConfigResources.idPrefix}-ht-tg-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-ht-${$app.stage}`,
    targetType: "ip",
    port: 8123,
    protocol: "TCP",
    vpcId: vpcResources.vpc.id,
    healthCheck: {
      enabled: true,
      protocol: "HTTP",
      path: "/ping",
      port: "8123",
      healthyThreshold: 3,
      unhealthyThreshold: 3,
      interval: 10,
      timeout: 5,
    },
    deregistrationDelay: 30,
    tags: {
      Name: `${infraConfigResources.idPrefix}-ch-http-tg-${$app.stage}`,
    },
  }
);

// Target Group for ClickHouse Native TCP interface (port 9000)
const clickhouseNativeTargetGroup = new aws.lb.TargetGroup(
  `${infraConfigResources.idPrefix}-ch-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-na-${$app.stage}`,
    targetType: "ip",
    port: 9000,
    protocol: "TCP",
    vpcId: vpcResources.vpc.id,
    healthCheck: {
      enabled: true,
      protocol: "HTTP",
      path: "/ping",
      port: "8123",
      healthyThreshold: 3,
      unhealthyThreshold: 3,
      interval: 10,
      timeout: 5,
    },
    deregistrationDelay: 30,
    tags: {
      Name: `${infraConfigResources.idPrefix}-ch-native-tg-${$app.stage}`,
    },
  }
);

// NLB Listener for HTTP interface (port 8123)
new aws.lb.Listener(
  `${infraConfigResources.idPrefix}-nlb-http-listener-${$app.stage}`,
  {
    loadBalancerArn: nlb.arn,
    port: 8123,
    protocol: "TCP",
    defaultActions: [
      {
        type: "forward",
        targetGroupArn: clickhouseHttpTargetGroup.arn,
      },
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-nlb-http-listener-${$app.stage}`,
    },
  }
);

// NLB Listener for Native TCP interface (port 9000)
new aws.lb.Listener(
  `${infraConfigResources.idPrefix}-nlb-native-listener-${$app.stage}`,
  {
    loadBalancerArn: nlb.arn,
    port: 9000,
    protocol: "TCP",
    defaultActions: [
      {
        type: "forward",
        targetGroupArn: clickhouseNativeTargetGroup.arn,
      },
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-nlb-native-listener-${$app.stage}`,
    },
  }
);

export const nlbResources = {
  nlb,
  clickhouseHttpTargetGroup,
  clickhouseNativeTargetGroup,
};
