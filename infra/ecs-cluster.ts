import { infraConfigResources } from "./infra-config";
import { cloudwatchResources } from "./cloudwatch";
import { serviceDiscoveryResources } from "./service-discovery";

console.log("======ecs-cluster.ts start======");

// ECS Cluster
const ecsCluster = new aws.ecs.Cluster(
  `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
    settings: [{
      name: "containerInsights",
      value: "enabled",
    }],
    configuration: {
      executeCommandConfiguration: {
        logging: "OVERRIDE",
        logConfiguration: {
          cloudWatchLogGroupName: cloudwatchResources.ecsExecuteCommandLog.name,
        },
      },
    },
    serviceConnectDefaults: {
      namespace: serviceDiscoveryResources.langfuseNamespace.arn,
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
    },
  }
);

// ECS Cluster Capacity Providers
const ecsClusterCapacityProviders = new aws.ecs.ClusterCapacityProviders(
  `${infraConfigResources.idPrefix}-cluster-capacity-providers-${$app.stage}`,
  {
    clusterName: ecsCluster.name,
    capacityProviders: ["FARGATE"],
    defaultCapacityProviderStrategies: [{
      capacityProvider: "FARGATE",
    }],
  }
);

export const ecsClusterResources = {
  ecsCluster,
  ecsClusterCapacityProviders
};