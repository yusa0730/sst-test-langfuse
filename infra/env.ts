const ENV = {
  production: {
    bffRdsPerformanceInsightsRetentionInDays: 7,
    awsMainRegion: "ap-northeast-1"
  },
} as const;

export const ENV_KEYS = Object.keys(ENV);

// 環境変数はこの変数から利用する
export const env: (typeof ENV)[keyof typeof ENV] =
  ENV[`${$app.stage}` as keyof typeof ENV];