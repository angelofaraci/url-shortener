# SSM Parameter Store is the split between CI-readable config and
# instance-role-only secrets:
#   /url-shortener/config/*  — String, readable by the OIDC deploy role (CI)
#   /url-shortener/secret/*  — SecureString, decryptable by the EC2 instance
#                               role only (Ansible convergence)
#
# PR 1 seeds the namespace with what the network/RDS foundation produces
# (config/instance_id, secret/database_url, secret/origin_verify,
# secret/ts_authkey). PR 2 adds the config/* parameters that depend on the
# CDN + artifacts resources (public_base_url, distribution_id,
# artifacts_bucket).

resource "aws_ssm_parameter" "config_instance_id" {
  name        = "/${var.project_name}/config/instance_id"
  description = "EC2 instance id — used by CI for ssm:SendCommand"
  type        = "String"
  value       = aws_instance.app.id

  tags = {
    Name = "${var.project_name}-config-instance-id"
  }
}

resource "aws_ssm_parameter" "secret_database_url" {
  name        = "/${var.project_name}/secret/database_url"
  description = "Postgres connection string for the backend — instance role decrypt only"
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${random_password.db_master.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"

  tags = {
    Name = "${var.project_name}-secret-database-url"
  }
}

resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "secret_origin_verify" {
  name        = "/${var.project_name}/secret/origin_verify"
  description = "Shared secret CloudFront injects as X-Origin-Verify; nginx checks it — instance role decrypt only"
  type        = "SecureString"
  value       = random_password.origin_verify.result

  tags = {
    Name = "${var.project_name}-secret-origin-verify"
  }
}

resource "aws_ssm_parameter" "secret_ts_authkey" {
  name        = "/${var.project_name}/secret/ts_authkey"
  description = "Tailscale auth key — seeded manually once, Terraform ignores drift"
  type        = "SecureString"
  value       = "placeholder-set-manually"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name = "${var.project_name}-secret-ts-authkey"
  }
}
