const ENV = {
  production: {
    bffRdsPerformanceInsightsRetentionInDays: 7,
    awsMainRegion: "ap-northeast-1",
    vpcCidrBlock: "10.0.0.0/16",
    rdsVpcFlowLogRetentionInDays: 30,
    rdsVpcCidrBlock: "172.16.0.0/16"
  },
} as const;

export const ENV_KEYS = Object.keys(ENV);

// 環境変数はこの変数から利用する
export const env: (typeof ENV)[keyof typeof ENV] =
  ENV[`${$app.stage}` as keyof typeof ENV];