#!/usr/bin/env bash
# Invoked from GitHub Actions to run deploy/helm-deploy.sh on EC2 via SSM.
set -euo pipefail

INSTANCE_ID="${1:?EC2 instance id required}"
DEPLOY_SHA="${2:?deploy sha required}"
DEPLOY_REF="${3:-main}"
AWS_REGION="${4:-eu-central-1}"
DEPLOY_USER="${5:-ec2-user}"
CRM_IMAGE_REGISTRY="${6:-}"
KUBE_NAMESPACE="${7:-crm}"
HELM_RELEASE="${8:-crm}"
KUBE_INGRESS_HOST="${9:-vocalcrm.site}"

CRM_APP_DIR="/home/${DEPLOY_USER}/crm"
REMOTE_SCRIPT="export DEPLOY_SHA='${DEPLOY_SHA}' DEPLOY_REF='${DEPLOY_REF}' AWS_REGION='${AWS_REGION}' CRM_APP_DIR='${CRM_APP_DIR}' CRM_IMAGE_REGISTRY='${CRM_IMAGE_REGISTRY}' KUBE_NAMESPACE='${KUBE_NAMESPACE}' HELM_RELEASE='${HELM_RELEASE}' KUBE_INGRESS_HOST='${KUBE_INGRESS_HOST}'; bash '${CRM_APP_DIR}/deploy/helm-deploy.sh'"
WRAPPED="sudo -u ${DEPLOY_USER} -H bash -lc $(printf '%q' "$REMOTE_SCRIPT")"

aws_cli=(aws --region "$AWS_REGION")

params="$(jq -n --arg cmd "$WRAPPED" '{commands: [$cmd]}')"

echo "Sending SSM deploy command to ${INSTANCE_ID} (region: ${AWS_REGION})..."

command_id="$("${aws_cli[@]}" ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "CRM deploy ${DEPLOY_SHA}" \
  --timeout-seconds 900 \
  --parameters "$params" \
  --query Command.CommandId \
  --output text 2>&1)" || send_rc=$?

if [[ "${send_rc:-0}" -ne 0 ]]; then
  echo "Failed to send SSM command:" >&2
  echo "$command_id" >&2
  exit 1
fi

echo "SSM command: ${command_id}"

for _ in $(seq 1 90); do
  status="$("${aws_cli[@]}" ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$INSTANCE_ID" \
    --query Status \
    --output text 2>/dev/null || echo "Pending")"

  case "$status" in
    Success)
      "${aws_cli[@]}" ssm get-command-invocation \
        --command-id "$command_id" \
        --instance-id "$INSTANCE_ID" \
        --query StandardOutputContent \
        --output text
      stderr="$("${aws_cli[@]}" ssm get-command-invocation \
        --command-id "$command_id" \
        --instance-id "$INSTANCE_ID" \
        --query StandardErrorContent \
        --output text)"
      if [[ -n "$stderr" ]]; then
        echo "$stderr" >&2
      fi
      exit 0
      ;;
    Failed|Cancelled|TimedOut)
      echo "SSM deploy failed with status: ${status}" >&2
      "${aws_cli[@]}" ssm get-command-invocation \
        --command-id "$command_id" \
        --instance-id "$INSTANCE_ID" \
        --output json >&2
      exit 1
      ;;
    *)
      sleep 10
      ;;
  esac
done

echo "SSM deploy timed out waiting for command ${command_id}" >&2
exit 1
