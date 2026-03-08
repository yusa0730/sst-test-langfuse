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
// current access points
// -----------------------------------------------------------------------------

// ClickHouse Server #1
const clickhouse1DataAccessPoint = createAccessPoint(
  "clickhouse-1-data",
  "clickhouse-1-data"
);
const clickhouse1LogAccessPoint = createAccessPoint(
  "clickhouse-1-log",
  "clickhouse-1-log"
);

// ClickHouse Server #2
const clickhouse2DataAccessPoint = createAccessPoint(
  "clickhouse-2-data",
  "clickhouse-2-data"
);
const clickhouse2LogAccessPoint = createAccessPoint(
  "clickhouse-2-log",
  "clickhouse-2-log"
);

// ClickHouse Keeper #1
const keeper1DataAccessPoint = createAccessPoint(
  "keeper-1-data",
  "clickhouse-keeper-1-data"
);

// ClickHouse Keeper #2
const keeper2DataAccessPoint = createAccessPoint(
  "keeper-2-data",
  "clickhouse-keeper-2-data"
);

// ClickHouse Keeper #3
const keeper3DataAccessPoint = createAccessPoint(
  "keeper-3-data",
  "clickhouse-keeper-3-data"
);

// -----------------------------------------------------------------------------
// v2 access points
// -----------------------------------------------------------------------------

// ClickHouse Server #1 v2
const clickhouse1DataAccessPointV2 = createAccessPoint(
  "clickhouse-1-data-v2",
  "clickhouse-1-data-v2"
);
const clickhouse1LogAccessPointV2 = createAccessPoint(
  "clickhouse-1-log-v2",
  "clickhouse-1-log-v2"
);

// ClickHouse Server #2 v2
const clickhouse2DataAccessPointV2 = createAccessPoint(
  "clickhouse-2-data-v2",
  "clickhouse-2-data-v2"
);
const clickhouse2LogAccessPointV2 = createAccessPoint(
  "clickhouse-2-log-v2",
  "clickhouse-2-log-v2"
);

// ClickHouse Keeper #1 v2
const keeper1DataAccessPointV2 = createAccessPoint(
  "keeper-1-data-v2",
  "clickhouse-keeper-1-data-v2"
);

// ClickHouse Keeper #2 v2
const keeper2DataAccessPointV2 = createAccessPoint(
  "keeper-2-data-v2",
  "clickhouse-keeper-2-data-v2"
);

// ClickHouse Keeper #3 v2
const keeper3DataAccessPointV2 = createAccessPoint(
  "keeper-3-data-v2",
  "clickhouse-keeper-3-data-v2"
);

export const efsResources = {
  efsFileSystem,

  // current
  clickhouse1DataAccessPoint,
  clickhouse1LogAccessPoint,
  clickhouse2DataAccessPoint,
  clickhouse2LogAccessPoint,
  keeper1DataAccessPoint,
  keeper2DataAccessPoint,
  keeper3DataAccessPoint,

  // v2
  clickhouse1DataAccessPointV2,
  clickhouse1LogAccessPointV2,
  clickhouse2DataAccessPointV2,
  clickhouse2LogAccessPointV2,
  keeper1DataAccessPointV2,
  keeper2DataAccessPointV2,
  keeper3DataAccessPointV2,
};