variable "project_name" {
  description = "Prefix used to name and tag all resources"
  type        = string
  default     = "url-shortener"
}

variable "aws_region" {
  description = "AWS region where the state bucket lives"
  type        = string
  default     = "us-east-1"
}
