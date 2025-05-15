import * as pulumi from "@pulumi/pulumi";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { cloudwatchResources } from "./cloudwatch";
import { iamResources } from "./iam";
import { securityGroupResources } from "./security-group";
import { ecrResources } from "./ecr";
import { ecsClusterResources } from "./ecs-cluster";
import { serviceDiscoveryResources } from "./service-discovery";
import { efsResources } from "./efs";
import { s3Resources } from "./s3";

console.log("======ecs.ts start======");

const clickhouseTaskDef = new aws.ecs.TaskDefinition(
  `${infraConfigResources.idPrefix}-clickhouse-ecs-task-def-${$app.stage}`,
  {
    family: `${infraConfigResources.idPrefix}-clickhouse-ecs-task-def-${$app.stage}`,
    cpu: "1024",
    memory: "8192",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
    taskRoleArn: iamResources.langfuseEcsTaskRole.arn,

    // volumes: [
    //   {
    //     name: "clickhouse",
    //     efsVolumeConfiguration: {
    //       fileSystemId: efsResources.efsFileSystem.id,
    //       authorizationConfig: {
    //         accessPointId: efsResources.clickhouseAccessPoint.id,
    //         iam: "ENABLED",
    //       },
    //       transitEncryption: "ENABLED",
    //       rootDirectory: "/"
    //     },
    //   },
    // ],

    // 試し用
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
          // rootDirectory: "/"
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
          // rootDirectory: "/"
        },
      },
    ],

    runtimePlatform: {
      operatingSystemFamily: "LINUX",
      cpuArchitecture: "ARM64"
    },

    containerDefinitions: pulumi.all(
      [
        ecrResources.clickHouseContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseClickHouseLog,
        s3Resources.langfuseClickhouseBucket
      ]
    )
    .apply((
      [
        url,
        logGroup,
        bucket
      ]
    ) =>
      $jsonStringify([
        {
          name: `${infraConfigResources.idPrefix}-clickhouse-ecs-task-${$app.stage}`,
          image: `${url}:latest`,
          cpu: 1024,
          memory: 8192,
          essential: true,
          ulimits: [
            {
              name: "nofile",
              softLimit: 65535,
              hardLimit: 65535
            }
          ],
          portMappings: [
            {
              // ClickHouse HTTP interface
              containerPort: 8123,
              hostPort: 8123,
              protocol: "tcp"
            },
            {
              // ClickHouse native interface
              containerPort: 9000,
              hostPort: 9000,
              protocol: "tcp"
            }
          ],
          environment: [
            {
              name: "CLICKHOUSE_DB",
              value: "default"
            },
            {
              name: "CLICKHOUSE_USER",
              value: "clickhouse"
            },
            {
              name: "CLICKHOUSE_PASSWORD",
              value: infraConfigResources.clickhousePassword
            },
            {
              name: "AWS_REGION",
              value: infraConfigResources.mainRegion
            },
            {
              name: "S3_BUCKET",
              value: bucket.id
            },
          ],
          // mountPoints: [{
          //   sourceVolume: "clickhouse",
          //   containerPath: "/var/lib/clickhouse",
          //   readOnly: false,
          // }],

          // 試し用
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
            }
          ],

          healthCheck: {
            command: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1"],
            interval: 5,
            timeout: 5,
            retries: 10,
            startPeriod: 1,
          },
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-region": infraConfigResources.mainRegion,
              "awslogs-group": logGroup.name,
              "awslogs-stream-prefix": "clickhouse",
            },
          },
        },
      ])
    )
  }
);

const clickHouseService = new aws.ecs.Service(
  `${infraConfigResources.idPrefix}-clickhouse-ecs-service-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-clickhouse-ecs-service-${$app.stage}`,
    cluster: ecsClusterResources.ecsCluster.id,
    taskDefinition: clickhouseTaskDef.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    networkConfiguration: {
      subnets: vpcResources.clickHouseProtectedSubnets.map((subnet) => subnet.id),
      assignPublicIp: false,
      securityGroups: [
        securityGroupResources.clickHouseServerSecurityGroup.id
      ],
    },
    serviceRegistries: {
      registryArn: serviceDiscoveryResources.clickhouseService.arn,
    },
    enableExecuteCommand: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-ecs-service-${$app.stage}`,
    },
  }
);

export const ecsClickHouseResources = {
  clickhouseTaskDef,
  clickHouseService
};