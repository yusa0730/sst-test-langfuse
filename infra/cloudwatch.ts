import { infraConfigResources } from "./infra-config";

console.log("======cloudwatch.ts start======");

const vpcFlowLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-flow-log-${$app.stage}`,
  {
    name: `/vpc/${infraConfigResources.idPrefix}-flow-log-${$app.stage}`,
    retentionInDays: 7
  },
  {
    retainOnDelete: true,
  }
);

// Fargate用ロググループ
const langfuseWebServerLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-web-server-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/web-server/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-web-server-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

const langfuseWorkerLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-async-worker-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/worker/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-async-worker-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

const langfuseClickHouseLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-clickhouse-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/clickhouse/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

const langfuseCacheEngineLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-cache-engine-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/cache/engine/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-cache-engine-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

const langfuseCacheSlowLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-cache-slow-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/cache/slow/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-cache-slow-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

const ecsExecuteCommandLog = new aws.cloudwatch.LogGroup(
  `${infraConfigResources.idPrefix}-ecs-execute-command-log-${$app.stage}`,
  {
    name: `/aws/ecs/langfuse/execute-command/${$app.stage}`,
    retentionInDays: 7,
    tags: {
      Name: `${infraConfigResources.idPrefix}-ecs-execute-command-log-${$app.stage}`,
    }
  },
  {
    retainOnDelete: true,
  }
);

export const cloudwatchResources = {
  vpcFlowLog,
  langfuseWebServerLog,
  langfuseWorkerLog,
  langfuseClickHouseLog,
  langfuseCacheSlowLog,
  langfuseCacheEngineLog,
  ecsExecuteCommandLog
};