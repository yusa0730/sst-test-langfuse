import { infraConfigResources } from "./infra-config";
import { ENV_KEYS, env } from "./env";

// stageのvalidation
// if (!ENV_KEYS.includes($app.stage)) {
//   throw new Error(`Invalid stage: ${$app.stage}`);
// }

// vpcフローログ
const vpcFlowLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-rds-vpc-flow-log-group-${$app.stage}`,
  {
    name: `/vpc/${infraConfigResources.idPrefix}-rds-vpc-flow-log-group-${$app.stage}`,
    retentionInDays: env.rdsVpcFlowLogRetentionInDays,
  },
);

// VPCフローログを配信するためのIAMロール
const vpcFlowLogRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-rds-vpc-flow-log-role-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-rds-vpc-flow-log-role-${$app.stage}`,
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Principal: {
            Service: "vpc-flow-logs.amazonaws.com",
          },
        },
      ],
    }),
    inlinePolicies: [
      {
        name: `${infraConfigResources.idPrefix}-rds-vpc-flow-log-role-policy-${$app.stage}`,
        policy: $jsonStringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
              ],
              Resource: ["*"],
            },
          ],
        }),
      },
    ],
  },
);

// VPC
const vpc = new aws.ec2.Vpc(
  `${infraConfigResources.idPrefix}-rds-vpc-${$app.stage}`, {
  cidrBlock: env.rdsVpcCidrBlock,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `${infraConfigResources.idPrefix}-rds-vpc-${$app.stage}`,
  },
});

// VPCフローログの紐付け
new aws.ec2.FlowLog(
  `${infraConfigResources.idPrefix}-rds-vpc-flow-log-${$app.stage}`,
  {
    iamRoleArn: vpcFlowLogRole.arn,
    logDestination: vpcFlowLog.arn,
    trafficType: "ALL",
    vpcId: vpc.id,
  }
);

// VPC設定
const rdsVpcPrivateSubnets: aws.ec2.Subnet[] = [];
const privateRouteTables: aws.ec2.RouteTable[] = [];

const privateRouteTable1a = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-rds-vpc-private-rtb-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-rds-vpc-private-rtb-1a-${$app.stage}`
    }
  }
);
privateRouteTables.push(privateRouteTable1a);

const privateRouteTable1c = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-rds-vpc-private-rtb-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-rds-vpc-private-rtb-1c-${$app.stage}`
    }
  }
);
privateRouteTables.push(privateRouteTable1c);

const rdsVpcPrivateSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-rds-vpc-private-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `172.16.0.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-rds-vpc-private-subnet-1a-${$app.stage}`
    }
  }
);
rdsVpcPrivateSubnets.push(rdsVpcPrivateSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-rds-vpc-private-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: privateRouteTable1a.id,
    subnetId: rdsVpcPrivateSubnet1a.id
  }
);

const rdsVpcPrivateSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-rds-vpc-private-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `172.16.1.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-rds-vpc-private-subnet-1c-${$app.stage}`
    }
  }
);
rdsVpcPrivateSubnets.push(rdsVpcPrivateSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-rds-vpc-private-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: privateRouteTable1c.id,
    subnetId: rdsVpcPrivateSubnet1c.id
  }
);


// routeTableIdパラメータ登録
// TODO: 値の登録に失敗しているので、コメントアウト
// new aws.ssm.Parameter(`${idPrefix}-route-table-id-${$app.stage}`, {
//   name: `/satto/memo/${$app.stage}/rds/route-table-id`,
//   type: aws.ssm.ParameterType.String,
//   value: privateRouteTables
//     .map((routeTable) => routeTable.id.apply((id) => id))
//     .toString(),
// });

// export
export const rdsVpcResources = {
  vpc,
  vpcFlowLog,
  vpcFlowLogRole,
  rdsVpcPrivateSubnets,
  privateRouteTables,
};