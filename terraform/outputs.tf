output "instance_public_ip" {
  description = "Public IP of the app instance"
  value       = aws_instance.app.public_ip
}

output "instance_id" {
  description = "Instance ID — use with `aws ssm start-session --target <id>`"
  value       = aws_instance.app.id
}

output "ecr_repository_urls" {
  description = "Push targets for each image, e.g. docker push <url>:v1"
  value       = { for name, repo in aws_ecr_repository.images : name => repo.repository_url }
}

output "ecr_registry" {
  description = "Registry host for `aws ecr get-login-password | docker login --username AWS --password-stdin <this>`"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "github_actions_role_arn" {
  description = "Role ARN GitHub Actions assumes via OIDC to run Terraform"
  value       = aws_iam_role.github_actions_terraform.arn
}
