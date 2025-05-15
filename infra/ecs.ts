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

console.log("======ecs.ts start======");

// ECS Cluster
const cluster = new sst.aws.Cluster.v1(
	`${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
	{
		vpc: {
			id: vpcResources.vpc.id,
			publicSubnets: vpcResources.albProtectedSubnets.map((subnet) => subnet.id),
			privateSubnets: vpcResources.ecsProtectedSubnets.map((subnet) => subnet.id),
			securityGroups: [
        securityGroupResources.webServerSecurityGroup.id,
        securityGroupResources.asyncWorkerSecurityGroup.id,
        securityGroupResources.clickHouseServerSecurityGroup.id
      ],
		},
		transform: {
			cluster: {
				name: `${infraConfigResources.idPrefix}-cluster-${$app.stage}`,
				settings: [
					{
							name: "containerInsights",
							value: "enhanced",
					},
				],
        serviceConnectDefaults: {
          namespace: serviceDiscoveryResources.langfuseNamespace.arn,
        },
			},
		},
	}
);

ecrResources.asyncWorkerContainerRepository.repositoryUrl.apply((url) => {
  // ECS Service
  cluster.addService(`${infraConfigResources.idPrefix}-async-worker-service-${$app.stage}`, {
      cpu: "1 vCPU",
      memory: "2 GB",
      storage: "21 GB",
      architecture: "arm64",
      scaling: {
        min: 2,
        max: 2,
        cpuUtilization: 70,
        memoryUtilization: 70,
      },
      transform: {
        image: {
          push: true,
          tags: [`${url}:latest`],
          // registries: [registryInfo],
          dockerfile: {
            location: "../../app/async-worker/Dockerfile", // Path to Dockerfile
          },
          context: {
            location: "../../app", // Path to application source code
          },
        },
        service: {
          name: `${infraConfigResources.idPrefix}-async-worker-service-${$app.stage}`,
          enableExecuteCommand: true,
          healthCheckGracePeriodSeconds: 180,
          forceNewDeployment: true,
          serviceConnectConfiguration: {
            enabled: true
          },
          networkConfiguration: {
            subnets: vpcResources.asyncWorkerProtectedSubnets.map((subnet) => subnet.id),
            assignPublicIp: false,
            securityGroups: [
              securityGroupResources.asyncWorkerSecurityGroup.id
            ],
          },
          // loadBalancers: [
          //   {
          //     containerName: `${infraConfigResources.idPrefix}-web-server-task-${$app.stage}`,
          //     containerPort: 3000,
          //     targetGroupArn: albResources.targetGroup.arn,
          //   },
          // ],
        },
        taskDefinition: {
          executionRoleArn: iamResources.taskExecutionRole.arn,
          containerDefinitions: $util.all([
            // ecrResources.asyncWorkerContainerRepository.repositoryUrl,
            cloudwatchResources.langfuseWorkerLog,
            s3Resources.langfuseEventBucket,
            s3Resources.langfuseBlobBucket,
            elasticacheResources.elasticache,
            serviceDiscoveryResources.clickhouseService.name,
            serviceDiscoveryResources.langfuseNamespace.name,
          ])
          .apply(
            ([
              // url,
              logGroup,
              eventBucket,
              blobBucket,
              elasticache,
              clickhouseServiceName,
              langfuseNamespaceName,
            ]) =>
              $jsonStringify([
              {
                name: `${infraConfigResources.idPrefix}-async-worker-task-${$app.stage}`,
                image: `${url}:latest`,
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
                    "awslogs-group": logGroup.id,
                    "awslogs-stream-prefix": "async-worker",
                  },
                },
                environment: [
                  {
                    name: "SALT",
                    value: infraConfigResources.webSalt
                  },
                  {
                    name: "ENCRIPTION_KEY",
                    value: infraConfigResources.encryptionKey
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
              },
            ]),
          )
        }
      }
    });
  });

export const fargateResources = {
  cluster
};
