import { infraConfigResources } from "./infra-config";
import { securityGroupResources } from "./security-group";
import { vpcResources } from "./vpc";

// EFS FileSystem
const efsFileSystem = new aws.efs.FileSystem(
  `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
  {
    performanceMode: "generalPurpose",
    encrypted: true,
    throughputMode: "elastic",
    lifecyclePolicies: [
      {
        transitionToIa: "AFTER_30_DAYS",
      },
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
    },
  }
);

// Mount Target
vpcResources.clickHouseProtectedSubnets.forEach((subnet, index) => {
  new aws.efs.MountTarget(
    `${infraConfigResources.idPrefix}-efs-mount-${index}-${$app.stage}`,
    {
      fileSystemId: efsFileSystem.id,
      subnetId: subnet.id,
      securityGroups: [securityGroupResources.efsSecurityGroup.id],
    }
  );
});

// Resource Policy
new aws.efs.FileSystemPolicy(
  `${infraConfigResources.idPrefix}-efs-policy-${$app.stage}`,
  {
    fileSystemId: efsFileSystem.id,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["elasticfilesystem:ClientMount"],
          Principal: "*",
          Condition: {
            Bool: {
              "elasticfilesystem:AccessedViaMountTarget": "true",
            },
          },
        },
      ],
    }),
  }
);

// Helper
const createAccessPoint = (name: string, path: string) => {
  return new aws.efs.AccessPoint(
    `${infraConfigResources.idPrefix}-${name}-efs-access-point-${$app.stage}`,
    {
      fileSystemId: efsFileSystem.id,
      posixUser: {
        gid: 101,
        uid: 101,
      },
      rootDirectory: {
        path: `/${path}`,
        creationInfo: {
          ownerGid: 101,
          ownerUid: 101,
          permissions: "750",
        },
      },
      tags: {
        Name: `${infraConfigResources.idPrefix}-${name}-efs-access-point-${$app.stage}`,
      },
    }
  );
};

// -----------------------------------------------------------------------------
// 既存本番データ用（CH1専用）
// -----------------------------------------------------------------------------

const clickhouseDataAccessPoint = createAccessPoint(
  "data",
  "clickhouse-data"
);

const clickhouseLogAccessPoint = createAccessPoint(
  "log",
  "clickhouse-log"
);

// 既存コードとの互換用エイリアス
const clickhouse1DataAccessPoint = clickhouseDataAccessPoint;
const clickhouse1LogAccessPoint = clickhouseLogAccessPoint;

// -----------------------------------------------------------------------------
// 追加する CH2 用
// -----------------------------------------------------------------------------

const clickhouse2DataAccessPoint = createAccessPoint(
  "clickhouse-2-data",
  "clickhouse-2-data"
);

const clickhouse2LogAccessPoint = createAccessPoint(
  "clickhouse-2-log",
  "clickhouse-2-log"
);

// -----------------------------------------------------------------------------
// 追加する Keeper 用
// -----------------------------------------------------------------------------

const keeper1DataAccessPoint = createAccessPoint(
  "keeper-1-data",
  "clickhouse-keeper-1-data"
);

const keeper2DataAccessPoint = createAccessPoint(
  "keeper-2-data",
  "clickhouse-keeper-2-data"
);

const keeper3DataAccessPoint = createAccessPoint(
  "keeper-3-data",
  "clickhouse-keeper-3-data"
);

export const efsResources = {
  efsFileSystem,

  // CH1（既存本番データ）
  clickhouseDataAccessPoint,
  clickhouseLogAccessPoint,
  clickhouse1DataAccessPoint,
  clickhouse1LogAccessPoint,

  // CH2
  clickhouse2DataAccessPoint,
  clickhouse2LogAccessPoint,

  // Keeper
  keeper1DataAccessPoint,
  keeper2DataAccessPoint,
  keeper3DataAccessPoint,
};