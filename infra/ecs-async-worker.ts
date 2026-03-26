import { cloudwatchResources } from "./cloudwatch";
import { ecrResources } from "./ecr";
import { ecsClusterResources } from "./ecs-cluster";
import { elasticacheResources } from "./elasticache";
import { iamResources } from "./iam";
import { infraConfigResources } from "./infra-config";
import { rdsResources } from "./rds";
import { s3Resources } from "./s3";
import { securityGroupResources } from "./security-group";
import { serviceDiscoveryResources } from "./service-discovery";
import { vpcResources } from "./vpc";

console.log("======ecs-async-worker.ts start======");

const idPrefix = infraConfigResources.idPrefix;
const stage = $app.stage;

// CD で push した特定タグを使いたいときに指定する。
// 未指定なら従来どおり latest を使う。
const asyncWorkerImageTag =
  process.env.LANGFUSE_ASYNC_WORKER_IMAGE_TAG || "latest";

// Task Definition
const asyncWorkerTaskDefinition = new aws.ecs.TaskDefinition(
  `${idPrefix}-async-worker-task-definition-${stage}`,
  {
    family: `${idPrefix}-async-worker-task-definition-${stage}`,
    trackLatest: true,
    cpu: "2048",
    memory: "4096",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    runtimePlatform: {
      cpuArchitecture: "ARM64",
      operatingSystemFamily: "LINUX",
    },
    executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
    taskRoleArn: iamResources.langfuseEcsTaskRole.arn,
    containerDefinitions: $util
      .all([
        ecrResources.asyncWorkerContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseWorkerLog.id,
        s3Resources.langfuseEventBucket.id,
        s3Resources.langfuseBlobBucket.id,
        elasticacheResources.elasticache.primaryEndpointAddress,
        elasticacheResources.elasticache.authToken,
        serviceDiscoveryResources.clickhouseService.name,
        serviceDiscoveryResources.langfuseNamespace.name,
        rdsResources.databaseUrlSecret.arn,
        infraConfigResources.clickhousePasswordParam.arn,
        infraConfigResources.webSaltParam.arn,
        infraConfigResources.encryptionKeyParam.arn,
      ])
      .apply(
        ([
          repositoryUrl,
          logGroupId,
          eventBucketId,
          blobBucketId,
          elasticachePrimaryEndpointAddress,
          elasticacheAuthToken,
          clickhouseServiceName,
          langfuseNamespaceName,
          databaseUrlSecretArn,
          clickhousePasswordParamArn,
          webSaltParamArn,
          encryptionKeyParamArn,
        ]) =>
          $jsonStringify([
            {
              name: `${idPrefix}-async-worker-ecs-task-${stage}`,
              image: `${repositoryUrl}:${asyncWorkerImageTag}`,
              essential: true,
              linuxParameters: {
                initProcessEnabled: true,
              },
              portMappings: [
                {
                  containerPort: 3030,
                  hostPort: 3030,
                  protocol: "tcp",
                },
              ],
              logConfiguration: {
                logDriver: "awslogs",
                options: {
                  "awslogs-region": infraConfigResources.mainRegion,
                  "awslogs-group": logGroupId,
                  "awslogs-stream-prefix": "async-worker",
                },
              },
              environment: [
                {
                  name: "TELEMETRY_ENABLED",
                  value: "true",
                },
                {
                  name: "LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES",
                  value: "true",
                },
                {
                  name: "CLICKHOUSE_MIGRATION_URL",
                  value: `clickhouse://${clickhouseServiceName}.${langfuseNamespaceName}:9000`,
                },
                {
                  name: "CLICKHOUSE_URL",
                  value: `http://${clickhouseServiceName}.${langfuseNamespaceName}:8123`,
                },
                {
                  name: "CLICKHOUSE_USER",
                  value: "clickhouse",
                },
                {
                  name: "CLICKHOUSE_CLUSTER_ENABLED",
                  value: "false",
                },
                {
                  name: "LANGFUSE_S3_EVENT_UPLOAD_BUCKET",
                  value: eventBucketId,
                },
                {
                  name: "LANGFUSE_S3_EVENT_UPLOAD_REGION",
                  value: infraConfigResources.mainRegion,
                },
                {
                  name: "LANGFUSE_S3_EVENT_UPLOAD_PREFIX",
                  value: "events/",
                },
                {
                  name: "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET",
                  value: blobBucketId,
                },
                {
                  name: "LANGFUSE_S3_MEDIA_UPLOAD_ENABLED",
                  value: "true",
                },
                {
                  name: "REDIS_HOST",
                  value: elasticachePrimaryEndpointAddress,
                },
                {
                  name: "REDIS_PORT",
                  value: "6379",
                },
                {
                  name: "REDIS_AUTH",
                  value: elasticacheAuthToken,
                },
                {
                  name: "REDIS_TLS_ENABLED",
                  value: "true",
                },
                {
                  name: "NODE_OPTIONS",
                  value: "--max-old-space-size=4096",
                },
                {
                  name: "LANGFUSE_ENABLE_BACKGROUND_MIGRATIONS",
                  value: "true",
                },
                { name: "LANGFUSE_LOG_LEVEL", value: "trace" },
                {
                  name: "OTEL_EXPORTER_OTLP_ENDPOINT",
                  value: "http://localhost:4318",
                },
                { name: "OTEL_SERVICE_NAME", value: "langfuse" },
              ],
              secrets: [
                {
                  name: "SALT",
                  valueFrom: webSaltParamArn,
                },
                {
                  name: "ENCRYPTION_KEY",
                  valueFrom: encryptionKeyParamArn,
                },
                {
                  name: "CLICKHOUSE_PASSWORD",
                  valueFrom: clickhousePasswordParamArn,
                },
                {
                  name: "DATABASE_URL",
                  valueFrom: databaseUrlSecretArn,
                },
              ],
            },
          ]),
      ),
  },
);

