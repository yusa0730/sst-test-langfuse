import { cloudwatchResources } from "./cloudwatch";
import { ecrResources } from "./ecr";
import { ecsClusterResources } from "./ecs-cluster";
import { efsResources } from "./efs";
import { iamResources } from "./iam";
import { infraConfigResources } from "./infra-config";
import { securityGroupResources } from "./security-group";
import { serviceDiscoveryResources } from "./service-discovery";
import { vpcResources } from "./vpc";
import * as pulumi from "@pulumi/pulumi";

interface KeeperConfig {
  keeperNumber: number;
  serverId: string;
  serviceDiscoveryArn: pulumi.Input<string>;
  dataAccessPointId: pulumi.Input<string>;
  subnetIds: pulumi.Input<string>[];
}

console.log("======ecs-clickhouse-keeper.ts start======");

// ClickHouse Keeper nodes #1, #2, #3
// 3 nodes across 2 AZs: Keeper 1 in 1a, Keeper 2 in 1c, Keeper 3 in 1a

const keepers: KeeperConfig[] = [
  {
    keeperNumber: 1,
    serverId: "1",
    serviceDiscoveryArn: serviceDiscoveryResources.clickhouseKeeper1Service.arn,
    dataAccessPointId: efsResources.keeper1DataAccessPointV2.id,
    subnetIds: [vpcResources.clickHouseProtectedSubnets[0].id], // 1a
  },
  {
    keeperNumber: 2,
    serverId: "2",
    serviceDiscoveryArn: serviceDiscoveryResources.clickhouseKeeper2Service.arn,
    dataAccessPointId: efsResources.keeper2DataAccessPointV2.id,
    subnetIds: [vpcResources.clickHouseProtectedSubnets[1].id], // 1c
  },
  {
    keeperNumber: 3,
    serverId: "3",
    serviceDiscoveryArn: serviceDiscoveryResources.clickhouseKeeper3Service.arn,
    dataAccessPointId: efsResources.keeper3DataAccessPointV2.id,
    subnetIds: [vpcResources.clickHouseProtectedSubnets[0].id], // 1a
  },
];

ecrResources.clickHouseKeeperContainerRepository.repositoryUrl.apply((url) => {
  for (const keeper of keepers) {
    const num = keeper.keeperNumber;

    ecsClusterResources.ecsCluster.addService(
      `${infraConfigResources.idPrefix}-clickhouse-keeper-${num}-ecs-service-${$app.stage}`,
      {
        cpu: "1 vCPU",
        memory: "2 GB",
        architecture: "arm64",
        transform: {
          image: {
            push: true,
            tags: [`${url}:latest`],
            dockerfile: {
              location: "../../app/clickhouse-keeper/Dockerfile", // Path to Dockerfile
            },
            context: {
              location: "../../app/clickhouse-keeper",
            },
          },
          service: {
            name: `${infraConfigResources.idPrefix}-clickhouse-keeper-${num}-ecs-service-${$app.stage}`,
            enableExecuteCommand: true,
            healthCheckGracePeriodSeconds: 120,
            forceNewDeployment: true,
            desiredCount: 1,
            launchType: "FARGATE",
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            serviceRegistries: {
              registryArn: keeper.serviceDiscoveryArn,
            },
            networkConfiguration: {
              subnets: keeper.subnetIds,
              assignPublicIp: false,
              securityGroups: [
                securityGroupResources.clickHouseKeeperSecurityGroup.id,
              ],
            },
          },
          taskDefinition: {
            executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
            taskRoleArn: iamResources.langfuseEcsTaskRole.arn,
            volumes: [
              {
                name: "keeper-data",
                efsVolumeConfiguration: {
                  fileSystemId: efsResources.efsFileSystem.id,
                  authorizationConfig: {
                    accessPointId: keeper.dataAccessPointId,
                    iam: "ENABLED",
                  },
                  transitEncryption: "ENABLED",
                },
              },
            ],
            runtimePlatform: {
              operatingSystemFamily: "LINUX",
              cpuArchitecture: "ARM64",
            },
            containerDefinitions: $util
              .all([cloudwatchResources.langfuseClickHouseKeeperLog.id])
              .apply(([logGroupId]) =>
                $jsonStringify([
                  {
                    name: `${infraConfigResources.idPrefix}-clickhouse-keeper-${num}-ecs-task-${$app.stage}`,
                    image: `${url}:latest`,
                    essential: true,
                    ulimits: [
                      {
                        name: "nofile",
                        softLimit: 65535,
                        hardLimit: 65535,
                      },
                    ],
                    portMappings: [
                      {
                        containerPort: 9181,
                        hostPort: 9181,
                        protocol: "tcp",
                      },
                      {
                        containerPort: 9234,
                        hostPort: 9234,
                        protocol: "tcp",
                      },
                    ],
                    mountPoints: [
                      {
                        sourceVolume: "keeper-data",
                        containerPath: "/var/lib/clickhouse-keeper",
                        readOnly: false,
                      },
                    ],
                    healthCheck: {
                      command: [
                        "CMD-SHELL",
                        "echo ruok | nc localhost 9181 | grep -q imok || exit 1",
                      ],
                      interval: 10,
                      timeout: 5,
                      retries: 5,
                      startPeriod: 30,
                    },
                    logConfiguration: {
                      logDriver: "awslogs",
                      options: {
                        "awslogs-region": infraConfigResources.mainRegion,
                        "awslogs-group": logGroupId,
                        "awslogs-stream-prefix": `clickhouse-keeper-${num}`,
                      },
                    },
                    environment: [
                      {
                        name: "KEEPER_SERVER_ID",
                        value: keeper.serverId,
                      },
                    ],
                  },
                ])
              ),
          },
        },
      }
    );
  }
});
