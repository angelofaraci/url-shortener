resource "random_password" "db_master" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Pinned to the same AZ as aws_instance.app (direct reference, not a
  # parallel data-source lookup) to avoid cross-AZ latency and inter-AZ
  # data transfer charges.
  availability_zone = aws_instance.app.availability_zone

  # Free-tier/trial AWS accounts cap automated backup retention below the
  # usual default of 7 days; 1 still gets automated backups enabled.
  backup_retention_period = 1
  skip_final_snapshot     = false
  # Timestamped so a second destroy (e.g. another instance replacement
  # cascading an AZ change here) doesn't collide with a snapshot left
  # over from a previous destroy under the same static name.
  final_snapshot_identifier = "${var.project_name}-db-final-${formatdate("YYYYMMDD-hhmmss", timestamp())}"

  tags = {
    Name = "${var.project_name}-db"
  }
}