// ECS Service
const asyncWorkerService = new aws.ecs.Service(
  `${idPrefix}-async-worker-ecs-service-${stage}`,
  {
    name: `${idPrefix}-async-worker-ecs-service-${stage}`,
    cluster: ecsClusterResources.ecsCluster.arn,
    taskDefinition: asyncWorkerTaskDefinition.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    enableExecuteCommand: true,
    healthCheckGracePeriodSeconds: 180,
    forceNewDeployment: true,
    availabilityZoneRebalancing: "ENABLED",
    serviceConnectConfiguration: {
      enabled: true,
    },
    deploymentMaximumPercent: 200,
    deploymentMinimumHealthyPercent: 100,
    deploymentCircuitBreaker: {
      enable: true,
      rollback: true,
    },
    networkConfiguration: {
      subnets: vpcResources.asyncWorkerProtectedSubnets.map(
        (subnet) => subnet.id,
      ),
      assignPublicIp: false,
      securityGroups: [securityGroupResources.asyncWorkerSecurityGroup.id],
    },
    tags: {
      Name: `${idPrefix}-async-worker-ecs-service-${stage}`,
    },
  },
);

// Auto Scaling
const asyncWorkerScalingTarget = new aws.appautoscaling.Target(
  `${idPrefix}-async-worker-scaling-target-${stage}`,
  {
    serviceNamespace: "ecs",
    resourceId: $interpolate`service/${ecsClusterResources.ecsCluster.name}/${asyncWorkerService.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    minCapacity: 1,
    maxCapacity: 2,
  },
);

new aws.appautoscaling.Policy(
  `${idPrefix}-async-worker-cpu-scaling-policy-${stage}`,
  {
    name: `${idPrefix}-async-worker-cpu-scaling-${stage}`,
    serviceNamespace: "ecs",
    resourceId: asyncWorkerScalingTarget.resourceId,
    scalableDimension: asyncWorkerScalingTarget.scalableDimension,
    policyType: "TargetTrackingScaling",
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageCPUUtilization",
      },
      targetValue: 70,
    },
  },
);

new aws.appautoscaling.Policy(
  `${idPrefix}-async-worker-memory-scaling-policy-${stage}`,
  {
    name: `${idPrefix}-async-worker-memory-scaling-${stage}`,
    serviceNamespace: "ecs",
    resourceId: asyncWorkerScalingTarget.resourceId,
    scalableDimension: asyncWorkerScalingTarget.scalableDimension,
    policyType: "TargetTrackingScaling",
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageMemoryUtilization",
      },
      targetValue: 70,
    },
  },
);

export const ecsAsyncWorkerResources = {
  asyncWorkerTaskDefinition,
  asyncWorkerService,
};