import * as pulumi from "@pulumi/pulumi";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { cloudwatchResources } from "./cloudwatch";
import { iamResources } from "./iam";
import { securityGroupResources } from "./security-group";
import { ecrResources } from "./ecr";
import { s3Resources } from "./s3";
import { ecsClusterResources } from "./ecs-cluster";
import { efsResources } from "./efs";
import { serviceDiscoveryResources } from "./service-discovery";
import { nlbResources } from "./nlb";

console.log("======ecs-clickhouse.ts start======");

interface ClickHouseServerConfig {
  serverNumber: number;
  replicaName: string;
  interserverHost: string;
  serviceDiscoveryArn: pulumi.Input<string>;
  dataAccessPointId: pulumi.Input<string>;
  logAccessPointId: pulumi.Input<string>;
  subnetIds: pulumi.Input<string>[];
}

const servers: ClickHouseServerConfig[] = [
  {
    serverNumber: 1,
    replicaName: "clickhouse-1",
    interserverHost: "clickhouse-1.langfuse.local",
    serviceDiscoveryArn: serviceDiscoveryResources.clickhouse1Service.arn,
    // 既存データを保持する CH1
    dataAccessPointId: efsResources.clickhouseDataAccessPoint.id,
    logAccessPointId: efsResources.clickhouseLogAccessPoint.id,
    subnetIds: [vpcResources.clickHouseProtectedSubnets[0].id],
  },
  {
    serverNumber: 2,
    replicaName: "clickhouse-2",
    interserverHost: "clickhouse-2.langfuse.local",
    serviceDiscoveryArn: serviceDiscoveryResources.clickhouse2Service.arn,
    // 新規追加の CH2
    dataAccessPointId: efsResources.clickhouse2DataAccessPoint.id,
    logAccessPointId: efsResources.clickhouse2LogAccessPoint.id,
    subnetIds: [vpcResources.clickHouseProtectedSubnets[1].id],
  },
];

ecrResources.clickHouseContainerRepository.repositoryUrl.apply((url) => {
  for (const server of servers) {
    const num = server.serverNumber;

    ecsClusterResources.ecsCluster.addService(
      `${infraConfigResources.idPrefix}-clickhouse-${num}-ecs-service-${$app.stage}`,
      {
        cpu: "4 vCPU",
        memory: "8 GB",
        architecture: "arm64",
        transform: {
          image: {
            push: true,
            tags: [`${url}:latest`],
            dockerfile: {
              location: "../../app/clickhouse/Dockerfile",
            },
            context: {
              location: "../../app/clickhouse",
            },
          },
          service: {
            name: `${infraConfigResources.idPrefix}-clickhouse-${num}-ecs-service-${$app.stage}`,
            enableExecuteCommand: true,
            healthCheckGracePeriodSeconds: 180,
            forceNewDeployment: true,
            desiredCount: 1,
            launchType: "FARGATE",
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            serviceRegistries: {
              registryArn: server.serviceDiscoveryArn,
            },
            networkConfiguration: {
              subnets: server.subnetIds,
              assignPublicIp: false,
              securityGroups: [
                securityGroupResources.clickHouseServerSecurityGroup.id,
              ],
            },
            loadBalancers: [
              {
                containerName: `${infraConfigResources.idPrefix}-clickhouse-${num}-ecs-task-${$app.stage}`,
                containerPort: 8123,
                targetGroupArn: nlbResources.clickhouseHttpTargetGroup.arn,
              },
              {
                containerName: `${infraConfigResources.idPrefix}-clickhouse-${num}-ecs-task-${$app.stage}`,
                containerPort: 9000,
                targetGroupArn: nlbResources.clickhouseNativeTargetGroup.arn,
              },
            ],
          },
          taskDefinition: {
            executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
            taskRoleArn: iamResources.langfuseEcsTaskRole.arn,
            volumes: [
              {
                name: "clickhouse-data",
                efsVolumeConfiguration: {
                  fileSystemId: efsResources.efsFileSystem.id,
                  authorizationConfig: {
                    accessPointId: server.dataAccessPointId,
                    iam: "ENABLED",
                  },
                  transitEncryption: "ENABLED",
                },
              },
              {
                name: "clickhouse-log",
                efsVolumeConfiguration: {
                  fileSystemId: efsResources.efsFileSystem.id,
                  authorizationConfig: {
                    accessPointId: server.logAccessPointId,
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
              .all([
                cloudwatchResources.langfuseClickHouseLog.id,
                s3Resources.langfuseClickhouseBucket.id,
                infraConfigResources.clickhousePasswordParam.arn,
              ])
              .apply(([logGroupId, bucketId, clickhousePasswordParamArn]) =>
                $jsonStringify([
                  {
                    name: `${infraConfigResources.idPrefix}-clickhouse-${num}-ecs-task-${$app.stage}`,
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
                        containerPort: 8123,
                        hostPort: 8123,
                        protocol: "tcp",
                      },
                      {
                        containerPort: 9000,
                        hostPort: 9000,
                        protocol: "tcp",
                      },
                      {
                        containerPort: 9009,
                        hostPort: 9009,
                        protocol: "tcp",
                      },
                    ],
                    mountPoints: [
                      {
                        sourceVolume: "clickhouse-data",
                        containerPath: "/var/lib/clickhouse",
                        readOnly: false,
                      },
                      {
                        sourceVolume: "clickhouse-log",
                        containerPath: "/var/log/clickhouse-server",
                        readOnly: false,
                      },
                    ],
                    healthCheck: {
                      command: [
                        "CMD-SHELL",
                        "wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1",
                      ],
                      interval: 10,
                      timeout: 5,
                      retries: 10,
                      startPeriod: 30,
                    },
                    logConfiguration: {
                      logDriver: "awslogs",
                      options: {
                        "awslogs-region": infraConfigResources.mainRegion,
                        "awslogs-group": logGroupId,
                        "awslogs-stream-prefix": `clickhouse-${num}`,
                      },
                    },
                    environment: [
                      {
                        name: "CLICKHOUSE_DB",
                        value: "default",
                      },
                      {
                        name: "CLICKHOUSE_USER",
                        value: "clickhouse",
                      },
                      {
                        name: "AWS_REGION",
                        value: infraConfigResources.mainRegion,
                      },
                      {
                        name: "S3_BUCKET",
                        value: bucketId,
                      },
                      {
                        name: "CLICKHOUSE_REPLICA_NAME",
                        value: server.replicaName,
                      },
                      {
                        name: "CLICKHOUSE_INTERSERVER_HOST",
                        value: server.interserverHost,
                      },
                    ],
                    secrets: [
                      {
                        name: "CLICKHOUSE_PASSWORD",
                        valueFrom: clickhousePasswordParamArn,
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
