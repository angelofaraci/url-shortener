data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]

  tags = {
    Name = "${var.project_name}-github-actions-oidc"
  }
}

resource "aws_iam_role" "github_actions_terraform" {
  name = "${var.project_name}-github-actions-terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:angelofaraci/url-shortener:ref:refs/heads/main",
            "repo:angelofaraci/url-shortener:pull_request"
          ]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_terraform" {
  name = "${var.project_name}-terraform-permissions"
  role = aws_iam_role.github_actions_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Ec2Manage"
        Effect   = "Allow"
        Action   = ["ec2:*"]
        Resource = "*"
      },
      {
        Sid      = "EcrManage"
        Effect   = "Allow"
        Action   = ["ecr:*"]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${var.project_name}-*"
      },
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "IamManageProjectRoles"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:PutRolePolicy",
          "iam:GetRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:TagRole",
          "iam:PassRole",
          "iam:CreateInstanceProfile",
          "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile",
          "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile"
        ]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-*",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:instance-profile/${var.project_name}-*"
        ]
      },
      {
        Sid    = "StateBucket"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.project_name}-tfstate-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::${var.project_name}-tfstate-${data.aws_caller_identity.current.account_id}/*"
        ]
      },
      {
        # rds.tf: aws_db_instance, aws_db_subnet_group. RDS's resource-level
        # permissions are inconsistent across actions (many Describe/List
        # calls only work with Resource "*"), so this mirrors Ec2Manage's
        # broad grant rather than fighting that.
        Sid      = "RdsManage"
        Effect   = "Allow"
        Action   = ["rds:*"]
        Resource = "*"
      },
      {
        # frontend-cdn.tf: aws_cloudfront_distribution, aws_cloudfront_origin_access_control
        Sid      = "CloudfrontManage"
        Effect   = "Allow"
        Action   = ["cloudfront:*"]
        Resource = "*"
      },
      {
        # security.tf: data.aws_kms_alias.ssm — read-only lookup of the
        # AWS-managed SSM key alias, only supports Resource "*".
        Sid      = "KmsRead"
        Effect   = "Allow"
        Action   = ["kms:ListAliases", "kms:DescribeKey"]
        Resource = "*"
      },
      {
        # oidc.tf: aws_iam_openid_connect_provider itself. Missing before —
        # this role manages the very provider it authenticates through.
        Sid    = "OidcProviderManage"
        Effect = "Allow"
        Action = [
          "iam:GetOpenIDConnectProvider",
          "iam:CreateOpenIDConnectProvider",
          "iam:DeleteOpenIDConnectProvider",
          "iam:TagOpenIDConnectProvider",
          "iam:UntagOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint"
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
      },
      {
        # ssm.tf: full parameter lifecycle under this project's namespace,
        # both config/* and secret/* — Terraform itself owns these, which
        # is broader than the narrower read-only carve-outs granted to the
        # instance role (secret/*) and the deploy role (config/* only).
        Sid      = "SsmParamsManage"
        Effect   = "Allow"
        Action   = ["ssm:*"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
      },
      {
        # ssm:DescribeParameters doesn't support resource-level scoping at
        # all (AWS requires Resource "*" for it, unlike GetParameter/
        # PutParameter above) — it's how the provider looks up parameter
        # metadata during refresh.
        Sid      = "SsmDescribeParams"
        Effect   = "Allow"
        Action   = ["ssm:DescribeParameters"]
        Resource = "*"
      },
      {
        # frontend-cdn.tf + artifacts.tf: the frontend and artifacts S3
        # buckets and their sub-resource configuration (versioning, public
        # access block, lifecycle, bucket policy, accelerate/encryption
        # config the provider reads on every refresh) — separate from the
        # StateBucket grant above, which only covers the tfstate bucket.
        # s3:* instead of enumerating individual Get/Put actions: S3's IAM
        # action names are inconsistent (e.g. GetAccelerateConfiguration
        # has no "Bucket" in the name despite being bucket-level), so a
        # allow-list here would keep missing one action at a time.
        Sid    = "ProjectBucketsManage"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::${var.project_name}-frontend-*",
          "arn:aws:s3:::${var.project_name}-frontend-*/*",
          "arn:aws:s3:::${var.project_name}-artifacts-*",
          "arn:aws:s3:::${var.project_name}-artifacts-*/*"
        ]
      }
    ]
  })
}

# Deploy-time permissions for the future GitHub Actions CD workflow
# (a later PR). Reuses this same OIDC role instead of creating a second
# one — the policy diff below is the only scoped extension, no
# `Resource: "*"` grants and no access to `secret/*` SSM parameters.
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${var.project_name}-deploy-permissions"
  role = aws_iam_role.github_actions_terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Scoped to exactly what deploy.yml invokes: `aws s3 sync --delete`
        # (frontend assets, needs List/Get/Put/Delete) and `aws s3 cp`
        # (index.html, needs Put/Get) against the frontend and artifacts
        # buckets. No rds:* — this workflow never calls any `aws rds`
        # command, RDS is managed exclusively by Terraform.
        Sid    = "S3FrontendAndArtifacts"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*",
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Sid      = "CloudfrontManage"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.frontend.arn
      },
      {
        Sid    = "SsmSendCommand"
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.app.id}",
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"
        ]
      },
      {
        Sid      = "SsmGetCommandInvocation"
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation"]
        Resource = "*"
      },
      {
        # IAM scoping fix: PutParameter/GetParameter/DeleteParameter are
        # restricted to /url-shortener/config/* only — NOT the whole
        # /url-shortener/* tree — so a compromised CI workflow cannot
        # overwrite secret/* values (origin_verify, database_url,
        # ts_authkey). No kms:Decrypt grant either; config/* parameters
        # are plain Strings.
        Sid      = "SsmConfigParamsOnly"
        Effect   = "Allow"
        Action   = ["ssm:PutParameter", "ssm:GetParameter", "ssm:GetParameters", "ssm:DeleteParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/config/*"
      }
    ]
  })
}
