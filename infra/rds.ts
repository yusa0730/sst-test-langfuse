import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { infraConfigResources } from "./infra-config";
import { rdsVpcResources } from "./rds-vpc";
import { securityGroupResources } from "./security-group";
import { env } from "./env";

const masterUsername = "langfuse";
const masterPassword = new random.RandomPassword(
  `${infraConfigResources.idPrefix}-aurora-master-password-${$app.stage}`,
  {
    length: 20,
    special: false,
  }
).result;

// const masterSecret = new aws.secretsmanager.Secret(
//   `${infraConfigResources.idPrefix}-aurora-master-secret-v2-${$app.stage}`,
//   {
//     name: `${infraConfigResources.idPrefix}-aurora-master-secret-v2-${$app.stage}`,
//     description: `${infraConfigResources.idPrefix}-aurora-master-secret-${$app.stage}`,
//   }
// );

// new aws.secretsmanager.SecretVersion(
//   `${infraConfigResources.idPrefix}-aurora-master-secret-ver-${$app.stage}`,
//   {
//     secretId: masterSecret.id,
//     secretString: $interpolate`{"username":"${masterUsername}","password":"${masterPassword.result}"}`,
//   }
// );

const databasePassword = new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-password-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/password`,
    type: "SecureString",
    value: masterPassword,
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


// // Aurora Serverless作成
// const auroraServerless = new sst.aws.Postgres.v1(
//   `${infraConfigResources.idPrefix}-aurora-serverless-${$app.stage}`,
//   {
//     vpc: {
//       privateSubnets: rdsVpcResources.rdsVpcPrivateSubnets.map((subnet) => subnet.id),
//       securityGroups: [securityGroupResources.auroraServerlessSecurityGroup.id],
//     },
//     transform: {
//       cluster: {
//         databaseName: "langfuse",
//         masterUsername: "langfuse",
//         enabledCloudwatchLogsExports: ["postgresql"],
//          // storage_encrypted: true,
//         // TODO: Databae Insights Advansedの使用を検討する
//         performanceInsightsEnabled: true,
//         performanceInsightsRetentionPeriod:
//           env.bffRdsPerformanceInsightsRetentionInDays,
//         tags: {
//           Name: `${infraConfigResources.idPrefix}-aurora-serverless-cluster-${$app.stage}`,
//         },
//       },
//       instance: {
//         availabilityZone: `${env.awsMainRegion}a`,
//         tags: {
//           Name: `${infraConfigResources.idPrefix}-aurora-serverless-instance-${$app.stage}`,
//         },
//       },
//     },
//   }
// );

// // リードレプリカ作成
// new aws.rds.ClusterInstance(
//   `${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
//   {
//     clusterIdentifier: auroraServerless.clusterID,
//     instanceClass: "db.serverless",
//     engine: "aurora-postgresql",
//     promotionTier: 1,
//     availabilityZone: `${env.awsMainRegion}c`,
//     identifier:`${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-instance-read-replica-${$app.stage}`,
//     },
//   }
// );

// cluster取得
// const cluster = auroraServerless.clusterID.apply((clusterID) =>
//   aws.rds.getCluster({
//     clusterIdentifier: clusterID,
//   }),
// );

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

// SecretArn パラメータストア登録
// new aws.ssm.Parameter(
//   `${infraConfigResources.idPrefix}-secret-arn-${$app.stage}`,
//   {
//     name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/secret/arn`,
//     type: aws.ssm.ParameterType.String,
//     value: masterSecret.arn,
//   }
// );

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

// const dbUrlSecret = new aws.secretsmanager.Secret(
//   `${infraConfigResources.idPrefix}-database-url-v12-${$app.stage}`,
//   {
//     name: `${infraConfigResources.idPrefix}-database-url-v12-${$app.stage}`,
//   }
// );

// const databaseUrlSecretVersion = new aws.secretsmanager.SecretVersion(
//   `${infraConfigResources.idPrefix}-database-url-secret-${$app.stage}`,
//   {
//     secretId: dbUrlSecret.id,
//     secretString: dbUrl.apply((url) => JSON.stringify({ db_url: url })),
//   }
// );

const databaseUrlSecret = new aws.ssm.Parameter(
  `${infraConfigResources.idPrefix}-database-url-${$app.stage}`,
  {
    name: `/${infraConfigResources.idPrefix}/langfuse/${$app.stage}/rds/database/url`,
    type: "SecureString",
    value: dbUrl.apply((url) => url),
  }
);

// export
export const rdsResources = {
  cluster,
  writerEndPoint,
  readerEndPoint,
  // dbUrlSecret,
  dbUrl,
  // databaseUrlSecretVersion,
  databaseUrlSecret
};
