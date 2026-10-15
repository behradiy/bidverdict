#!/usr/bin/env bash
# Deploys the GovVerdict API to Cloud Run in its own Google Cloud project.
#
# Required:
#   PROJECT_ID      a NEW project used only for GovVerdict
#   SUPPORT_EMAIL   shown on the privacy policy and landing page
# Optional:
#   CREATE_PROJECT=1        create PROJECT_ID first
#   BILLING_ACCOUNT=XXXX    link this billing account (needed for a new project)
#   BUDGET_USD=50           email alerts at 50% and 90% of this monthly amount
#   OPERATOR_NAME           your name or company, shown on the privacy policy
#   REGION                  default us-central1
#   ALLOWED_EXTENSION_IDS   your Chrome Web Store item ID, once you have it
#   CHROME_STORE_URL        your listing URL, once published
#   PUBLIC_URL              your custom domain (e.g. https://yourdomain.com), once it serves HTTPS;
#                           web pages on other hosts then redirect there (the API does not)
#   PADDLE_ENV (sandbox|production), PADDLE_CLIENT_TOKEN, PADDLE_PRICE_ID, PADDLE_PORTAL_URL, PRO_PRICE_LABEL
#     to switch on Pro (the API key and webhook secret go in Secret Manager as
#     bv-paddle-api-key and bv-paddle-webhook-secret)
#
# Example:
#   CREATE_PROJECT=1 BILLING_ACCOUNT=01ABCD-23EF45-6789AB BUDGET_USD=50 \
#   PROJECT_ID=bidverdict-prod SUPPORT_EMAIL=hello@yourdomain.com OPERATOR_NAME="Your Name" \
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PROJECT_ID:?Set PROJECT_ID to a new project just for GovVerdict}"
: "${SUPPORT_EMAIL:?Set SUPPORT_EMAIL (it appears on the privacy policy)}"
REGION="${REGION:-us-central1}"
SERVICE="bidverdict-api"
SA="bidverdict-api@${PROJECT_ID}.iam.gserviceaccount.com"
G=(gcloud --project="$PROJECT_ID" --quiet)

echo "About to deploy GovVerdict into project: $PROJECT_ID (region $REGION)"
echo "Use a project that holds nothing else. Press Enter to continue or Ctrl+C to stop."
[[ "${YES:-0}" == 1 ]] || read -r _

if [[ "${CREATE_PROJECT:-0}" == 1 ]]; then
  gcloud projects create "$PROJECT_ID" --name="GovVerdict"
fi
if [[ -n "${BILLING_ACCOUNT:-}" ]]; then
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
fi

echo "==> Enabling APIs"
"${G[@]}" services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com compute.googleapis.com \
  aiplatform.googleapis.com firestore.googleapis.com secretmanager.googleapis.com billingbudgets.googleapis.com

# Source deploys build as the Compute Engine default service account in new projects.
PROJECT_NUMBER=$("${G[@]}" projects describe "$PROJECT_ID" --format='value(projectNumber)')
"${G[@]}" projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/run.builder --condition=None >/dev/null

echo "==> Firestore"
if ! "${G[@]}" firestore databases describe --database='(default)' >/dev/null 2>&1; then
  "${G[@]}" firestore databases create --location=nam5 --type=firestore-native
fi
"${G[@]}" firestore fields ttls update expireAt --collection-group=usage --enable-ttl --async >/dev/null 2>&1 || true

echo "==> Service account"
if ! "${G[@]}" iam service-accounts describe "$SA" >/dev/null 2>&1; then
  "${G[@]}" iam service-accounts create bidverdict-api --display-name="GovVerdict API"
fi
for role in roles/datastore.user roles/aiplatform.user roles/secretmanager.secretAccessor; do
  "${G[@]}" projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null
done

echo "==> Secrets"
if ! "${G[@]}" secrets describe bv-ip-salt >/dev/null 2>&1; then
  head -c 32 /dev/urandom | base64 | "${G[@]}" secrets create bv-ip-salt --data-file=- --replication-policy=automatic
fi
SECRETS="IP_SALT=bv-ip-salt:latest"
if "${G[@]}" secrets describe bv-paddle-api-key >/dev/null 2>&1 && "${G[@]}" secrets describe bv-paddle-webhook-secret >/dev/null 2>&1; then
  SECRETS="$SECRETS,PADDLE_API_KEY=bv-paddle-api-key:latest,PADDLE_WEBHOOK_SECRET=bv-paddle-webhook-secret:latest"
  echo "    Paddle secrets found: Pro turns on when PADDLE_CLIENT_TOKEN and PADDLE_PRICE_ID are set."
fi

# '##' delimiter so values may contain commas, spaces and @.
ENVS="GOOGLE_CLOUD_PROJECT=$PROJECT_ID##GOOGLE_CLOUD_LOCATION=global##SUPPORT_EMAIL=$SUPPORT_EMAIL"
ENVS+="##OPERATOR_NAME=${OPERATOR_NAME:-The GovVerdict team}##FREE_DAILY_LIMIT=${FREE_DAILY_LIMIT:-5}##PRO_DAILY_LIMIT=${PRO_DAILY_LIMIT:-60}"
ENVS+="##MODEL_FREE=${MODEL_FREE:-gemini-3.5-flash-lite}##MODEL_PRO=${MODEL_PRO:-gemini-3.8-flash}"
for v in PUBLIC_URL ALLOWED_EXTENSION_IDS CHROME_STORE_URL PADDLE_ENV PADDLE_CLIENT_TOKEN PADDLE_PRICE_ID PADDLE_PORTAL_URL PRO_PRICE_LABEL; do
  [[ -n "${!v:-}" ]] && ENVS+="##$v=${!v}"
done

echo "==> Deploying Cloud Run service (first build takes 3-5 minutes)"
"${G[@]}" run deploy "$SERVICE" --source server --region "$REGION" --service-account "$SA" \
  --allow-unauthenticated --memory 1Gi --cpu 1 --timeout 300 --concurrency 10 --max-instances 3 \
  --set-env-vars "^##^$ENVS" --set-secrets "$SECRETS"

URL=$("${G[@]}" run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')

if [[ -n "${BUDGET_USD:-}" && -n "${BILLING_ACCOUNT:-}" ]]; then
  echo "==> Budget alert at \$${BUDGET_USD}/month"
  gcloud billing budgets create --billing-project="$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" --display-name="GovVerdict" \
    --budget-amount="${BUDGET_USD}USD" --filter-projects="projects/$PROJECT_ID" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 >/dev/null || echo "    (budget not created; add one in the console)"
fi

cat <<EOF

Deployed.
  API:            $URL
  Privacy policy: $URL/privacy
  Landing page:   $URL/

Next:
  python3 scripts/smoke_test.py $URL
  ./scripts/package-extension.sh $URL
EOF
