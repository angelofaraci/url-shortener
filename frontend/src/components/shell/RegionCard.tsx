// Runtime line reflects this project's actual deploy target (see
// terraform/main.tf: aws_instance + aws_db_instance, docker-compose.prod.yml:
// redis service) — not the design handoff's fictional Lambda/DynamoDB stack.
export function RegionCard() {
  return (
    <div className="region-card">
      <p className="region-card__line">
        <span className="region-card__dot" />
        <span className="region-card__region">us-east-1</span>
      </p>
      <p className="region-card__runtime">EC2 · RDS Postgres · Redis</p>
    </div>
  );
}
