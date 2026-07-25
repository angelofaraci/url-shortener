data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Minimal first-boot bootstrap only: install Docker, Ansible, and
# Tailscale, then drop a oneshot systemd unit that pulls the actual
# convergence bundle from the artifacts bucket and runs it. All host
# state (compose stack, nginx proxy, Tailscale join) is applied by that
# Ansible playbook, not here — the playbook tree itself ships in a later
# PR. Amazon Linux 2023 already ships the SSM agent enabled by default,
# so there is no separate SSM agent install step.
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    dnf update -y
    dnf install -y docker ansible-core
    systemctl enable --now docker

    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    curl -fsSL https://tailscale.com/install.sh | sh

    mkdir -p /opt/ansible /opt/app

    cat > /usr/local/bin/converge.sh <<'CONVERGE'
    #!/bin/bash
    set -euo pipefail
    aws s3 cp "s3://${aws_s3_bucket.artifacts.bucket}/ansible/latest.tar.gz" /tmp/ansible-bundle.tar.gz
    rm -rf /opt/ansible /opt/docker-compose.prod.yml
    tar -xzf /tmp/ansible-bundle.tar.gz -C /opt
    ansible-playbook -i localhost, -c local /opt/ansible/site.yml
    CONVERGE
    chmod +x /usr/local/bin/converge.sh

    cat > /etc/systemd/system/converge.service <<'UNIT'
    [Unit]
    Description=Run Ansible convergence
    After=network-online.target docker.service
    Wants=network-online.target

    [Service]
    Type=oneshot
    ExecStart=/usr/local/bin/converge.sh
    Restart=on-failure
    RestartSec=15
    UNIT

    systemctl daemon-reload
    systemctl enable --now converge.service
  EOF
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.instance.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name
  user_data              = local.user_data

  root_block_device {
    volume_size = 20
  }

  tags = {
    Name = "${var.project_name}-instance"
  }
}

# CloudFront's default-behavior origin is this instance's public IP. A
# stop/start reassigns an ephemeral IP and would silently break the CDN,
# so an Elastic IP pins it. Free while attached to a running instance.
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}
