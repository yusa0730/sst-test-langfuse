import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { cloudwatchResources } from "./cloudwatch";
import { iamResources } from "./iam";
import { securityGroupResources } from "./security-group";
import { albResources } from "./alb";
import { ecrResources } from "./ecr";
import { serviceDiscoveryResources } from "./service-discovery";
import { s3Resources } from "./s3";
import { elasticacheResources } from "./elasticache";
import { ecsClusterResources } from "./ecs-cluster";
import { rdsResources } from "./rds";

console.log("======ecs.ts start======");

rdsResources.databaseUrlSecret.arn.apply((arn) => {
  console.log("=======databaseUrlSecretArn=======");
  console.log(arn);
  console.log("=======databaseUrlSecretArn=======");
});

ecrResources.webServerContainerRepository.repositoryUrl.apply((url) => {
  // ECS Service
  ecsClusterResources.ecsCluster.addService(
    `${infraConfigResources.idPrefix}-web-server-ecs-service-${$app.stage}`,
    {
      cpu: "2 vCPU",
      memory: "4 GB",
      architecture: "arm64",
      scaling: {
        min: 1,
        max: 3,
        cpuUtilization: 60,
        memoryUtilization: 60,
      },
      transform: {
        image: {
          push: true,
          tags: [`${url}:latest`],
          // registries: [registryInfo],
          dockerfile: {
            location: "../../app/web-server/Dockerfile", // Path to Dockerfile
          },
          context: {
            location: "../../app", // Path to application source code
          },
        },
        service: {
          name: `${infraConfigResources.idPrefix}-web-server-ecs-service-${$app.stage}`,
          enableExecuteCommand: true,
          healthCheckGracePeriodSeconds: 180,
          forceNewDeployment: true,
          serviceConnectConfiguration: {
            enabled: true
          },
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
              targetGroupArn: albResources.targetGroup.arn,
            },
          ],
        },
        taskDefinition: {
          executionRoleArn: iamResources.langfuseEcsTaskExecuteRole.arn,
          taskRoleArn: iamResources.langfuseEcsTaskRole.arn,
          containerDefinitions: $util.all([
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
            infraConfigResources.encryptionKeyParam.arn
          ])
          .apply(
            ([
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
              encryptionKeyParamArn
            ]) =>
              $jsonStringify([
              {
                name: `${infraConfigResources.idPrefix}-web-server-ecs-task-${$app.stage}`,
                image: `${url}:latest`,
                essential: true,
                portMappings: [
                  {
                    containerPort: 3000,
                    hostPort: 3000,
                    protocol: "tcp"
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
                    value: `https://langfuse.${infraConfigResources.domainName}`
                  },
                  {
                    name: "HOSTNAME",
                    value: "0.0.0.0"
                  },
                  {
                    name: "S3_BUCKET_NAME",
                    value: blobBucketId
                  },
                  {
                    name: "LANGFUSE_S3_MEDIA_UPLOAD_ENABLED",
                    value: "true"
                  },
                  {
                    name: "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET",
                    value: blobBucketId
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
                    value: eventBucketId
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
                    value: elasticachePrimaryEndpointAddress
                  },
                  {
                    name: "REDIS_PORT",
                    value: "6379"
                  },
                  {
                    name: "REDIS_AUTH",
                    value: elasticacheAuthToken
                  },
                  {
                    name: "REDIS_TLS_ENABLED",
                    value: "true"
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
                  { name: "LANGFUSE_LOG_LEVEL", value: "trace"},
                  { name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: "http://localhost:4318"},
                  { name: "OTEL_SERVICE_NAME", value: "langfuse"},
                ],
                secrets: [
                  {
                    name: "NEXTAUTH_SECRET",
                    valueFrom: webNextSecretParamArn
                  },
                  {
                    name: "SALT",
                    valueFrom: webSaltParamArn
                  },
                  {
                    name: "ENCRIPTION_KEY",
                    valueFrom: encryptionKeyParamArn
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
          )
        }
      },
    });
  }
);