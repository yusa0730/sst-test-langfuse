import { infraConfigResources } from "./infra-config";
import { iamResources } from "./iam";

// Lambda@edgeの関数
// const basicAuthLambdaEdge = new sst.aws.Function(
//   `${infraConfigResources.idPrefix}-cdn-basic-auth-lambda-edge-${$app.stage}`,
//   {
//     handler: "functions/handler.handler",
//     name: `${infraConfigResources.idPrefix}-cdn-basic-auth-lambda-edge-${$app.stage}`,
//     runtime: "nodejs20.x",
//     memory: "128 MB",
//     timeout: "5 seconds",
//     versioning: true,
//     role: iamResources.edgeFunctionRole.arn,
//     transform: {
//       function: {
//         environment: undefined,
//       },
//     },
//   },
//   {
//     provider: infraConfigResources.awsUsEast1Provider,
//   },
// );

const testLambda = new sst.aws.Function(
  `${infraConfigResources.idPrefix}-cdn-test-lambda-${$app.stage}`,
  {
    handler: "functions/test.handler",
    name: `${infraConfigResources.idPrefix}-test-lambda-${$app.stage}`,
    runtime: "nodejs20.x",
    memory: "128 MB",
    timeout: "5 seconds",
    versioning: false,
    environment: {
      PRIVATE_KEY: $resolve(infraConfigResources.privateKey.value).apply(value => value)
    }
  }
);

export const lambdaResources = {
  // basicAuthLambdaEdge,
  testLambda
};