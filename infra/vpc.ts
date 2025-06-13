import { infraConfigResources } from "./infra-config";
import { iamResources } from "./iam";
import { cloudwatchResources } from "./cloudwatch";
import { env } from "./env";

console.log("======vpc.ts start======");
const albProtectedSubnets = [];
const ecsProtectedSubnets = [];
const webServerProtectedSubnets = [];
const asyncWorkerProtectedSubnets = [];
const clickHouseProtectedSubnets = [];
const elasticachePrivateSubnets = [];
const protectedRouteTables = [];
const vpcEndpointProtectedSubnets = [];

const vpc = new aws.ec2.Vpc(
  `${infraConfigResources.idPrefix}-vpc-${$app.stage}`,
  {
    cidrBlock: env.vpcCidrBlock,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-${$app.stage}`
    }
  }
);

new aws.ec2.FlowLog(
  `${infraConfigResources.idPrefix}-vpc-flow-log-${$app.stage}`,
  {
    iamRoleArn: iamResources.vpcFlowLogRole.arn,
    logDestination: cloudwatchResources.vpcFlowLog.arn,
    trafficType: "ALL",
    vpcId: vpc.id
  }
);

const internetGateway = new aws.ec2.InternetGateway(
  `${infraConfigResources.idPrefix}-igw-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-igw-${$app.stage}`
    }
  }
);

// public
const publicRouteTable = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-public-rtb-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-public-rtb-${$app.stage}`
    }
  }
);

new aws.ec2.Route(
  `${infraConfigResources.idPrefix}-public-default-route-${$app.stage}`,
  {
    routeTableId: publicRouteTable.id,
    gatewayId: internetGateway.id,
    destinationCidrBlock: "0.0.0.0/0"
  }
)

// bastion用
const bastionPublicSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-bastion-public-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.0.0/24`,
    availabilityZone: "ap-northeast-1a",
    mapPublicIpOnLaunch: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-bastion-public-subnet-1a-${$app.stage}`
    }
  }
);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-bastion-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: publicRouteTable.id,
    subnetId: bastionPublicSubnet1a.id
  }
);

// // eip&Nat Gateway
// const eip1a = new aws.ec2.Eip(
//   `${infraConfigResources.idPrefix}-eip-1a-${$app.stage}`,
//   {
//     domain: "vpc",
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-eip-1a-${$app.stage}`,
//     }
//   }
// );

// const natGateway1a = new aws.ec2.NatGateway(
//   `${infraConfigResources.idPrefix}-ngw-1a-${$app.stage}`,
//   {
//     allocationId: eip1a.id,
//     subnetId: publicSubnet1a.id,
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-ngw-1a-${$app.stage}`,
//     },
//   },
// );

// if ($app.stage !== "production") {
//   const eip1c = new aws.ec2.Eip(
//     `${infraConfigResources.idPrefix}-eip-1c-${$app.stage}`,
//     {
//       domain: "vpc",
//       tags: {
//         Name: `${infraConfigResources.idPrefix}-eip-1c-${$app.stage}`,
//       }
//     }
//   );

//   const natGateway1c = new aws.ec2.NatGateway(
//     `${infraConfigResources.idPrefix}-ngw-1c-${$app.stage}`,
//     {
//       allocationId: eip1c.id,
//       subnetId: publicSubnet1c.id,
//       tags: {
//         Name: `${infraConfigResources.idPrefix}-ngw-1c-${$app.stage}`,
//       }
//     }
//   );
// }

const protectedRouteTable1a = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-protected-rtb-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-protected-rtb-1a-${$app.stage}`
    }
  }
);
protectedRouteTables.push(protectedRouteTable1a);

const protectedRouteTable1c = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-protected-rtb-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-protected-rtb-1c-${$app.stage}`
    }
  }
);
protectedRouteTables.push(protectedRouteTable1c);

// // 本番用
// new aws.ec2.Route(
//   `${infraConfigResources.idPrefix}-protected-default-route-1a-${$app.stage}`,
//   {
//     routeTableId: protectedRouteTable1c.id,
//     gatewayId: natGateway1c.id,
//     destinationCidrBlock: "0.0.0.0/0"
//   }
// )

