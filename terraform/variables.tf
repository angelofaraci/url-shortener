variable "project_name" {
  description = "Prefix used to name and tag all resources"
  type        = string
  default     = "url-shortener"
}

variable "aws_region" {
  description = "AWS region where the infrastructure is deployed"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the single public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type for the app host"
  type        = string
  default     = "t3.micro"
}

variable "ecr_repositories" {
  description = "Names of the ECR repositories to create, one per image"
  type        = list(string)
  default     = ["backend", "frontend"]
}

variable "http_ingress_cidr" {
  description = "CIDR allowed to reach the instance on ports 80/443"
  type        = string
  default     = "0.0.0.0/0"
}
