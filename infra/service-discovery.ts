import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";

// 1. Service Discovery Private DNS Namespace
const langfuseNamespace = new aws.servicediscovery.PrivateDnsNamespace(
  `${infraConfigResources.idPrefix}-langfuse-namespace-${$app.stage}`,
  {
    name: "langfuse.local",
    description: "Langfuse Service Discovery namespace",
    vpc: vpcResources.vpc.id,
    
    tags: {
      Name: `${infraConfigResources.idPrefix}-langfuse-namespace-${$app.stage}`,
    },
  }
);

// Helper to create a service discovery service
const createDiscoveryService = (name: string, displayName: string) => {
  return new aws.servicediscovery.Service(
    `${infraConfigResources.idPrefix}-${displayName}-service-${$app.stage}`,
    {
      name,
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
        Name: `${infraConfigResources.idPrefix}-${displayName}-service-${$app.stage}`,
      },
    }
  );
}

// ClickHouse Server #1: clickhouse-1.langfuse.local
const clickhouse1Service = createDiscoveryService("clickhouse-1", "clickhouse-1");

// ClickHouse Server #2: clickhouse-2.langfuse.local
const clickhouse2Service = createDiscoveryService("clickhouse-2", "clickhouse-2");

// ClickHouse Keeper #1: clickhouse-keeper-1.langfuse.local
const clickhouseKeeper1Service = createDiscoveryService("clickhouse-keeper-1", "clickhouse-keeper-1");

// ClickHouse Keeper #2: clickhouse-keeper-2.langfuse.local
const clickhouseKeeper2Service = createDiscoveryService("clickhouse-keeper-2", "clickhouse-keeper-2");

// ClickHouse Keeper #3: clickhouse-keeper-3.langfuse.local
const clickhouseKeeper3Service = createDiscoveryService("clickhouse-keeper-3", "clickhouse-keeper-3");

export const serviceDiscoveryResources = {
  langfuseNamespace,
  clickhouse1Service,
  clickhouse2Service,
  clickhouseKeeper1Service,
  clickhouseKeeper2Service,
  clickhouseKeeper3Service,
};
