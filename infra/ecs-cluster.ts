import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";
import { serviceDiscoveryResources } from "./service-discovery";

console.log("======ecs.ts start======");

// ECS Cluster
const ecsCluster = new sst.aws.Cluster.v1(
  `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
  {
    vpc: {
      id: vpcResources.vpc.id,
      publicSubnets: vpcResources.albProtectedSubnets.map((subnet) => subnet.id),
      privateSubnets: vpcResources.ecsProtectedSubnets.map((subnet) => subnet.id),
      securityGroups: [
        securityGroupResources.webServerSecurityGroup.id,
        securityGroupResources.asyncWorkerSecurityGroup.id,
        securityGroupResources.clickHouseServerSecurityGroup.id
      ],
    },
    transform: {
      cluster: {
        name: `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
        settings: [
          {
              name: "containerInsights",
              value: "enhanced",
          },
        ],
        serviceConnectDefaults: {
          namespace: serviceDiscoveryResources.langfuseNamespace.arn,
        },
      },
    },
  }
);

export const ecsClusterResources = {
  ecsCluster,
};