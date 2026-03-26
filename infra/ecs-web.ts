import { albResources } from "./alb";
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

console.log("======ecs-web.ts start======");

const idPrefix = infraConfigResources.idPrefix;
const stage = $app.stage;

// CD で push した特定タグを使いたいときに指定する。
// 未指定なら従来どおり latest を使う。
const webImageTag = process.env.LANGFUSE_WEB_IMAGE_TAG || "latest";

// Task Definition
const webTaskDefinition = new aws.ecs.TaskDefinition(
  `${idPrefix}-web-server-task-definition-${stage}`,
  {
    family: `${idPrefix}-web-server-task-definition-${stage}`,
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
        ecrResources.webServerContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseWebServerLog.id,
        s3Resources.langfuseEventBucket.id,
        s3Resources.langfuseBlobBucket.id,
        elasticacheResources.elasticache.primaryEndpointAddress,
        elasticacheResources.elasticache.authToken,
        serviceDiscoveryResources.clickhouseService.name,
        serviceDiscoveryResources.langfuseNamespace.name,
        rdsResources.databaseUrlSecret.arn,
        infraConfigResources.clickhousePasswordParam.arn,
        infraConfigResources.webNextSecretParam.arn,
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
          webNextSecretParamArn,
          webSaltParamArn,
          encryptionKeyParamArn,
        ]) =>
          $jsonStringify([
            {
              name: `${idPrefix}-web-server-ecs-task-${stage}`,
              image: `${repositoryUrl}:${webImageTag}`,
              essential: true,
              portMappings: [
                {
                  containerPort: 3000,
                  hostPort: 3000,
                  protocol: "tcp",
                },
              ],
              logConfiguration: {
                logDriver: "awslogs",
                options: {
                  "awslogs-region": infraConfigResources.mainRegion,
                  "awslogs-group": logGroupId,
                  "awslogs-stream-prefix": "web-server",
                },
              },
              environment: [
                {
                  name: "NEXTAUTH_URL",
                  value: `https://langfuse.${infraConfigResources.domainName}`,
                },
                {
                  name: "HOSTNAME",
                  value: "0.0.0.0",
                },
                {
                  name: "S3_BUCKET_NAME",
                  value: blobBucketId,
                },
                {
                  name: "LANGFUSE_S3_MEDIA_UPLOAD_ENABLED",
                  value: "true",
                },
                {
                  name: "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET",
                  value: blobBucketId,
                },
                {
                  name: "LANGFUSE_S3_MEDIA_DOWNLOAD_URL_EXPIRY_SECONDS",
                  value: "604800",
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
                  name: "TELEMETRY_ENABLED",
                  value: "true",
                },
                {
                  name: "LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES",
                  value: "true",
                },
                {
                  name: "LANGFUSE_SDK_CI_SYNC_PROCESSING_ENABLED",
                  value: "false",
                },
                {
                  name: "LANGFUSE_READ_FROM_POSTGRES_ONLY",
                  value: "false",
                },
                {
                  name: "LANGFUSE_READ_FROM_CLICKHOUSE_ONLY",
                  value: "true",
                },
                {
                  name: "LANGFUSE_RETURN_FROM_CLICKHOUSE",
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
                  name: "NEXTAUTH_SECRET",
                  valueFrom: webNextSecretParamArn,
                },
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
const webService = new aws.ecs.Service(
  `${idPrefix}-web-server-ecs-service-v2-${stage}`,
  {
    name: `${idPrefix}-web-server-ecs-service-v2-${stage}`,
    cluster: ecsClusterResources.ecsCluster.arn,
    taskDefinition: webTaskDefinition.arn,
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
      subnets: vpcResources.webServerProtectedSubnets.map(
        (subnet) => subnet.id,
      ),
      assignPublicIp: false,
      securityGroups: [securityGroupResources.webServerSecurityGroup.id],
    },
    loadBalancers: [
      {
        containerName: `${idPrefix}-web-server-ecs-task-${stage}`,
        containerPort: 3000,
        targetGroupArn: albResources.targetGroup.arn,
      },
    ],
    tags: {
      Name: `${idPrefix}-web-server-ecs-service-${stage}`,
    },
  },
  { dependsOn: [albResources.httpsListener] },
);

// Auto Scaling
const webScalingTarget = new aws.appautoscaling.Target(
  `${idPrefix}-web-server-scaling-target-${stage}`,
  {
    serviceNamespace: "ecs",
    resourceId: $interpolate`service/${ecsClusterResources.ecsCluster.name}/${webService.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    minCapacity: 1,
    maxCapacity: 3,
  },
);

new aws.appautoscaling.Policy(
  `${idPrefix}-web-server-cpu-scaling-policy-${stage}`,
  {
    name: `${idPrefix}-web-server-cpu-scaling-${stage}`,
    serviceNamespace: "ecs",
    resourceId: webScalingTarget.resourceId,
    scalableDimension: webScalingTarget.scalableDimension,
    policyType: "TargetTrackingScaling",
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageCPUUtilization",
      },
      targetValue: 60,
    },
  },
);

new aws.appautoscaling.Policy(
  `${idPrefix}-web-server-memory-scaling-policy-${stage}`,
  {
    name: `${idPrefix}-web-server-memory-scaling-${stage}`,
    serviceNamespace: "ecs",
    resourceId: webScalingTarget.resourceId,
    scalableDimension: webScalingTarget.scalableDimension,
    policyType: "TargetTrackingScaling",
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageMemoryUtilization",
      },
      targetValue: 60,
    },
  },
);

export const ecsWebResources = {
  webTaskDefinition,
  webService,
};
