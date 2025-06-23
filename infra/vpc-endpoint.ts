import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";
import { securityGroupResources } from "./security-group";

console.log("====== vpc-endpoint.ts start ======");

// ======Gateway=======
const s3Gateway = new aws.ec2.VpcEndpoint(
  `${infraConfigResources.idPrefix}-vpc-endpoint-s3-gateway-${$app.stage}`,
  {
    vpcId: vpcResources.vpc.id,
    serviceName: `com.amazonaws.${infraConfigResources.mainRegion}.s3`,
    privateDnsEnabled: false,
    routeTableIds: vpcResources.protectedRouteTables.map(routeTable => routeTable.id),
    vpcEndpointType: "Gateway",
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-endpoint-s3-gateway-${$app.stage}`,
    },
});

// ======Interface=======
const cloudwatchLogsInterface = new aws.ec2.VpcEndpoint(
  `${infraConfigResources.idPrefix}-vpc-endpoint-cloudwatch-logs-interface-${$app.stage}`,
  {
    vpcId: vpcResources.vpc.id,
    serviceName: `com.amazonaws.${infraConfigResources.mainRegion}.logs`,
    privateDnsEnabled: true,
    securityGroupIds: [
      securityGroupResources.vpcEndpointSecurityGroup.id
    ],
    subnetIds: vpcResources.vpcEndpointProtectedSubnets.map(subnet => subnet.id),
    vpcEndpointType: "Interface",
    tags: {
      Name: `${infraConfigResources.idPrefix}-vpc-endpoint-cloudwatch-logs-interface-${$app.stage}`,
    },
});
