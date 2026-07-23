output "bucket_name" {
  description = "S3 bucket holding the main stack's Terraform state"
  value       = aws_s3_bucket.tfstate.bucket
}
