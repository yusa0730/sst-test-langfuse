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

console.log("======ecs.ts start======");

ecrResources.clickHouseContainerRepository.repositoryUrl.apply((url) => {
  // ECS Service
  ecsClusterResources.ecsCluster.addService(
    `${infraConfigResources.idPrefix}-clickhouse-ecs-service-${$app.stage}`,
    {
      cpu: "1 vCPU",
      memory: "8 GB",
      architecture: "arm64",
      scaling: {
        min: 2,
        max: 3,
        cpuUtilization: 70,
        memoryUtilization: 70,
      },
      transform: {
        image: {
          push: true,
          tags: [`${url}:latest`],
          // registries: [registryInfo],
          dockerfile: {
            location: "../../app/clickhouse/Dockerfile", // Path to Dockerfile
          },
          context: {
            location: "../../app", // Path to application source code
          },
        },
        service: {
          name: `${infraConfigResources.idPrefix}-clickhouse-ecs-service-${$app.stage}`,
          enableExecuteCommand: true,
          healthCheckGracePeriodSeconds: 180,
          forceNewDeployment: true,
          desiredCount: 2,
          availabilityZoneRebalancing: "ENABLED",
          launchType: "FARGATE",
          serviceRegistries: {
            registryArn: serviceDiscoveryResources.clickhouseService.arn,
          },
          networkConfiguration: {
            subnets: vpcResources.clickHouseProtectedSubnets.map((subnet) => subnet.id),
            assignPublicIp: false,
            securityGroups: [
              securityGroupResources.clickHouseServerSecurityGroup.id
            ],
          },
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
          containerDefinitions: $util.all([
            cloudwatchResources.langfuseClickHouseLog,
            s3Resources.langfuseClickhouseBucket
          ])
          .apply(
            ([
              logGroup,
              bucket
            ]) =>
              $jsonStringify([
              {
                name: `${infraConfigResources.idPrefix}-clickhouse-ecs-task-${$app.stage}`,
                image: `${url}:latest`,
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
                    "awslogs-group": logGroup.id,
                    "awslogs-stream-prefix": "clickhouse",
                  },
                },
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
              },
            ]),
          )
        }
      }
    });
  });