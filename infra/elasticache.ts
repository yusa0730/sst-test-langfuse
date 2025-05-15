import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";
import { cloudwatchResources } from "./cloudwatch";

// // elasticache作成（valkey）
// const elasticache = new aws.elasticache.ServerlessCache(
//   `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
//   {
//     engine: "valkey",
//     name: `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
//     cacheUsageLimits: {
//       dataStorage: {
//         maximum: 10, // 最大5,000
//         minimum: 1, // 最小1
//         unit: "GB",
//       },
//       ecpuPerSeconds: [
//         {
//           maximum: 5000, // 最大15,000,000
//           minimum: 1000, // 最小1,000
//         },
//       ],
//     },
//     dailySnapshotTime: "14:30",
//     description: `${infraConfigResources.idPrefix}-${$app.stage}`,
//     majorEngineVersion: "7",
//     securityGroupIds: [securityGroupResources.elasticacheServerSecurityGroup.id],
//     subnetIds: vpcResources.elasticachePrivateSubnets.map((subnet) => subnet.id),
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
//     },
//   },
// );

// ElastiCache Subnet Group
const elasticacheSubnetGroup = new aws.elasticache.SubnetGroup(
  `${infraConfigResources.idPrefix}-elasticache-subnet-group-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-elasticache-subnet-group-${$app.stage}`,
    subnetIds: vpcResources.elasticachePrivateSubnets.map((subnet) => subnet.id),
    description: `${infraConfigResources.idPrefix}-elasticache-subnet-group-${$app.stage}`,
    tags: {
      Name: `${infraConfigResources.idPrefix}-elasticache-subnet-group-${$app.stage}`,
    },
  }
);

// ElastiCache Replication Group (Valkey)
const elasticache = new aws.elasticache.ReplicationGroup(
  `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
  {
    replicationGroupId: `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
    description: `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
    engine: "valkey",
    engineVersion: "7.2",
    nodeType: "cache.t4g.small",
    numCacheClusters: 1,
    port: 6379,
    subnetGroupName: elasticacheSubnetGroup.name,
    securityGroupIds: [securityGroupResources.elasticacheServerSecurityGroup.id],
    parameterGroupName: "default.valkey7",
    applyImmediately: true,
    transitEncryptionEnabled: true,
    transitEncryptionMode: "required",
    authToken: infraConfigResources.redisPasswordValue,
    authTokenUpdateStrategy: "ROTATE",
    clusterMode: "disabled",
    logDeliveryConfigurations: [
      {
        destination: cloudwatchResources.langfuseCacheSlowLog.name,
        destinationType: "cloudwatch-logs",
        logFormat: "json",
        logType: "slow-log",
      },
      {
        destination: cloudwatchResources.langfuseCacheEngineLog.name,
        destinationType: "cloudwatch-logs",
        logFormat: "json",
        logType: "engine-log",
      },
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-elasticache-${$app.stage}`,
    },
  }
);

elasticache.authToken.apply((token) => {
  console.log("====token====")
  console.log(token);
  console.log("====token====")
})

// export
export const elasticacheResources = {
  elasticache,
};