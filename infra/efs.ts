// import { infraConfigResources } from "./infra-config";
// import { vpcResources } from "./vpc";
// import { securityGroupResources } from "./security-group";

// // EFS FileSystem
// const efsFileSystem = new aws.efs.FileSystem(
//   `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
//   {
//     creationToken: "clickhouse-data",
//     performanceMode: "generalPurpose",
//     encrypted: true,
//     lifecyclePolicies: [{
//       transitionToIa: "AFTER_30_DAYS",
//     }],
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
//     },
//   }
// );

// // Mount Target (各AZのPrivate Subnetに作成)
// vpcResources.clickHousePrivateSubnets.forEach((subnet, index) => {
//   new aws.efs.MountTarget(
//     `${infraConfigResources.idPrefix}-efs-mount-${index}-${$app.stage}`,
//       {
//         fileSystemId: efsFileSystem.id,
//         subnetId: subnet.id,
//         securityGroups: [securityGroupResources.efsSecurityGroup.id],
//       }
//   );
// });

// // Resource Policy (ClientMount制限)
// new aws.efs.FileSystemPolicy(
//   `${infraConfigResources.idPrefix}-efs-policy-${$app.stage}`,
//   {
//     fileSystemId: efsFileSystem.id,
//     policy: JSON.stringify({
//       Version: "2012-10-17",
//       Statement: [
//         {
//           Effect: "Allow",
//           Action: ["elasticfilesystem:ClientMount"],
//           Principal: "*",
//           Condition: {
//             Bool: {
//               "elasticfilesystem:AccessedViaMountTarget": "true",
//             },
//           },
//         },
//       ],
//     }),
//   }
// );

// // ✅ Access Point（UID/GID 101:101 で初期化）
// const clickhouseAccessPoint = new aws.efs.AccessPoint(
//   `${infraConfigResources.idPrefix}-efs-access-point-${$app.stage}`,
//   {
//     fileSystemId: efsFileSystem.id,
//     posixUser: {
//       gid: 101,
//       uid: 101,
//     },
//     rootDirectory: {
//       path: "/clickhouse", // これは成功する
//       // path: "/var/lib/clickhouse",
//       // path: "/",
//       creationInfo: {
//         ownerGid: 101,
//         ownerUid: 101,
//         permissions: "755",
//       },
//     },
//     tags: {
//       Name: `${infraConfigResources.idPrefix}-efs-access-point-${$app.stage}`,
//     },
//   }
// );

// export const efsResources = {
//   efsFileSystem,
//   clickhouseAccessPoint
// };


import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";

// EFS FileSystem
const efsFileSystem = new aws.efs.FileSystem(
  `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
  {
    // creationToken: "clickhouse-data",
    performanceMode: "generalPurpose",
    encrypted: true,
    lifecyclePolicies: [{
      transitionToIa: "AFTER_30_DAYS",
    }],
    tags: {
      Name: `${infraConfigResources.idPrefix}-efs-filesystem-${$app.stage}`,
    },
  }
);

// Mount Target (各AZのPrivate Subnetに作成)
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

// Resource Policy (ClientMount制限)
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

// ✅ Access Point（UID/GID 101:101 で初期化）
const clickhouseDataAccessPoint = new aws.efs.AccessPoint(
  `${infraConfigResources.idPrefix}-data-efs-access-point-${$app.stage}`,
  {
    fileSystemId: efsFileSystem.id,
    posixUser: {
      gid: 101,
      uid: 101,
    },
    rootDirectory: {
      path: "/clickhouse-data", // これは成功する
      // path: "/var/lib/clickhouse",
      // path: "/",
      creationInfo: {
        ownerGid: 101,
        ownerUid: 101,
        permissions: "750",
      },
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-data-efs-access-point-${$app.stage}`,
    },
  }
);

const clickhouseLogAccessPoint = new aws.efs.AccessPoint(
  `${infraConfigResources.idPrefix}-log-efs-access-point-${$app.stage}`,
  {
    fileSystemId: efsFileSystem.id,
    posixUser: {
      gid: 101,
      uid: 101,
    },
    rootDirectory: {
      path: "/clickhouse-log", // これは成功する
      // path: "/var/lib/clickhouse",
      // path: "/",
      creationInfo: {
        ownerGid: 101,
        ownerUid: 101,
        permissions: "750",
      },
    },
    tags: {
      Name: `${infraConfigResources.idPrefix}-log-efs-access-point-${$app.stage}`,
    },
  }
);

export const efsResources = {
  efsFileSystem,
  clickhouseDataAccessPoint,
  clickhouseLogAccessPoint
};