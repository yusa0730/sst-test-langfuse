import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";

// 1. Service Discovery Private DNS Namespace
const langfuseNamespace = new aws.servicediscovery.PrivateDnsNamespace(
  `${infraConfigResources.idPrefix}-langfuse-namespace-${$app.stage}`,
  {
    // name: `${infraConfigResources.idPrefix}-langfuse-namespace-${$app.stage}`,
    name: "langfuse.local",
    description: "Langfuse Service Discovery namespace",
    vpc: vpcResources.vpc.id,
    
    tags: {
      Name: `${infraConfigResources.idPrefix}-langfuse-namespace-${$app.stage}`,
    },
  }
);

// 2. Service Discovery Service (clickhouse)
const clickhouseService = new aws.servicediscovery.Service(
  `${infraConfigResources.idPrefix}-clickhouse-service-${$app.stage}`,
  {
    // name: `${infraConfigResources.idPrefix}-clickhouse-service-${$app.stage}`,
    name: "clickhouse",
    dnsConfig: {
      namespaceId: langfuseNamespace.id,
      dnsRecords: [{
        ttl: 10,
        type: "A",
      }],
    },
    healthCheckCustomConfig: {
      failureThreshold: 1,
    },

    tags: {
      Name: `${infraConfigResources.idPrefix}-clickhouse-service-${$app.stage}`,
    },
  }
);

export const serviceDiscoveryResources = {
  langfuseNamespace,
  clickhouseService
};