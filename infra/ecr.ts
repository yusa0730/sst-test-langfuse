import { infraConfigResources } from "./infra-config";

console.log("======ecr.ts start======");

const webServerContainerRepository = new aws.ecr.Repository(
  `${infraConfigResources.idPrefix}-web-server-ecr-repository-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-web-server-ecr-repository-${$app.stage}`,
    forceDelete: true,
    imageScanningConfiguration: {
      scanOnPush: true
    },
    imageTagMutability: "MUTABLE",
  }
);

new aws.ecr.LifecyclePolicy(
  `${infraConfigResources.idPrefix}-web-server-lifecycle-policy-${$app.stage}`,
  {
    repository: webServerContainerRepository.name,
    policy: $jsonStringify({
      rules: [
        {
          rulePriority: 1,
          description: "Keep 14 days",
          selection: {
            tagStatus: "untagged",
            countType: "sinceImagePushed",
            countUnit: "days",
            countNumber: 14,
          },
          action: {
            type: "expire",
          },
        },
      ],
    }),
  }
);

const asyncWorkerContainerRepository = new aws.ecr.Repository(
  `${infraConfigResources.idPrefix}-async-worker-ecr-repository-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-async-worker-ecr-repository-${$app.stage}`,
    forceDelete: true,
    imageScanningConfiguration: {
      scanOnPush: true
    },
    imageTagMutability: "MUTABLE",
  }
);

new aws.ecr.LifecyclePolicy(
  `${infraConfigResources.idPrefix}-async-worker-lifecycle-policy-${$app.stage}`,
  {
    repository: asyncWorkerContainerRepository.name,
    policy: $jsonStringify({
      rules: [
        {
          rulePriority: 1,
          description: "Keep 14 days",
          selection: {
            tagStatus: "untagged",
            countType: "sinceImagePushed",
            countUnit: "days",
            countNumber: 14,
          },
          action: {
            type: "expire",
          },
        },
      ],
    }),
  }
);

const clickHouseContainerRepository = new aws.ecr.Repository(
  `${infraConfigResources.idPrefix}-clickhouse-ecr-repository-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-clickhouse-ecr-repository-${$app.stage}`,
    forceDelete: true,
    imageScanningConfiguration: {
      scanOnPush: true
    },
    imageTagMutability: "MUTABLE",
  }
);

new aws.ecr.LifecyclePolicy(
  `${infraConfigResources.idPrefix}-clickhouse-lifecycle-policy-${$app.stage}`,
  {
    repository: asyncWorkerContainerRepository.name,
    policy: $jsonStringify({
      rules: [
        {
          rulePriority: 1,
          description: "Keep 14 days",
          selection: {
            tagStatus: "untagged",
            countType: "sinceImagePushed",
            countUnit: "days",
            countNumber: 14,
          },
          action: {
            type: "expire",
          },
        },
      ],
    }),
  }
);

export const ecrResources = {
  webServerContainerRepository,
  asyncWorkerContainerRepository,
  clickHouseContainerRepository
};