import { infraConfigResources } from "./infra-config";

console.log("======alb acm.ts start======");

const albCertificate = new aws.acm.Certificate(
  `${infraConfigResources.idPrefix}-alb-acm-${$app.stage}`,
  {
    domainName: infraConfigResources.domainName,
    subjectAlternativeNames: [`*.langfuse.${infraConfigResources.domainName}`],
    validationMethod: "DNS",
    tags: {
      Name: `${infraConfigResources.idPrefix}-alb-acm-${$app.stage}`,
    }
  }
)

const records: aws.route53.Record[] = [];
albCertificate.domainValidationOptions.apply((domainValidationOptions) => {
  for (const dvo of domainValidationOptions) {
    console.log("=====dvo======", dvo);
    records.push(
      new aws.route53.Record(
        `${infraConfigResources.idPrefix}-cname-record-${dvo.domainName}-${$app.stage}`,
        {
          allowOverwrite: true,
          name: dvo.resourceRecordName,
          records: [dvo.resourceRecordValue],
          ttl: 60,
          type: dvo.resourceRecordType,
          zoneId: infraConfigResources.hostedZone.zoneId
        },
      ),
    );
  }
});

new aws.acm.CertificateValidation(
  `${infraConfigResources.idPrefix}-alb-certificate-validation-${$app.stage}`,
  {
    certificateArn: albCertificate.arn,
    validationRecordFqdns: records.map((record) => record.fqdn)
  }
);

const cloudfrontCertificate = new aws.acm.Certificate(
  `${infraConfigResources.idPrefix}-cloudfront-${$app.stage}`,
  {
    domainName: infraConfigResources.domainName,
    subjectAlternativeNames: [
      `langfuse.${infraConfigResources.domainName}`
    ],
    validationMethod: "DNS",
    tags: {
      Name: `${infraConfigResources.idPrefix}-${$app.stage}`,
    },
  },
  {
    provider: infraConfigResources.awsUsEast1Provider,
  },
);

// Route53にレコード追加
const cloudfrontRecord: aws.route53.Record[] = [];
cloudfrontCertificate.domainValidationOptions.apply((domainValidationOptions) => {
  for (const dvo of domainValidationOptions) {
    cloudfrontRecord.push(
      new aws.route53.Record(
        `${infraConfigResources.idPrefix}-cloudfront-cname-record-${dvo.domainName}-${$app.stage}`,
        {
          allowOverwrite: true,
          name: dvo.resourceRecordName,
          records: [dvo.resourceRecordValue],
          ttl: 60,
          type: dvo.resourceRecordType,
          zoneId: infraConfigResources.hostedZone.zoneId
        },
      ),
    );
  }
});

// ACM検証
new aws.acm.CertificateValidation(
  `${infraConfigResources.idPrefix}-validation-cloudfront-${$app.stage}`,
  {
    certificateArn: cloudfrontCertificate.arn,
    validationRecordFqdns: cloudfrontRecord.map((r) => r.fqdn),
  },
  {
    provider: infraConfigResources.awsUsEast1Provider,
  }
);

export const acmResources = {
  albCertificate,
  cloudfrontCertificate,
  records
};