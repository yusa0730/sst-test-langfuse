import * as pulumi from "@pulumi/pulumi";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { cloudwatchResources } from "./cloudwatch";
import { iamResources } from "./iam";
import { securityGroupResources } from "./security-group";
import { ecrResources } from "./ecr";
import { ecsClusterResources } from "./ecs-cluster";
import { serviceDiscoveryResources } from "./service-discovery";
import { s3Resources } from "./s3";
import { elasticacheResources } from "./elasticache";
import { rdsResources } from "./aurora";

console.log("======ecs.ts start======");

rdsResources.dbUrlSecret.arn.apply((arn) => {
console.log("===arn====")
console.log(arn)
console.log("===arn====")
})

const asyncWorkerTaskDef = new aws.ecs.TaskDefinition(
  `${infraConfigResources.idPrefix}-async-worker-ecs-task-def-${$app.stage}`,
  {
    family: `${infraConfigResources.idPrefix}-async-worker-ecs-task-def-${$app.stage}`,
    cpu: "2048",
    memory: "4096",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
    taskRoleArn: iamResources.langfuseEcsTaskRole.arn,

    runtimePlatform: {
      operatingSystemFamily: "LINUX",
      cpuArchitecture: "ARM64"
    },

    containerDefinitions: pulumi.all(
      [
        ecrResources.asyncWorkerContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseWorkerLog,
        s3Resources.langfuseEventBucket,
        s3Resources.langfuseBlobBucket,
        elasticacheResources.elasticache,
        serviceDiscoveryResources.clickhouseService.name,
        serviceDiscoveryResources.langfuseNamespace.name,
      ]
    )
    .apply((
      [
        url,
        logGroup,
        eventBucket,
        blobBucket,
        elasticache,
        clickhouseServiceName,
        langfuseNamespaceName,
      ]
    ) =>
      $jsonStringify([
        {
          name: `${infraConfigResources.idPrefix}-async-worker-ecs-task-${$app.stage}`,
          image: `${url}:latest`,
          cpu: 2048,
          memory: 4096,
          essential: true,
          linuxParameters: {
            initProcessEnabled: true
          },
          portMappings: [
            {
              containerPort: 3030,
              hostPort: 3030,
              protocol: "tcp"
            },
          ],
          environment: [
            {
              name: "SALT",
              // value: infraConfigResources.webSalt
              value: "OlJdIRNjb1T/Z2a892wur/7lxuRY2xwawEyfgzDIHI4="
            },
            {
              name: "ENCRIPTION_KEY",
              // value: infraConfigResources.encryptionKey
              value: "93ad754dbecbab246a581ebaaa637091b52bb9653e75a228140c1356ce0b4ca9"
            },
            {
              name: "TELEMETRY_ENABLED",
              value: "true"
            },
            {
              name: "LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES",
              value: "true"
            },
            {
              name: "CLICKHOUSE_MIGRATION_URL",
              value: `clickhouse://${clickhouseServiceName}.${langfuseNamespaceName}:9000`
            },
            {
              name: "CLICKHOUSE_URL",
              value: `http://${clickhouseServiceName}.${langfuseNamespaceName}:8123`
            },
            {
              name: "CLICKHOUSE_USER",
              value: "clickhouse"
            },
            {
              name: "CLICKHOUSE_CLUSTER_ENABLED",
              value: "false"
            },
            {
              name: "LANGFUSE_S3_EVENT_UPLOAD_BUCKET",
              value: eventBucket.id
            },
            {
              name: "LANGFUSE_S3_EVENT_UPLOAD_REGION",
              value: infraConfigResources.mainRegion
            },
            {
              name: "LANGFUSE_S3_EVENT_UPLOAD_PREFIX",
              value: "events/"
            },
            {
              name: "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET",
              value: blobBucket.id
            },
            {
              name: "LANGFUSE_S3_MEDIA_UPLOAD_ENABLED",
              value: "true"
            },
            {
              name: "REDIS_HOST",
              value: elasticache.primaryEndpointAddress,
            },
            {
              name: "REDIS_PORT",
              value: "6379"
            },
            {
              name: "REDIS_AUTH",
              value: elasticache.authToken
            },
            {
              name: "NODE_OPTIONS",
              value: "--max-old-space-size=4096"
            },
            {
              name: "CLICKHOUSE_PASSWORD",
              value: infraConfigResources.clickhousePassword
            },
            // {
            //   name: "DATABASE_URL",
            //   value: rdsResources.dbUrl
            // },
            {
              name: "LANGFUSE_ENABLE_BACKGROUND_MIGRATIONS",
              value: "true"
            },
            { name: "LANGFUSE_LOG_LEVEL", value: "trace"},
            { name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: "http://localhost:4318"},
            { name: "OTEL_SERVICE_NAME", value: "langfuse"},
          ],
          secrets: [
            {
              name: "DATABASE_URL",
              valueFrom: rdsResources.dbUrlSecret.arn
            },
          ],
          healthCheck: {
            command: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3030/api/health || exit 1"],
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
              "awslogs-stream-prefix": "async-worker",
            },
          },
        },
      ])
    )
  }
);

const asyncWorkerService = new aws.ecs.Service(
  `${infraConfigResources.idPrefix}-async-worker-ecs-service-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-async-worker-ecs-service-${$app.stage}`,
    cluster: ecsClusterResources.ecsCluster.id,
    taskDefinition: asyncWorkerTaskDef.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    networkConfiguration: {
      subnets: vpcResources.asyncWorkerProtectedSubnets.map((subnet) => subnet.id),
      assignPublicIp: false,
      securityGroups: [
        securityGroupResources.asyncWorkerSecurityGroup.id
      ],
    },
    serviceConnectConfiguration: {
      enabled: true
    },
    enableExecuteCommand: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-async-worker-ecs-service-${$app.stage}`,
    },
  }
);

export const ecsAsyncWorkerResources = {
  asyncWorkerTaskDef,
  asyncWorkerService
};