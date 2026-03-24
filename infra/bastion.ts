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
            "ecs:DescribeTasks",
            "s3:GetObject",
            "s3:PutObject"
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

// 5. EC2 Instance
const bastionInstance = new aws.ec2.Instance(
  `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
  {
    ami: ami.then(a => a.id),
    instanceType: "t3.large",
    subnetId: vpcResources.bastionProtectedSubnet1a.id, // 🔁 Private/Public どちらでもOK（SSM用ならPrivateでも可）
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    iamInstanceProfile: bastionInstanceProfile.name,

    rootBlockDevice: {
      volumeType: "gp3",
      volumeSize: 30,
      encrypted: true,
      deleteOnTermination: true,
    },

    userData: `#!/bin/bash
    cd /home/ssm-user
    sudo yum update -y
    sudo dnf install -y postgresql16 nodejs curl gcc gcc-c++ openssl-devel cloud-utils-growpart xfsprogs
    psql --version
    sudo growpart /dev/nvme0n1 1
    sudo xfs_growfs -d /
    df -h /
    sudo yum install -y https://s3.ap-northeast-1.amazonaws.com/amazon-ssm-ap-northeast-1/latest/linux_amd64/amazon-ssm-agent.rpm
    sudo dnf remove -y amazon-ssm-agent || true
    sudo dnf install -y amazon-ssm-agent
    sudo dnf install -y https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm
    sudo systemctl enable --now amazon-ssm-agent
    session-manager-plugin --version
    export PNPM_VERSION=9.10.0
    curl -fsSL https://get.pnpm.io/install.sh | bash -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    sudo dnf install -y gcc gcc-c++ openssl-devel
    curl -s http://download.redis.io/redis-stable.tar.gz -o redis-stable.tar.gz
    tar zxf redis-stable.tar.gz
    cd redis-stable/
    make distclean
    make redis-cli BUILD_TLS=yes
    sudo install -m 0755 src/redis-cli /usr/local/bin/
    which redis-cli
    redis-cli -v
    set +H
    cd /home/ssm-user
    sudo curl -o /etc/yum.repos.d/altinity.repo https://builds.altinity.cloud/yum-repo/altinity.repo
    sudo curl -o /etc/pki/rpm-gpg/RPM-GPG-KEY-altinity https://builds.altinity.cloud/yum-repo/RPM-GPG-KEY-altinity
    sudo rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-altinity
    sudo dnf clean all
    sudo dnf install -y clickhouse-client
    install -d -o ssm-user -g ssm-user -m 0700 \
      /home/ssm-user/clickhouse-ops/bin \
      /home/ssm-user/clickhouse-ops/logs \
      /home/ssm-user/clickhouse-ops/run
    aws s3 cp s3://langfuse-clickhouse-script-production/clickhouse/production/backup_clickhouse.sh /home/ssm-user/clickhouse-ops/bin/backup_clickhouse.sh",
    aws s3 cp s3://langfuse-clickhouse-script-production/clickhouse/production/restore_clickhouse.sh /home/ssm-user/clickhouse-ops/bin/restore_clickhouse.sh",
    chown ssm-user:ssm-user /home/ssm-user/clickhouse-ops/bin/*.sh
    chmod 0750 /home/ssm-user/clickhouse-ops/bin/*.sh
    clickhouse-client --version
    `,
    tags: {
      Name: `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
    },
  }
);

export const bastionResources = {
  bastionSecurityGroup
}
