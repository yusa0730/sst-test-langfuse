import { infraConfigResources } from "./infra-config";
import { vpcResources } from "./vpc";

// 1. IAM Role for SSM
const bastionRole = new aws.iam.Role(
  `${infraConfigResources.idPrefix}-bastion-iar-${$app.stage}`,
  {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(
      { Service: "ec2.amazonaws.com" }
    ),
  }
);

new aws.iam.RolePolicyAttachment(
  `${infraConfigResources.idPrefix}-bastion-ssm-attachment-${$app.stage}`,
  {
    role: bastionRole.name,
    policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  }
);

const ecsExecPolicy = new aws.iam.Policy(
  `${infraConfigResources.idPrefix}-ecs-exec-iap-${$app.stage}`,
  {
    description: "Allow ECS Exec commands",
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "ecs:ExecuteCommand",
            "ssm:StartSession",
            "ssm:DescribeSessions",
            "ssm:TerminateSession",
            "ssm:GetConnectionStatus",
            "logs:*",
          ],
          Resource: "*"
        }
      ]
    })
  }
);

new aws.iam.RolePolicyAttachment("attach-ecs-exec-policy", {
  role: bastionRole.name,
  policyArn: ecsExecPolicy.arn,
});

// 2. IAM Instance Profile
const bastionInstanceProfile = new aws.iam.InstanceProfile(
  `${infraConfigResources.idPrefix}-bastion-instance-profile-${$app.stage}`,
  {
    role: bastionRole.name,
  }
);

// 3. Security Group (SSH port is optional if using only SSM)
const bastionSecurityGroup = new aws.ec2.SecurityGroup(
  `${infraConfigResources.idPrefix}-bastion-sg-${$app.stage}`,
  {
    description: "Security group for Bastion host",
    vpcId: vpcResources.vpc.id,
    ingress: [],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
  }
);

// 4. AMI ID（Amazon Linux 2023）
const ami = aws.ec2.getAmi({
  mostRecent: true,
  owners: ["amazon"],
  filters: [
    { name: "name", values: ["al2023-ami-*-x86_64"] },
    { name: "architecture", values: ["x86_64"] },
    { name: "virtualization-type", values: ["hvm"] },
  ],
});

// 共通 UserData（Spot 中断で再作成されても自動実行）
const rawUserData = `#!/bin/bash
cd /home/ssm-user
sudo yum update -y
sudo dnf install -y postgresql15 nodejs
psql --version
# --- SSM Agent 再インストール（念のため） ---
sudo dnf remove -y amazon-ssm-agent || true
sudo dnf install -y https://s3.ap-northeast-1.amazonaws.com/amazon-ssm-ap-northeast-1/latest/linux_amd64/amazon-ssm-agent.rpm
sudo systemctl enable --now amazon-ssm-agent
# --- pnpm ---
export PNPM_VERSION=9.10.0
curl -fsSL https://get.pnpm.io/install.sh | bash -
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
# --- redis-cli (TLS) ---
sudo dnf install -y gcc gcc-c++ openssl-devel
curl -s http://download.redis.io/redis-stable.tar.gz -o redis-stable.tar.gz
tar zxf redis-stable.tar.gz
cd redis-stable/
make distclean && make redis-cli BUILD_TLS=yes
sudo install -m 0755 src/redis-cli /usr/local/bin/
redis-cli -v
# --- ClickHouse Client ---
cd /home/ssm-user
sudo curl -o /etc/yum.repos.d/altinity.repo https://builds.altinity.cloud/yum-repo/altinity.repo
sudo curl -o /etc/pki/rpm-gpg/RPM-GPG-KEY-altinity https://builds.altinity.cloud/yum-repo/RPM-GPG-KEY-altinity
sudo rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-altinity
sudo dnf clean all
sudo dnf install -y clickhouse-client
clickhouse-client --version
`;

// ------------------------------------------------------------
// 4. Launch Template（Spot）
// ------------------------------------------------------------
const bastionLaunchTemplate = new aws.ec2.LaunchTemplate(
  `${infraConfigResources.idPrefix}-bastion-lt-${$app.stage}`,
  {
    namePrefix: `${infraConfigResources.idPrefix}-bastion-`,
    imageId: ami.then((a) => a.id),
    instanceType: "t3.large",
    iamInstanceProfile: { name: bastionInstanceProfile.name },
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    userData: Buffer.from(rawUserData).toString("base64"),
    tagSpecifications: [
      {
        resourceType: "instance",
        tags: {
          Name: `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
        },
      },
    ],
    instanceMarketOptions: {
      marketType: "spot",
      spotOptions: {
        spotInstanceType: "one-time", // ASG が維持するので one-time で十分
        instanceInterruptionBehavior: "terminate",
      },
    },
  }
);

const bastionAsg = new aws.autoscaling.Group(
  `${infraConfigResources.idPrefix}-bastion-asg-${$app.stage}`,
  {
    desiredCapacity: 1,
    maxSize: 1,
    minSize: 1,
    vpcZoneIdentifiers: [vpcResources.bastionProtectedSubnet1a.id], // 必要なら複数サブネットを並べて AZ 冗長
    launchTemplate: {
      id: bastionLaunchTemplate.id,
      version: "$Latest",
    },
    capacityRebalance: true, // Spot 中断警告時に先行して補充
    tags: [
      {
        key: "Name",
        value: `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
        propagateAtLaunch: true,
      },
    ],
    /*
    healthCheckType: "EC2",            // SSM だけなら EC2 ヘルスでも十分
    healthCheckGracePeriod: 180,
    */
  }
);

export const bastionResources = {
  bastionSecurityGroup
}