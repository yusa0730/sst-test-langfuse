import { infraConfigResources } from "./infra-config";
import { serviceDiscoveryResources } from "./service-discovery";

console.log("======ecs-cluster.ts start======");

// ECS Cluster (Pulumi native)
const ecsCluster = new aws.ecs.Cluster(
  `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
  {
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
    tags: {
      Name: `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
    },
  }
);

export const ecsClusterResources = {
  ecsCluster,
};
