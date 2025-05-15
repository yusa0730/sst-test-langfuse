import * as random from "@pulumi/random";

console.log("======infra-config.ts start======");

const idPrefix = "sst-test-langfuse";
const mainRegion = "ap-northeast-1";
const domainName = "ishizawa-test.xyz";
const hostedZone = await aws.route53.getZone({
  name: `${domainName}.`,
});

// 北部バージニアプロバイダ
const awsUsEast1Provider = new aws.Provider(
  `${idPrefix}-aws-provider-${$app.stage}`,
  {
    region: "us-east-1",
  },
);

const awsAccountId = await aws.ssm.getParameter({
  name: "ACCOUNT_ID", // 取得したいパラメータ名
  withDecryption: true, // 暗号化されている場合は復号化
}).then(param => param.value);

console.log("====awsAccountId====", awsAccountId);

// Generate random password for ClickHouse
const clickhousePassword = new random.RandomPassword(
  `${idPrefix}-clickhouse-password-${$app.stage}`,
  {
    length: 16,
    special: true,
    overrideSpecial: "_!%^"
  }
).result;

// Store password in Secrets Manager
const clickhousePasswordSecret = new aws.secretsmanager.Secret(
  `${idPrefix}-clickhouse-password-secret-${$app.stage}`,
  {
    namePrefix: `clickhouse_password_${$app.stage}`
  }
);

const clickhousePasswordSecretVersion = new aws.secretsmanager.SecretVersion(
  `${idPrefix}-clickhouse-password-secret-version-${$app.stage}`,
  {
    secretId: clickhousePasswordSecret.id,
    secretString: clickhousePassword
  }
);

// ランダム生成：base64（openssl rand -base64 32 相当）
const webSalt = new random.RandomPassword(
  `${idPrefix}-web-salt-${$app.stage}`,
  {
    length: 32,
    overrideSpecial: "_!%^",
    special: true,
  }
).result;

// ランダム生成：256-bit HEX (openssl rand -hex 32 相当)
const encryptionKey = new random.RandomString(
  `${idPrefix}-encryption-key-${$app.stage}`,
  {
    length: 64,
    upper: false,
    special: false,
    number: true,
  }
).result;

// ランダムなBase64形式のシークレットを生成
const webNextSecret = new random.RandomPassword(
  `${idPrefix}-web-next-secret-${$app.stage}`,
  {
    length: 32,
    overrideSpecial: "_%@",
    special: true,
  }
).result;

const redisPasswordValue = new random.RandomPassword(
  `${idPrefix}-redis-auth-token-value-${$app.stage}`,
  {
    length: 44,
    special: true,
    overrideSpecial: "!&#$^<>-", // ✅ ElastiCache AUTH で許可されている記号のみ
    upper: true,
    lower: true,
    number: true,
  }
).result;

export const infraConfigResources = {
  idPrefix,
  mainRegion,
  domainName,
  hostedZone,
  awsUsEast1Provider,
  awsAccountId,
  clickhousePassword,
  webSalt,
  encryptionKey,
  webNextSecret,
  redisPasswordValue
};