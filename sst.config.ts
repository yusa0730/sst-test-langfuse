/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "sst-test-presigned-url",
      home: "aws",
    };
  },
  async run() {
    await import('./infra/infra-config');
    await import('./infra/iam');
    await import('./infra/cloudwatch');
    await import('./infra/vpc');
    await import('./infra/bastion');
    await import('./infra/security-group');
    await import('./infra/acm');
    // await import('./infra/waf');
    await import('./infra/s3');
    // await import('./infra/guardduty');
    // await import('./infra/lambda');
    await import('./infra/alb');
    await import('./infra/service-discovery');
    await import('./infra/iam');
    await import('./infra/elasticache');
    await import('./infra/aurora');
    await import('./infra/efs');
    await import('./infra/ecs-cluster');
    await import('./infra/ecr');
    await import('./infra/ecs-clickhouse');
    await import('./infra/ecs-async-worker');
    await import('./infra/ecs-web');
    // await import('./infra/cloudfront');
  }
});
