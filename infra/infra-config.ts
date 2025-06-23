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
  `${idPrefix}-clickhouse-password-v1-${$app.stage}`,
  {
    length: 16,
    special: false,
  }
).result;

const clickhousePasswordParam = new aws.ssm.Parameter(
  `${idPrefix}-clickhouse-password-param-${$app.stage}`,
  {
    name: `/${idPrefix}/langfuse/${$app.stage}/clickhouse/password`,
    type: "SecureString",
    value: clickhousePassword,
    overwrite : true,
  }
);

// ランダム生成：base64（openssl rand -base64 32 相当）
const webSaltBytes = new random.RandomBytes(
  `${idPrefix}-web-salt-v1-${$app.stage}`,
  {
    length: 32,
  }
);

// 2) base64 文字列 (44 文字, パディング '=' 1 個付き) を取得
const webSalt = webSaltBytes.base64;

webSalt.apply((salt) => {
  console.log("======webSalt======");
  console.log(salt);
  console.log("======webSalt======");
});

const webSaltParam = new aws.ssm.Parameter(
  `${idPrefix}-web-salt-param-${$app.stage}`,
  {
    name: `/${idPrefix}/langfuse/${$app.stage}/web/salt`,
    type: "SecureString",
    value: webSalt,
    overwrite : true,
  }
);

// openssl rand -hex 32
const encryptionKeyBytes = new random.RandomBytes(
  `${idPrefix}-encryption-key-v1-${$app.stage}`,
  {
    length: 32
  }
);

const encryptionKey = encryptionKeyBytes.hex;

encryptionKey.apply((hex) => {
  console.log("======encryptionKeyHex======");
  console.log(hex);
  console.log("======encryptionKeyHex======");
})

const encryptionKeyParam = new aws.ssm.Parameter(
  `${idPrefix}-encryption-key-param-${$app.stage}`,
  {
    name: `/${idPrefix}/langfuse/${$app.stage}/web/encryption`,
    type: "SecureString",
    value: encryptionKey,
    overwrite : true,
  }
);

// 1) 32 byte の乱数を生成
const webNextSecretBytes = new random.RandomBytes(
  `${idPrefix}-web-next-secret-bytes-${$app.stage}`,
  {
    length: 32,
  }
);

// 2) base64 文字列 (44 文字, パディング '=' 1 個付き) を取得
const webNextSecret = webNextSecretBytes.base64;

webNextSecret.apply((secret) => {
  console.log("======webNextSecret======");
  console.log(secret);
  console.log("======webNextSecret======");
});

const webNextSecretParam = new aws.ssm.Parameter(
  `${idPrefix}-web-next-secret-param-${$app.stage}`,
  {
    name: `/${idPrefix}/langfuse/${$app.stage}/web/next/secret`,
    type: "SecureString",
    value: webNextSecret,
    overwrite : true,
  }
);

const redisPasswordValue = new random.RandomPassword(
  `${idPrefix}-redis-auth-token-value-v1-${$app.stage}`,
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
  redisPasswordValue,
  clickhousePasswordParam,
  webSaltParam,
  encryptionKeyParam,
  webNextSecretParam
};