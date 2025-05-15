import * as pulumi from "@pulumi/pulumi";
import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";
import { env } from "./env";
import { bastionResources } from "./bastion";

// Aurora Serverless作成
const auroraServerless = new sst.aws.Postgres.v1(
  `${infraConfigResources.idPrefix}-aurora-serverless-${$app.stage}`,
  {
    vpc: {
      privateSubnets: vpcResources.auroraServerlessPrivateSubnets.map((subnet) => subnet.id),
      securityGroups: [securityGroupResources.auroraServerlessSecurityGroup.id],
    },
    transform: {
      cluster: {
        databaseName: "langfuse",
        masterUsername: "langfuse",
        enabledCloudwatchLogsExports: ["postgresql"],
        // TODO: Databae Insights Advansedの使用を検討する
        performanceInsightsEnabled: true,
        performanceInsightsRetentionPeriod:
          env.bffRdsPerformanceInsightsRetentionInDays,
        tags: {
          Name: `${infraConfigResources.idPrefix}-aurora-serverless-cluster-${$app.stage}`,
        },
      },
      instance: {
        availabilityZone: `${env.awsMainRegion}a`,
        tags: {
          Name: `${infraConfigResources.idPrefix}-aurora-serverless-instance-${$app.stage}`,
        },
      },
    },
  }
);

// リードレプリカ作成
new aws.rds.ClusterInstance(
  `${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
  {
    clusterIdentifier: auroraServerless.clusterID,
    instanceClass: "db.serverless",
    engine: "aurora-postgresql",
    promotionTier: 1,
    availabilityZone: `${env.awsMainRegion}c`,
    identifier:`${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
    tags: {
      Name: `${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
    },
  }
);

// cluster取得
const cluster = auroraServerless.clusterID.apply((clusterID) =>
  aws.rds.getCluster({
    clusterIdentifier: clusterID,
  }),
);

// writerEndPoint取得
const writerEndPoint = cluster.apply((cluster) => cluster.endpoint);

// readerEndPoint取得
const readerEndPoint = cluster.apply((cluster) => cluster.readerEndpoint);

const userName = cluster.apply((cluster) => cluster.masterUsername);

const databaseName = cluster.apply((cluster) => cluster.databaseName);

// database nameパラメータ登録
new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-name-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/name`,
    type: aws.ssm.ParameterType.String,
    value: auroraServerless.database,
  }
);

// host名パラメータ登録
new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-host-name-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/host/name`,
    type: aws.ssm.ParameterType.String,
    value: cluster.apply((cluster) => cluster.endpoint),
  }
);

// SecretArn パラメータストア登録
new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-secret-arn-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/secret/arn`,
    type: aws.ssm.ParameterType.String,
    value: auroraServerless.secretArn,
  }
);

const dbUrlSecret = new aws.secretsmanager.Secret(
  `${infraConfigResources.idPrefix}-database-url-v7-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-database-url-v7-${$app.stage}`,
  }
);

const dbUrl = pulumi.all([
  userName,
  auroraServerless.password,
  writerEndPoint,
  databaseName,
]).apply(([user, password, host, db]) => {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${db}`;
});

dbUrl.apply((url) => {
console.log("===url====")
console.log(url)
console.log("===url====")
})

const databaseUrlSecretVersion = new aws.secretsmanager.SecretVersion(
  `${infraConfigResources.idPrefix}-database-url-secret-${$app.stage}`,
  {
    secretId: dbUrlSecret.id,
    secretString: dbUrl,
  }
);

// export
export const rdsResources = {
  auroraServerless,
  cluster,
  writerEndPoint,
  readerEndPoint,
  dbUrlSecret,
  dbUrl,
  databaseUrlSecretVersion
};