// =======alb network========
const albProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-alb-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.10.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-alb-protected-subnet-1a-${$app.stage}`
    }
  }
);
albProtectedSubnets.push(albProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-alb-protected-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: albProtectedSubnet1a.id
  }
);

const albProtectedSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-alb-protected-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.11.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-alb-protected-subnet-1c-${$app.stage}`
    }
  }
);
albProtectedSubnets.push(albProtectedSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-alb-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    subnetId: albProtectedSubnet1c.id
  }
);

// =======web server network========
const webServerProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-web-server-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.20.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-web-server-protected-subnet-1a-${$app.stage}`
    }
  }
);
webServerProtectedSubnets.push(webServerProtectedSubnet1a);
ecsProtectedSubnets.push(webServerProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-web-server-protected-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: webServerProtectedSubnet1a.id
  }
);

const webServerProtectedSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-web-server-protected-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.21.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-web-server-protected-subnet-1c-${$app.stage}`
    }
  }
);
webServerProtectedSubnets.push(webServerProtectedSubnet1c);
ecsProtectedSubnets.push(webServerProtectedSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-web-server-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    subnetId: webServerProtectedSubnet1c.id
  }
);

// =======async worker network========
const asyncWorkerProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-async-worker-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.30.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-async-worker-protected-subnet-1a-${$app.stage}`
    }
  }
);
asyncWorkerProtectedSubnets.push(asyncWorkerProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-async-worker-protected-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: asyncWorkerProtectedSubnet1a.id
  }
);

const asyncWorkerProtectedSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-async-worker-protected-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.31.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-async-worker-protected-subnet-1c-${$app.stage}`
    }
  }
);
asyncWorkerProtectedSubnets.push(asyncWorkerProtectedSubnet1c);
ecsProtectedSubnets.push(asyncWorkerProtectedSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-async-worker-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    subnetId: asyncWorkerProtectedSubnet1c.id
  }
);

// =======click house network========
const clickHouseProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-clickhouse-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.40.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-protected-subnet-1a-${$app.stage}`
    }
  }
);
clickHouseProtectedSubnets.push(clickHouseProtectedSubnet1a);
ecsProtectedSubnets.push(clickHouseProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-clickhouse-protected-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: clickHouseProtectedSubnet1a.id
  }
);

const clickHouseProtectedSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-clickhouse-protected-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.41.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-protected-subnet-1c-${$app.stage}`
    }
  }
);
clickHouseProtectedSubnets.push(clickHouseProtectedSubnet1c);
ecsProtectedSubnets.push(clickHouseProtectedSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-clickhouse-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    subnetId: clickHouseProtectedSubnet1c.id
  }
);

// ========interface vpc endpoint subnet========
const vpcEndpointProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-vpc-endpoint-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.42.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-endpoint-protected-subnet-1a-${$app.stage}`
    }
  }
);
vpcEndpointProtectedSubnets.push(vpcEndpointProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-vpc-endpoint-protected-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: vpcEndpointProtectedSubnet1a.id
  }
);

const vpcEndpointProtectedSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-vpc-endpoint-protected-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.43.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-endpoint-protected-subnet-1c-${$app.stage}`
    }
  }
);
vpcEndpointProtectedSubnets.push(vpcEndpointProtectedSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-vpc-endpoint-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    subnetId: vpcEndpointProtectedSubnet1c.id
  }
);

// ========private========
const privateRouteTable1a = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-private-rtb-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-private-rtb-1a-${$app.stage}`
    }
  }
);

const privateRouteTable1c = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-private-rtb-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-private-rtb-1c-${$app.stage}`
    }
  }
);

// =======elasticache network========
const elasticachePrivateSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-elasticache-private-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.50.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-elasticache-private-subnet-1a-${$app.stage}`
    }
  }
);
elasticachePrivateSubnets.push(elasticachePrivateSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-elasticache-private-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: privateRouteTable1a.id,
    subnetId: elasticachePrivateSubnet1a.id
  }
);

const elasticachePrivateSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-elasticache-private-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.51.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-elasticache-private-subnet-1c-${$app.stage}`
    }
  }
);
elasticachePrivateSubnets.push(elasticachePrivateSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-elasticache-private-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: privateRouteTable1c.id,
    subnetId: elasticachePrivateSubnet1c.id
  }
);

