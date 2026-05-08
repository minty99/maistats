#!/usr/bin/env bash

set -euo pipefail

: "${RAVEILLE_USER_TIER_PATH:=raveille_user_tier.json}"
: "${R2_BUCKET_NAME:?R2_BUCKET_NAME is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

if [[ ! -f "${RAVEILLE_USER_TIER_PATH}" ]]; then
  echo "missing ${RAVEILLE_USER_TIER_PATH}" >&2
  exit 1
fi

aws s3 cp \
  "${RAVEILLE_USER_TIER_PATH}" \
  "s3://${R2_BUCKET_NAME}/raveille_user_tier.json" \
  --endpoint-url "${R2_ENDPOINT}" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "application/json"
