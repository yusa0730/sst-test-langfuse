import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { infraConfigResources } from "./infra-config";
import { rdsVpcResources } from "./rds-vpc";
import { securityGroupResources } from "./security-group";
import { env } from "./env";

const masterUsername = "langfuse";
const masterPassword = new random.RandomPassword(
  `${infraConfigResources.idPrefix}-aurora-master-password-v1-${$app.stage}`,
  {
    length: 20,
    special: false,
  }
).result;

const databasePassword = new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-password-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/password`,
    type: "SecureString",
    value: masterPassword,
    overwrite : true,
  }
);

// DB Cluster Parameter Group 作成
const clusterParameterGroup = new aws.rds.ClusterParameterGroup(
  `${infraConfigResources.idPrefix}-cluster-parameter-group-${$app.stage}`,
  {
    family: "aurora-postgresql16",
    description: `${infraConfigResources.idPrefix}-cluster-parameter-group-${$app.stage}`,
  }
);

// DB Parameter Group 作成（インスタンス用）
const instanceParameterGroup = new aws.rds.ParameterGroup(
  `${infraConfigResources.idPrefix}-instance-parameter-group-${$app.stage}`,
  {
    family: "aurora-postgresql16",
    description: `${infraConfigResources.idPrefix}-instance-parameter-group-${$app.stage}`,
  }
);

const subnetGroup = new aws.rds.SubnetGroup(
  `${infraConfigResources.idPrefix}-aurora-cluster-subnet-group-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-aurora-cluster-subnet-group-${$app.stage}`,
    subnetIds: rdsVpcResources.rdsVpcPrivateSubnets.map((subnet) => {
      return subnet.id
    }),
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-cluster-subnet-group-${$app.stage}`,
    },
  }
);

const cluster = new aws.rds.Cluster(
  `${infraConfigResources.idPrefix}-aurora-serverless-cluster-${$app.stage}`,
  {
    clusterIdentifier: `${infraConfigResources.idPrefix}-aurora-serverless-cluster-${$app.stage}`,
    engine: aws.rds.EngineType.AuroraPostgresql,
    engineMode: aws.rds.EngineMode.Provisioned,
    engineVersion: "16.6",
    databaseName: "langfuse",
    masterUsername: masterUsername,
    masterPassword: masterPassword,
    availabilityZones: [
      `${env.awsMainRegion}a`,
      `${env.awsMainRegion}c`,
      // `${env.awsMainRegion}d`,
    ],
    dbClusterParameterGroupName: clusterParameterGroup.name,
    dbSubnetGroupName: subnetGroup.name,
    port: 5432,
    enabledCloudwatchLogsExports: ["postgresql"],
    storageEncrypted: true,
    performanceInsightsEnabled: true,
    performanceInsightsRetentionPeriod:
      env.bffRdsPerformanceInsightsRetentionInDays,
    backupRetentionPeriod: 7,
    preferredBackupWindow: "07:00-09:00",
    skipFinalSnapshot: true,
    // skip_final_snapshot: false,
    // copyTagsToSnapshot: true,
    // deletionProtection: true,
    serverlessv2ScalingConfiguration: {
      maxCapacity: 1,
      minCapacity: 0,
      secondsUntilAutoPause: 3600,
    },
    vpcSecurityGroupIds: [
      securityGroupResources.auroraServerlessSecurityGroup.id
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-serverless-cluster-${$app.stage}`,
    },
  }
);

const writerClusterInstance1a = new aws.rds.ClusterInstance(
  `${infraConfigResources.idPrefix}-aurora-serverless-writer-instance-1a-${$app.stage}`,
  {
    clusterIdentifier: cluster.id,
    instanceClass: "db.serverless",
    dbParameterGroupName: instanceParameterGroup.name,
    engine: "aurora-postgresql",
    engineVersion: cluster.engineVersion,
    availabilityZone: `${env.awsMainRegion}a`,
    publiclyAccessible: false,
    applyImmediately: true,
    // autoMinorVersionUpgrade: true
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-serverless-writer-instance-1a-${$app.stage}`,
    }
  }
);

const readReplica1c = new aws.rds.ClusterInstance(
  `${infraConfigResources.idPrefix}-aurora-serverless-read-replica-1c-${$app.stage}`,
  {
    clusterIdentifier: cluster.id,
    instanceClass: "db.serverless",
    dbParameterGroupName: instanceParameterGroup.name,
    engine: "aurora-postgresql",
    engineVersion: cluster.engineVersion,
    availabilityZone: `${env.awsMainRegion}c`,
    publiclyAccessible: false,
    applyImmediately: true,
    promotionTier: 1,
    // autoMinorVersionUpgrade: true,
    tags: {
      Name: `${infraConfigResources.idPrefix}-aurora-serverless-read-replica-1c-${$app.stage}`,
    }
  }
);

// writerEndPoint取得
const writerEndPoint = cluster.endpoint;

// readerEndPoint取得
const readerEndPoint = cluster.readerEndpoint;

const userName = cluster.masterUsername;

const databaseName = cluster.databaseName;

// database nameパラメータ登録
new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-name-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/name`,
    type: aws.ssm.ParameterType.String,
    value: cluster.databaseName,
  }
);

// host名パラメータ登録
new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-host-name-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/host/name`,
    type: aws.ssm.ParameterType.String,
    value: cluster.endpoint.apply(ep => ep.split(":"))[0],
  }
);

const dbUrl = pulumi.all([
  userName,
  masterPassword,
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

const databaseUrlSecret = new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-url-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/url`,
    type: "SecureString",
    value: dbUrl.apply((url) => url),
    overwrite : true,
  }
);

// export
export const rdsResources = {
  cluster,
  writerEndPoint,
  readerEndPoint,
  dbUrl,
  databaseUrlSecret
};
