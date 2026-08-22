#!/usr/bin/env bash

set -euo pipefail

: "${MAISHIFT_STATS_PATH:=maishift_stats.json}"
: "${R2_BUCKET_NAME:?R2_BUCKET_NAME is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

if [[ ! -f "${MAISHIFT_STATS_PATH}" ]]; then
  echo "missing ${MAISHIFT_STATS_PATH}" >&2
  exit 1
fi

aws s3 cp \
  "${MAISHIFT_STATS_PATH}" \
  "s3://${R2_BUCKET_NAME}/maishift_stats.json" \
  --endpoint-url "${R2_ENDPOINT}" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "application/json"
