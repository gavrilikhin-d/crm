#!/usr/bin/env bash
# Invoked from GitHub Actions to run deploy/deploy.sh on EC2 via SSM.
set -euo pipefail

INSTANCE_ID="${1:?EC2 instance id required}"
DEPLOY_SHA="${2:?deploy sha required}"
DEPLOY_REF="${3:-main}"
AWS_REGION="${4:-eu-central-1}"
DEPLOY_USER="${5:-ec2-user}"

CRM_APP_DIR="/home/${DEPLOY_USER}/crm"
REMOTE_SCRIPT="export DEPLOY_SHA='${DEPLOY_SHA}' DEPLOY_REF='${DEPLOY_REF}' AWS_REGION='${AWS_REGION}' CRM_APP_DIR='${CRM_APP_DIR}'; bash '${CRM_APP_DIR}/deploy/deploy.sh'"
WRAPPED="sudo -u ${DEPLOY_USER} -H bash -lc $(printf '%q' "$REMOTE_SCRIPT")"

aws_cli=(aws --region "$AWS_REGION")

describe_out="$("${aws_cli[@]}" ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=${INSTANCE_ID}" \
  --output json 2>&1)" || describe_rc=$?

if [[ "${describe_rc:-0}" -ne 0 ]]; then
  echo "Failed to query SSM instance status (region: ${AWS_REGION}):" >&2
  echo "$describe_out" >&2
  if [[ "$describe_out" == *"AccessDenied"* || "$describe_out" == *"not authorized"* ]]; then
    echo >&2
    echo "GitHub IAM user needs ssm:DescribeInstanceInformation on Resource \"*\"." >&2
    echo "Instance-scoped policies are not enough for this API." >&2
  fi
  exit 1
fi

ping_status="$(echo "$describe_out" | jq -r '.InstanceInformationList[0].PingStatus // "None"')"

if [[ "$ping_status" != "Online" ]]; then
  echo "Instance ${INSTANCE_ID} is not online in SSM (status: ${ping_status}, region: ${AWS_REGION})." >&2
  echo "On EC2, check:" >&2
  echo "  1. Instance IAM role includes AmazonSSMManagedInstanceCore" >&2
  echo "  2. sudo systemctl status amazon-ssm-agent" >&2
  echo "  3. Outbound HTTPS (443) to AWS is allowed" >&2
  echo "  4. EC2_INSTANCE_ID secret is i-0d217068bb9981687 (eu-central-1)" >&2
  exit 1
fi

params="$(jq -n --arg cmd "$WRAPPED" '{commands: [$cmd]}')"

command_id="$("${aws_cli[@]}" ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "CRM deploy ${DEPLOY_SHA}" \
  --timeout-seconds 900 \
  --parameters "$params" \
  --query Command.CommandId \
  --output text)"

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
