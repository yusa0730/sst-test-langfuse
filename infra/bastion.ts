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

// 5. EC2 Instance
const bastionInstance = new aws.ec2.Instance(
  `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
  {
    ami: ami.then(a => a.id),
    instanceType: "t3.large",
    subnetId: vpcResources.bastionProtectedSubnets[0].id, // 🔁 Private/Public どちらでもOK（SSM用ならPrivateでも可）
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    iamInstanceProfile: bastionInstanceProfile.name,
    userData: `#!/bin/bash
    cd /home/ec2-user
    sudo yum update -y
    sudo dnf install -y postgresql15
    sudo yum install -y https://s3.ap-northeast-1.amazonaws.com/amazon-ssm-ap-northeast-1/latest/linux_amd64/amazon-ssm-agent.rpm
    sudo systemctl start amazon-ssm-agent
    sudo systemctl enable amazon-ssm-agent
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
    `,
    tags: {
      Name: `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
    },
  }
);

export const bastionResources = {
  bastionSecurityGroup
}