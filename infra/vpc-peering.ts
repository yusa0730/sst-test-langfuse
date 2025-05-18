// import { ENV_KEYS } from "../env/env";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { rdsVpcResources } from "./rds-vpc";

// stageのvalidation
// if (!ENV_KEYS.includes($app.stage)) {
//   throw new Error(`Invalid stage: ${$app.stage}`);
// }

// VPCピアリング
const vpcPeeringConnection = new aws.ec2.VpcPeeringConnection(
  `${infraConfigResources.idPrefix}-ecs-to-rds-vpc-peering-connection-${$app.stage}`,
  {
    vpcId: vpcResources.vpc.id,
    peerVpcId: rdsVpcResources.vpc.id,
    autoAccept: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-ecs-to-rds-vpc-peering-connection-${$app.stage}`,
    },
  },
);

// RDSのルートテーブルにECSのルートを追加
for (const routeTable of rdsVpcResources.privateRouteTables) {
  routeTable.id.apply((routeTableId) => {
    new aws.ec2.Route(`${infraConfigResources.idPrefix}-ecs-to-rds-vpc-peering-route-${routeTableId}-${$app.stage}`, {
      routeTableId,
      destinationCidrBlock: vpcResources.vpc.cidrBlock,
      vpcPeeringConnectionId: vpcPeeringConnection.id,
    });
  });
}

// ECSのルートテーブルにRDSのルートを追加
for (const routeTable of vpcResources.protectedRouteTables) {
  routeTable.id.apply((routeTableId) => {
    new aws.ec2.Route(`${infraConfigResources.idPrefix}-ecs-to-rds-vpc-peering-route-${routeTableId}-${$app.stage}`, {
      routeTableId,
      destinationCidrBlock: rdsVpcResources.vpc.cidrBlock,
      vpcPeeringConnectionId: vpcPeeringConnection.id,
    });
  });
}

// export
export const ecsToRdsVpcPeeringResources = {
  vpcPeeringConnection,
};