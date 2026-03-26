import { cloudwatchResources } from "./cloudwatch";
import { ecrResources } from "./ecr";
import { ecsClusterResources } from "./ecs-cluster";
import { efsResources } from "./efs";
import { iamResources } from "./iam";
import { infraConfigResources } from "./infra-config";
import { s3Resources } from "./s3";
import { securityGroupResources } from "./security-group";
import { serviceDiscoveryResources } from "./service-discovery";
import { vpcResources } from "./vpc";

console.log("======ecs-clickhouse.ts start======");

const idPrefix = infraConfigResources.idPrefix;
const stage = $app.stage;

// CD で push した特定タグを使いたいときに指定する。
// 未指定なら従来どおり latest を使う。
const clickhouseImageTag =
  process.env.LANGFUSE_CLICKHOUSE_IMAGE_TAG || "latest";

// Task Definition
const clickhouseTaskDefinition = new aws.ecs.TaskDefinition(
  `${idPrefix}-clickhouse-task-definition-${stage}`,
  {
    family: `${idPrefix}-clickhouse-task-definition-${stage}`,
    trackLatest: true,
    cpu: "4096",
    memory: "8192",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    runtimePlatform: {
      cpuArchitecture: "ARM64",
      operatingSystemFamily: "LINUX",
    },
    executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
    taskRoleArn: iamResources.langfuseEcsTaskRole.arn,
    volumes: [
      {
        name: "clickhouse-data",
        efsVolumeConfiguration: {
          fileSystemId: efsResources.efsFileSystem.id,
          authorizationConfig: {
            accessPointId: efsResources.clickhouseDataAccessPoint.id,
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
            accessPointId: efsResources.clickhouseLogAccessPoint.id,
            iam: "ENABLED",
          },
          transitEncryption: "ENABLED",
        },
      },
    ],
    containerDefinitions: $util
      .all([
        ecrResources.clickHouseContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseClickHouseLog.id,
        s3Resources.langfuseClickhouseBucket.id,
        infraConfigResources.clickhousePasswordParam.arn,
      ])
      .apply(
        ([
          repositoryUrl,
          logGroupId,
          bucketId,
          clickhousePasswordParamArn,
        ]) =>
          $jsonStringify([
            {
              name: `${idPrefix}-clickhouse-ecs-task-${stage}`,
              image: `${repositoryUrl}:${clickhouseImageTag}`,
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
                interval: 5,
                timeout: 5,
                retries: 10,
                startPeriod: 1,
              },
              logConfiguration: {
                logDriver: "awslogs",
                options: {
                  "awslogs-region": infraConfigResources.mainRegion,
                  "awslogs-group": logGroupId,
                  "awslogs-stream-prefix": "clickhouse",
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
              ],
              secrets: [
                {
                  name: "CLICKHOUSE_PASSWORD",
                  valueFrom: clickhousePasswordParamArn,
                },
              ],
            },
          ]),
      ),
  },
);

// ECS Service
const clickhouseService = new aws.ecs.Service(
  `${idPrefix}-clickhouse-ecs-service-v2-${stage}`,
  {
    name: `${idPrefix}-clickhouse-ecs-service-v2-${stage}`,
    cluster: ecsClusterResources.ecsCluster.arn,
    taskDefinition: clickhouseTaskDefinition.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    enableExecuteCommand: true,
    healthCheckGracePeriodSeconds: 180,
    forceNewDeployment: true,
    availabilityZoneRebalancing: "ENABLED",
    deploymentMaximumPercent: 200,
    deploymentMinimumHealthyPercent: 100,
    deploymentCircuitBreaker: {
      enable: true,
      rollback: true,
    },
    serviceRegistries: {
      registryArn: serviceDiscoveryResources.clickhouseService.arn,
    },
    networkConfiguration: {
      subnets: vpcResources.clickHouseProtectedSubnets.map(
        (subnet) => subnet.id,
      ),
      assignPublicIp: false,
      securityGroups: [
        securityGroupResources.clickHouseServerSecurityGroup.id,
      ],
    },
    tags: {
      Name: `${idPrefix}-clickhouse-ecs-service-${stage}`,
    },
  },
);

export const ecsClickhouseResources = {
  clickhouseTaskDefinition,
  clickhouseService,
};