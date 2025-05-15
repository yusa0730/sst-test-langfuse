import { infraConfigResources } from "./infra-config";

console.log("======iam.ts start======");
const vpcFlowLogRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-flow-log-role-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-flow-log-iar-${$app.stage}`,
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Principal: {
            Service: "vpc-flow-logs.amazonaws.com",
          },
        },
      ],
    }),
    inlinePolicies: [
      {
        name: `${infraConfigResources.idPrefix}-flow-log-iap-${$app.stage}`,
        policy: $jsonStringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
              ],
              Resource: ["*"],
            }
          ],
        }),
      },
    ],
  },
);

// タスク実行ロール
const taskExecutionRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-task-execution-role-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-task-execution-role-${$app.stage}`,
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "ecs-tasks.amazonaws.com",
          },
        },
      ],
    }),
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    ],
    tags: {
      Name: `${infraConfigResources.idPrefix}-task-execution-role-${$app.stage}`,
    },
  },
);

// Lambda@edgeのIAM Role
const edgeFunctionRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-basic-lambda-iar-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-auth-lambda-edge-iar-${$app.stage}`,
    managedPolicyArns: [
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    ],
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "lambda.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
        {
          Effect: "Allow",
          Principal: {
            Service: "edgelambda.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  },
  {
    provider: infraConfigResources.awsUsEast1Provider,
  },
);


const langfuseEcsTaskExecuteRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-ecs-task-execute-iar-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-ecs-task-execute-iar-${$app.stage}`,
    assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
      statements: [{
        actions: ["sts:AssumeRole"],
        principals: [{
          type: "Service",
          identifiers: ["ecs-tasks.amazonaws.com"],
        }],
      }],
    }).json,
    inlinePolicies: [{
      name: `${infraConfigResources.idPrefix}-ecs-task-execute-iap-${$app.stage}`,
      policy: aws.iam.getPolicyDocumentOutput({
        statements: [{
          actions: [
            "secretsmanager:*",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            // "ssmmessages:CreateControlChannel",
            // "ssmmessages:CreateDataChannel",
            // "ssmmessages:OpenControlChannel",
            // "ssmmessages:OpenDataChannel",
            // "ssm:UpdateInstanceInformation",
            // "ec2messages:*",
            // "ssm:StartSession",
            // "ssm:DescribeSessions",
            // "ssm:TerminateSession",
            // "ssm:GetConnectionStatus",
            // "ecs:ExecuteCommand",
            // "logs:*"
          ],
          resources: ["*"],
          effect: "Allow",
        }],
      }).json,
    }],
    tags: {
      Name: `${infraConfigResources.idPrefix}-ecs-task-execute-iar-${$app.stage}`,
    },
  }
);

// --- ECS Task Role ---
const langfuseEcsTaskRoleAssumePolicy = aws.iam.getPolicyDocumentOutput({
  statements: [{
    actions: ["sts:AssumeRole"],
    principals: [{
      type: "Service",
      identifiers: ["ecs-tasks.amazonaws.com"],
    }],
  }],
});

const langfuseEcsTaskRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-langfuse-ecs-task-iar-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-langfuse-ecs-task-iar-${$app.stage}`,
    description: "Task Role for Langfuse",
    assumeRolePolicy: langfuseEcsTaskRoleAssumePolicy.json,
    tags: {
      Name: `${infraConfigResources.idPrefix}-langfuse-ecs-task-iar-${$app.stage}`,
    },
  }
);

const langfuseEcsTaskRolePolicy = new aws.iam.Policy(
  `${infraConfigResources.idPrefix}-langfuse-ecs-task-iap-${$app.stage}`,
  {
    name: `${infraConfigResources.idPrefix}-langfuse-ecs-task-iap-${$app.stage}`,
    description: "Task Role Policy for Langfuse",
    policy: aws.iam.getPolicyDocumentOutput({
      statements: [{
        actions: [
          "secretsmanager:*",
          "s3:*",
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess",
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ],
        effect: "Allow",
        resources: ["*"],
      }],
    }).json,
    tags: {
      Name: `${infraConfigResources.idPrefix}-langfuse-ecs-task-iap-${$app.stage}`,
    },
  }
);

new aws.iam.RolePolicyAttachment(
  `${infraConfigResources.idPrefix}-ecs-task-iar-policy-attachment-${$app.stage}`,
  {
    role: langfuseEcsTaskRole.name,
    policyArn: langfuseEcsTaskRolePolicy.arn,
  }
);

export const iamResources = {
  vpcFlowLogRole,
  taskExecutionRole,
  edgeFunctionRole,
  langfuseEcsTaskExecuteRole,
  langfuseEcsTaskRole,
};