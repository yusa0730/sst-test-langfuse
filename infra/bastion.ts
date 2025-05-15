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
            "logs:DescribeLogGroups",
            "logs:DescribeLogStreams",
            "logs:GetLogEvents",
            "ecs:DescribeTasks",
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
    instanceType: "t3.micro",
    // subnetId: vpcResources.asyncWorkerPrivateSubnets[0].id, // 🔁 Private/Public どちらでもOK（SSM用ならPrivateでも可）
    subnetId: vpcResources.bastionProtectedSubnets[0].id, // 🔁 Private/Public どちらでもOK（SSM用ならPrivateでも可）
    vpcSecurityGroupIds: [bastionSecurityGroup.id],
    iamInstanceProfile: bastionInstanceProfile.name,
    userData: `#!/bin/bash
    cd /home/ec2-user
    sudo yum update -y
    sudo yum install -y git
    sudo yum install -y nodejs
    sudo dnf install -y postgresql15
    sudo yum install -y https://s3.ap-northeast-1.amazonaws.com/amazon-ssm-ap-northeast-1/latest/linux_amd64/amazon-ssm-agent.rpm
    sudo systemctl start amazon-ssm-agent
    sudo systemctl enable amazon-ssm-agent
    sudo git clone https://github.com/langfuse/langfuse.git
    chown -R ec2-user:ec2-user /home/ec2-user/langfuse
    export PNPM_VERSION=9.10.0
    curl -fsSL https://get.pnpm.io/install.sh | bash -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    `,
    tags: {
      Name: `${infraConfigResources.idPrefix}-bastion-${$app.stage}`,
    },
  }
);

export const bastionResources = {
  bastionSecurityGroup
}