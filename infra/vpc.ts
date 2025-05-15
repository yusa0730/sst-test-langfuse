import { infraConfigResources } from "./infra-config";
import { iamResources } from "./iam";
import { cloudwatchResources } from "./cloudwatch";

console.log("======vpc.ts start======");
const publicSubnets = [];
const albProtectedSubnets = [];
const ecsProtectedSubnets = [];
const webServerProtectedSubnets = [];
const asyncWorkerProtectedSubnets = [];
const clickHouseProtectedSubnets = [];
const bastionProtectedSubnets = [];
const elasticachePrivateSubnets = [];
const auroraServerlessPrivateSubnets = [];

const vpc = new aws.ec2.Vpc(
  `${infraConfigResources.idPrefix}-vpc-${$app.stage}`,
  {
    cidrBlock: "10.0.0.0/16",
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

const publicSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-public-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.0.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-public-subnet-1a-${$app.stage}`
    }
  }
);
publicSubnets.push(publicSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-public-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: publicRouteTable.id,
    subnetId: publicSubnet1a.id
  }
);

const publicSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-public-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.1.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-public-subnet-1c-${$app.stage}`
    }
  }
);
publicSubnets.push(publicSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-public-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: publicRouteTable.id,
    subnetId: publicSubnet1c.id
  }
);

// eip&Nat Gateway
const eip1a = new aws.ec2.Eip(
  `${infraConfigResources.idPrefix}-eip-1a-${$app.stage}`,
  {
    domain: "vpc",
    tags: {
      Name: `${infraConfigResources.idPrefix}-eip-1a-${$app.stage}`,
    }
  }
);

const natGateway1a = new aws.ec2.NatGateway(
  `${infraConfigResources.idPrefix}-ngw-1a-${$app.stage}`,
  {
    allocationId: eip1a.id,
    subnetId: publicSubnet1a.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-ngw-1a-${$app.stage}`,
    },
  },
);

if ($app.stage !== "production") {
  const eip1c = new aws.ec2.Eip(
    `${infraConfigResources.idPrefix}-eip-1c-${$app.stage}`,
    {
      domain: "vpc",
      tags: {
        Name: `${infraConfigResources.idPrefix}-eip-1c-${$app.stage}`,
      }
    }
  );

  const natGateway1c = new aws.ec2.NatGateway(
    `${infraConfigResources.idPrefix}-ngw-1c-${$app.stage}`,
    {
      allocationId: eip1c.id,
      subnetId: publicSubnet1c.id,
      tags: {
        Name: `${infraConfigResources.idPrefix}-ngw-1c-${$app.stage}`,
      }
    }
  );
}

const protectedRouteTable1a = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-protected-rtb-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-protected-rtb-1a-${$app.stage}`
    }
  }
);

const protectedRouteTable1c = new aws.ec2.RouteTable(
  `${infraConfigResources.idPrefix}-protected-rtb-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    tags: {
      Name: `${infraConfigResources.idPrefix}-protected-rtb-1c-${$app.stage}`
    }
  }
);

new aws.ec2.Route(
  `${infraConfigResources.idPrefix}-protected-default-route-1a-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    gatewayId: natGateway1a.id,
    destinationCidrBlock: "0.0.0.0/0"
  }
)

new aws.ec2.Route(
  `${infraConfigResources.idPrefix}-protected-default-route-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1c.id,
    gatewayId: natGateway1a.id, // テスト用でnatを一つだけ利用したいため
    destinationCidrBlock: "0.0.0.0/0"
  }
)

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

// bastion用
const bastionProtectedSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-bastion-protected-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.45.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-bastion-protected-subnet-1a-${$app.stage}`
    }
  }
);
bastionProtectedSubnets.push(bastionProtectedSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-bastion-protected-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: protectedRouteTable1a.id,
    subnetId: bastionProtectedSubnet1a.id
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

// =======aurora serverless network========
const auroraServerlessPrivateSubnet1a = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-aurora-serverless-private-subnet-1a-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.60.0/24`,
    availabilityZone: "ap-northeast-1a",
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-serverless-private-subnet-1a-${$app.stage}`
    }
  }
);
auroraServerlessPrivateSubnets.push(auroraServerlessPrivateSubnet1a);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-aurora-serverless-private-route-table-association-1a-${$app.stage}`,
  {
    routeTableId: privateRouteTable1a.id,
    subnetId: auroraServerlessPrivateSubnet1a.id
  }
);

const auroraServerlessPrivateSubnet1c = new aws.ec2.Subnet(
  `${infraConfigResources.idPrefix}-aurora-serverless-private-subnet-1c-${$app.stage}`,
  {
    vpcId: vpc.id,
    cidrBlock: `10.0.61.0/24`,
    availabilityZone: "ap-northeast-1c",
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-serverless-private-subnet-1c-${$app.stage}`
    }
  }
);
auroraServerlessPrivateSubnets.push(auroraServerlessPrivateSubnet1c);

new aws.ec2.RouteTableAssociation(
  `${infraConfigResources.idPrefix}-aurora-serverless-private-route-table-association-1c-${$app.stage}`,
  {
    routeTableId: privateRouteTable1c.id,
    subnetId: auroraServerlessPrivateSubnet1c.id
  }
);

// ======vpc endpoint=======
const vpcEndpointS3Gateway = new aws.ec2.VpcEndpoint(
  `${infraConfigResources.idPrefix}-vpc-endpoint-s3-gateway-${$app.stage}`,
  {
    vpcId: vpc.id,
    serviceName: `com.amazonaws.${infraConfigResources.mainRegion}.s3`,
    privateDnsEnabled: false,
    routeTableIds: [
      protectedRouteTable1a.id,
      protectedRouteTable1c.id
    ],
    vpcEndpointType: "Gateway",
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-endpoint-s3-gateway-${$app.stage}`,
    },
});

export const vpcResources = {
  vpc,
  publicSubnets,
  albProtectedSubnets,
  ecsProtectedSubnets,
  webServerProtectedSubnets,
  asyncWorkerProtectedSubnets,
  clickHouseProtectedSubnets,
  bastionProtectedSubnets,
  elasticachePrivateSubnets,
  auroraServerlessPrivateSubnets,
  vpcEndpointS3Gateway,
};