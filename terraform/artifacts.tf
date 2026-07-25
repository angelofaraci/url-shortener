resource "aws_s3_bucket" "artifacts" {
  bucket        = "${var.project_name}-artifacts-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-artifacts"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-bundles"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Artifact integrity: the bucket has no public access, no anonymous grant,
# and no bucket policy at all. Write access is scoped exclusively to the
# GitHub Actions OIDC role (see the S3 statement in terraform/oidc.tf);
# the EC2 instance role only gets s3:GetObject (see terraform/security.tf).
# S3 denies every request by default unless an IAM identity policy
# explicitly allows it, so no other principal — including the object
# owner via ACL — can write here.
