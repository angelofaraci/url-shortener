#!/usr/bin/env bash
# Executable checks for the threat-matrix rows applicable to this PR (no
# test runner exists in this repo — per design's Testing Strategy table,
# verification is executable checks, not unit tests).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
fail=0

# RED: subprocess secret leakage — every task touching a decrypted SSM
# value must set no_log: true, so a registered task's output never echoes
# a secret to Ansible's console/log.
if ! grep -q "no_log: true" roles/params/tasks/main.yml; then
  echo "FAIL: roles/params/tasks/main.yml is missing no_log: true on a secret-handling task" >&2
  fail=1
fi
if ! grep -q "no_log: true" roles/tailscale/tasks/main.yml; then
  echo "FAIL: roles/tailscale/tasks/main.yml is missing no_log: true on the tailscale up task" >&2
  fail=1
fi

# RED: HTTP routing / origin trust — nginx must have a default-deny map
# keyed on the exact origin-verify header value, checked before proxying.
if ! grep -q 'default 0;' roles/proxy/templates/nginx.conf.j2; then
  echo "FAIL: nginx.conf.j2 has no default-deny origin_verify map" >&2
  fail=1
fi
if ! grep -q 'return 403;' roles/proxy/templates/nginx.conf.j2; then
  echo "FAIL: nginx.conf.j2 does not reject unverified requests with 403" >&2
  fail=1
fi

# RED: shell command composition — converge.sh (terraform/ec2.tf, frozen
# from PR2) must remain a fixed literal command: the only substitution
# allowed is the artifacts bucket name, resolved once at `terraform apply`
# to a fixed resource attribute (design: "bundle path is a constant"). No
# per-run/per-deploy value (an ansible extra-var, a positional shell arg,
# a CI-supplied env var) may be interpolated into the body.
if ! grep -q "<<'CONVERGE'" ../terraform/ec2.tf; then
  echo "FAIL: terraform/ec2.tf's converge.sh heredoc is no longer quoted-literal" >&2
  fail=1
fi
if grep -A6 "<<'CONVERGE'" ../terraform/ec2.tf | grep -Ev '\$\{aws_s3_bucket\.artifacts\.bucket\}' | grep -Eq '\$\{|\{\{|\$[0-9@]'; then
  echo "FAIL: terraform/ec2.tf's converge.sh body interpolates a non-constant value" >&2
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "OK: all applicable threat-matrix checks passed"
fi
exit $fail