// // DNS Firewall ログの作成
// const dnsFirewallLogGroup = new aws.cloudwatch.LogGroup(
//   `${infraConfigResources.idPrefix}-dns-firewall-log-group-${$app.stage}`,
//   {
//     name: `/dnsfirewall/${infraConfigResources.idPrefix}-dns-firewall-log-${$app.stage}`,
//     retentionInDays: env.bffDnsFirewallLogRetentionInDays,
//   },
// );

// // Route 53 Resolver Query Logの設定
// const queryLogConfig = new aws.route53.ResolverQueryLogConfig(
//   `${infraConfigResources.idPrefix}-query-log-config-${$app.stage}`,
//   {
//     destinationArn: dnsFirewallLogGroup.arn,
//     name: `${infraConfigResources.idPrefix}-dns-firewall-query-log-config-${$app.stage}`,
//   },
// );

// // ルールグループ
// const dnsFirewallRuleGroup = new aws.route53.ResolverFirewallRuleGroup(
//   `${infraConfigResources.idPrefix}-rule-group-${$app.stage}`,
//   {
//     name: `${infraConfigResources.idPrefix}-dns-firewall-rule-group-${$app.stage}`,
//   },
// );

// // ルール
// new aws.route53.ResolverFirewallRule(
//   `${infraConfigResources.idPrefix}-dns-firewall-rule-101-${$app.stage}`,
//   {
//     name: "AWSManagedDomainsAggregateThreatList",
//     action: "BLOCK",
//     blockResponse: "NODATA",
//     firewallDomainListId: "rslvr-fdl-103b4302c274455e",
//     firewallRuleGroupId: dnsFirewallRuleGroup.id,
//     priority: 101,
//   },
// );
// new aws.route53.ResolverFirewallRule(
//   `${infraConfigResources.idPrefix}-dns-firewall-rule-102-${$app.stage}`,
//   {
//     name: "AWSManagedDomainsAmazonGuardDutyThreatList",
//     action: "BLOCK",
//     blockResponse: "NODATA",
//     firewallDomainListId: "rslvr-fdl-3ba9acb851c04c45",
//     firewallRuleGroupId: dnsFirewallRuleGroup.id,
//     priority: 102,
//   },
// );
// new aws.route53.ResolverFirewallRule(
//   `${infraConfigResources.idPrefix}-dns-firewall-rule-103-${$app.stage}`,
//   {
//     name: "AWSManagedDomainsBotnetCommandandControl",
//     action: "BLOCK",
//     blockResponse: "NODATA",
//     firewallDomainListId: "rslvr-fdl-1a63d8549cca46e6",
//     firewallRuleGroupId: dnsFirewallRuleGroup.id,
//     priority: 103,
//   },
// );
// new aws.route53.ResolverFirewallRule(
//   `${infraConfigResources.idPrefix}-dns-firewall-rule-104-${$app.stage}`,
//   {
//     name: "AWSManagedDomainsMalwareDomainList",
//     action: "BLOCK",
//     blockResponse: "NODATA",
//     firewallDomainListId: "rslvr-fdl-dc19e97bef3c454a",
//     firewallRuleGroupId: dnsFirewallRuleGroup.id,
//     priority: 104,
//   },
// );

// // ルールグループとVPCの関連付け
// new aws.route53.ResolverFirewallRuleGroupAssociation(
//   `${infraConfigResources.idPrefix}-rulegroup-association-${$app.stage}`,
//   {
//     firewallRuleGroupId: dnsFirewallRuleGroup.id,
//     vpcId: vpc.id,
//     priority: 101,
//   },
// );

// // Route 53 ResolverログをVPCに関連付ける
// new aws.route53.ResolverQueryLogConfigAssociation(
//   `${infraConfigResources.idPrefix}-query-logging-config-association-${$app.stage}`,
//   {
//     resolverQueryLogConfigId: queryLogConfig.id,
//     resourceId: vpc.id,
//   },
// );

export const vpcResources = {
  vpc,
  bastionPublicSubnet1a,
  albProtectedSubnets,
  ecsProtectedSubnets,
  webServerProtectedSubnets,
  asyncWorkerProtectedSubnets,
  clickHouseProtectedSubnets,
  vpcEndpointProtectedSubnets,
  elasticachePrivateSubnets,
  protectedRouteTables,
};