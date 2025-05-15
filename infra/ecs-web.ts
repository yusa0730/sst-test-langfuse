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
import { albResources } from "./alb";
import { rdsResources } from "./aurora";
import { elasticacheResources } from "./elasticache";

console.log("======ecs.ts start======");

const webServerTaskDef = new aws.ecs.TaskDefinition(
  `${infraConfigResources.idPrefix}-web-server-ecs-task-def-${$app.stage}`,
  {
    family: `${infraConfigResources.idPrefix}-web-server-ecs-task-def-${$app.stage}`,
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
        ecrResources.webServerContainerRepository.repositoryUrl,
        cloudwatchResources.langfuseWorkerLog,
        s3Resources.langfuseEventBucket,
        s3Resources.langfuseBlobBucket,
        elasticacheResources.elasticache,
        serviceDiscoveryResources.clickhouseService.name,
        serviceDiscoveryResources.langfuseNamespace.name,
        albResources.alb.dnsName
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
        albDnsName
      ]
    ) =>
      $jsonStringify([
        {
          name: `${infraConfigResources.idPrefix}-web-server-ecs-task-${$app.stage}`,
          image: `${url}:latest`,
          cpu: 1024,
          memory: 4096,
          essential: true,
          portMappings: [
            {
              containerPort: 3000,
              hostPort: 3000,
              protocol: "tcp"
            },
          ],
          environment: [
            {
              name: "NEXTAUTH_URL",
              value: `http://${albDnsName}`
            },
            // {
            //   name: "NEXTAUTH_URL",
            //   value: `http://localhost:3000`
            // },
            // {
            //   name: "NEXTAUTH_URL",
            //   value: `https://langfuse.${infraConfigResources.domainName}`
            // },
            {
              name: "NEXTAUTH_SECRET",
              // value: infraConfigResources.webNextSecret
              value: "YxWYBFFj07mUUGZQ0xzGayPA1CQe7s8dxHwHG03irh4="
            },
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
              name: "HOSTNAME",
              value: "0.0.0.0"
            },
            {
              name: "S3_BUCKET_NAME",
              value: blobBucket.id
            },
            {
              name: "LANGFUSE_S3_MEDIA_UPLOAD_ENABLED",
              value: "true"
            },
            {
              name: "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET",
              value: blobBucket.id
            },
            {
              name: "LANGFUSE_S3_MEDIA_DOWNLOAD_URL_EXPIRY_SECONDS",
              value: "604800"
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
              name: "REDIS_HOST",
              value: elasticache.primaryEndpointAddress
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
              name: "TELEMETRY_ENABLED",
              value: "true"
            },
            {
              name: "LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES",
              value: "true"
            },
            {
              name: "LANGFUSE_SDK_CI_SYNC_PROCESSING_ENABLED",
              value: "false"
            },
            {
              name: "LANGFUSE_READ_FROM_POSTGRES_ONLY",
              value: "false"
            },
            {
              name: "LANGFUSE_READ_FROM_CLICKHOUSE_ONLY",
              value: "true"
            },
            {
              name: "LANGFUSE_RETURN_FROM_CLICKHOUSE",
              value: "true"
            },
            // {
            //   name: "DATABASE_URL",
            //   value: rdsResources.dbUrl
            // },
            {
              name: "CLICKHOUSE_PASSWORD",
              value: infraConfigResources.clickhousePassword
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
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-region": infraConfigResources.mainRegion,
              "awslogs-group": logGroup.name,
              "awslogs-stream-prefix": "web-server",
            },
          },
        },
      ])
    )
  }
);

const webServerService = new aws.ecs.Service(
  `${infraConfigResources.idPrefix}-web-server-ecs-service-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-web-server-ecs-service-${$app.stage}`,
    cluster: ecsClusterResources.ecsCluster.id,
    taskDefinition: webServerTaskDef.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    networkConfiguration: {
      subnets: vpcResources.webServerProtectedSubnets.map((subnet) => subnet.id),
      assignPublicIp: false,
      securityGroups: [
        securityGroupResources.webServerSecurityGroup.id
      ],
    },
    loadBalancers: [
      {
        containerName: `${infraConfigResources.idPrefix}-web-server-ecs-task-${$app.stage}`,
        containerPort: 3000,
        targetGroupArn: albResources.targetGroup.arn
      }
    ],
    enableExecuteCommand: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-web-server-ecs-service-${$app.stage}`,
    },
  }
);

export const ecsClickHouseResources = {
  webServerTaskDef,
  webServerService
};