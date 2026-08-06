#!/usr/bin/env python3
"""Config-parity check (design D7, task 7.1/7.4-adjacent): assert that
k8s/ingress.yaml and terraform/frontend-cdn.tf route the exact same set of
SPA client-side routes to the frontend origin.

The two edge configs are independent deployment targets (k8s ingress-nginx
vs. CloudFront) and have already drifted once (see git history: /link-error
was fixed in CloudFront but missing from the k8s ingress until this change).
This script is the single automated guard against that drifting again.

RED before D7: this script would have found /stats, /links, /dashboard
(and /link-error, in the k8s file) missing from one or both configs.
GREEN after D7: both configs agree on the same route set.

Run with: python3 scripts/check-edge-config-parity.py
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INGRESS_PATH = REPO_ROOT / "k8s" / "ingress.yaml"
CDN_PATH = REPO_ROOT / "terraform" / "frontend-cdn.tf"

# The canonical SPA route set that must be routed to the frontend origin in
# both configs. Kept in sync manually with RESERVED_ALIASES in
# backend/src/controllers/linkController.ts (which reserves the same short
# codes so a link can never collide with one of these routes) and with the
# per-file comments in ingress.yaml / frontend-cdn.tf.
EXPECTED_SPA_ROUTES = {"stats", "links", "dashboard", "link-error"}


def ingress_frontend_routes() -> set[str]:
    try:
        import yaml  # type: ignore
    except ImportError:
        print("PyYAML not available; falling back to regex parsing.", file=sys.stderr)
        return _ingress_frontend_routes_regex()

    doc = yaml.safe_load(INGRESS_PATH.read_text())
    routes: set[str] = set()
    for rule in doc["spec"]["rules"]:
        for path_rule in rule["http"]["paths"]:
            if path_rule["backend"]["service"]["name"] != "frontend":
                continue
            path = path_rule["path"].strip("/")
            if path in ("", "assets"):
                continue  # not one of the SPA client-side routes under test
            routes.add(path)
    return routes


def _ingress_frontend_routes_regex() -> set[str]:
    text = INGRESS_PATH.read_text()
    routes: set[str] = set()
    for block in re.split(r"\n\s*- path:", text)[1:]:
        block = "- path:" + block
        path_match = re.search(r"- path:\s*(\S+)", block)
        service_match = re.search(r"name:\s*(\S+)", block)
        if not path_match or not service_match:
            continue
        path = path_match.group(1).strip("/")
        service = service_match.group(1)
        if service == "frontend" and path not in ("", "assets"):
            routes.add(path)
    return routes


def cdn_frontend_routes() -> set[str]:
    text = CDN_PATH.read_text()
    routes: set[str] = set()
    for block in re.findall(r"ordered_cache_behavior\s*{([^}]*)}", text):
        pattern_match = re.search(r'path_pattern\s*=\s*"([^"]+)"', block)
        origin_match = re.search(r'target_origin_id\s*=\s*"([^"]+)"', block)
        if not pattern_match or not origin_match:
            continue
        if origin_match.group(1) != "s3-frontend":
            continue
        pattern = pattern_match.group(1).strip("/")
        pattern = pattern[:-2] if pattern.endswith("/*") else pattern
        if pattern in ("", "index.html", "assets"):
            continue  # not one of the SPA client-side routes under test
        routes.add(pattern)
    return routes


def main() -> int:
    ingress_routes = ingress_frontend_routes()
    cdn_routes = cdn_frontend_routes()

    missing_from_ingress = EXPECTED_SPA_ROUTES - ingress_routes
    missing_from_cdn = EXPECTED_SPA_ROUTES - cdn_routes
    extra_in_ingress = ingress_routes - EXPECTED_SPA_ROUTES
    extra_in_cdn = cdn_routes - EXPECTED_SPA_ROUTES

    ok = True
    if missing_from_ingress:
        ok = False
        print(f"FAIL: k8s/ingress.yaml is missing routes: {sorted(missing_from_ingress)}")
    if missing_from_cdn:
        ok = False
        print(f"FAIL: terraform/frontend-cdn.tf is missing routes: {sorted(missing_from_cdn)}")
    if extra_in_ingress:
        ok = False
        print(f"FAIL: k8s/ingress.yaml has routes not in the expected set: {sorted(extra_in_ingress)}")
    if extra_in_cdn:
        ok = False
        print(f"FAIL: terraform/frontend-cdn.tf has routes not in the expected set: {sorted(extra_in_cdn)}")

    if ok:
        print(f"OK: both configs route the same SPA route set to the frontend origin: {sorted(EXPECTED_SPA_ROUTES)}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
