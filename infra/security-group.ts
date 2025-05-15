import { bastionResources } from "./bastion";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import * as aws from "@pulumi/aws";

console.log("====== security-group.ts start ======");

// CloudFront prefix list for ALB
const cloudfrontPrefixListId = await aws.ec2.getManagedPrefixList({
  name: "com.amazonaws.global.cloudfront.origin-facing",
}).then((prefixList) => prefixList.id);

// ALB Security Group
const albSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-alb-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-alb-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "ALB Security Group",
  ingress: [
    {
      fromPort: 443,
      toPort: 443,
      protocol: "tcp",
      prefixListIds: [cloudfrontPrefixListId],
      description: "Allow HTTPS from CloudFront",
    },
    {
      // テスト用
      fromPort: 80,
      toPort: 80,
      protocol: "tcp",
      description: "Allow HTTP from network",
      cidrBlocks: ["0.0.0.0/0"],
    }
  ],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: {
    Name: `${infraConfigResources.idPrefix}-alb-sg-${$app.stage}`
  }
});

// ECS-Web Fargate (Langfuse Web) Security Group
const webServerSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-web-server-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-web-server-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "Langfuse Web Server SG",
  ingress: [
    {
      fromPort: 3000,
      toPort: 3000,
      protocol: "tcp",
      securityGroups: [
        albSecurityGroup.id,
        bastionResources.bastionSecurityGroup.id,
      ],
      description: "Allow ALB to WebServer",
    },
    {
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      securityGroups: [
        bastionResources.bastionSecurityGroup.id,
      ],
      description: "Allow WebServer",
    }
  ],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],

  tags: { Name: `${infraConfigResources.idPrefix}-web-server-sg-${$app.stage}` }
});

// Async Worker Security Group
const asyncWorkerSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-async-worker-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-async-worker-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "Async Worker SG",
  ingress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    securityGroups: [
      webServerSecurityGroup.id,
      bastionResources.bastionSecurityGroup.id
    ],
    description: "Allow WebServer",
  }],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  
  tags: { Name: `${infraConfigResources.idPrefix}-async-worker-sg-${$app.stage}` }
});

const clickHouseServerSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-clickhouse-server-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-clickhouse-server-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "ClickHouse Server SG",
  ingress: [
    {
      fromPort: 8123,
      toPort: 8123,
      protocol: "tcp",
      securityGroups: [
        webServerSecurityGroup.id,
        asyncWorkerSecurityGroup.id,
        bastionResources.bastionSecurityGroup.id
      ],
      description: "ClickHouse HTTP access",
    },
    {
      fromPort: 9000,
      toPort: 9000,
      protocol: "tcp",
      securityGroups: [
        webServerSecurityGroup.id,
        asyncWorkerSecurityGroup.id,
        bastionResources.bastionSecurityGroup.id
      ],
      description: "ClickHouse TCP access",
    }
  ],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: { Name: `${infraConfigResources.idPrefix}-clickhouse-server-sg-${$app.stage}` }
});

const auroraServerlessSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-aurora-server-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-aurora-serverless-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "Aurora PostgreSQL Server SG",
  ingress: [{
    fromPort: 5432,
    toPort: 5432,
    protocol: "tcp",
    securityGroups: [
      webServerSecurityGroup.id,
      asyncWorkerSecurityGroup.id,
      bastionResources.bastionSecurityGroup.id
    ],
    description: "Allow Aurora client access",
  }],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: { Name: `${infraConfigResources.idPrefix}-aurora-serverless-sg-${$app.stage}` }
});

const elasticacheServerSecurityGroup = new aws.ec2.SecurityGroup(`${infraConfigResources.idPrefix}-redis-server-sg-${$app.stage}`, {
  name: `${infraConfigResources.idPrefix}-elasticache-server-sg-${$app.stage}`,
  vpcId: vpcResources.vpc.id,
  description: "Redis Server SG",
  ingress: [{
    fromPort: 6379,
    toPort: 6379,
    protocol: "tcp",
    securityGroups: [
      auroraServerlessSecurityGroup.id,
      asyncWorkerSecurityGroup.id,
      webServerSecurityGroup.id,
      bastionResources.bastionSecurityGroup.id
    ],
    description: "Allow Redis client access",
  }],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: { Name: `${infraConfigResources.idPrefix}-elasticache-server-sg-${$app.stage}` }
});

const efsSecurityGroup = new aws.ec2.SecurityGroup(
  `${infraConfigResources.idPrefix}-efs-sg-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-efs-sg-${$app.stage}`,
    vpcId: vpcResources.vpc.id,
    description: "EFS SG",
    ingress: [{
      fromPort: 2049,
      toPort: 2049,
      protocol: "tcp",
      securityGroups: [
        clickHouseServerSecurityGroup.id
      ],
      description: "Allow click house access",
    }],
    egress: [{
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
    }],
    tags: { Name: `${infraConfigResources.idPrefix}-efs-sg-${$app.stage}` }
  }
);

export const securityGroupResources = {
  albSecurityGroup,
  webServerSecurityGroup,
  asyncWorkerSecurityGroup,
  clickHouseServerSecurityGroup,
  auroraServerlessSecurityGroup,
  elasticacheServerSecurityGroup,
  efsSecurityGroup
};
