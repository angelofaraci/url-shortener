output "instance_public_ip" {
  description = "Elastic IP of the app instance — stable across stop/start, this is the CloudFront custom origin"
  value       = aws_eip.app.public_ip
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

output "rds_endpoint" {
  description = "RDS Postgres endpoint (host:port) — connection string lives in SSM, not here"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain — public entrypoint for the SPA and API"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution id — used by CI for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_bucket_name" {
  description = "Private S3 bucket the frontend build is synced to"
  value       = aws_s3_bucket.frontend.bucket
}

output "artifacts_bucket_name" {
  description = "Private S3 bucket for Ansible convergence bundles"
  value       = aws_s3_bucket.artifacts.bucket
}
