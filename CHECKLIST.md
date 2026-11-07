# Cloud Run, Neon & Cloudflare D1 Production Setup Checklist

This document provides exact, battle-tested operational commands to deploy the **Neon PostgreSQL (source of truth)** -> **Cloudflare D1 (reader edge)** publish pipeline, configure HMAC-signed synchronization, set up Cloud Scheduler, and verify edge replication.

---

## 1. Apply Neon PostgreSQL Migrations
Run the initial schema (`migrations/001_init.sql`) and outbox synchronization schema (`migrations/002_sync.sql`) using your owner connection string:

```bash
# In your local shell or Cloud Shell with NEON_DATABASE_URL exported:
export NEON_DATABASE_URL="postgres://currentnews_app:<password>@<ep-xyz>.us-east-2.aws.neon.tech/currentnews?sslmode=require"

# Execute all migrations in order
node scripts/migrate-neon.mjs
```

---

## 2. Apply Cloudflare D1 Schema Migration
Initialize the `articles` table and performance indexes on your Cloudflare D1 database:

```bash
# From the root directory:
cd worker

# Execute 0001_articles.sql against remote D1 database
npx wrangler d1 execute currentnews-db --remote --file=migrations/0001_articles.sql

cd ..
```

---

## 3. Configure Cloudflare Worker Secret (`SYNC_SECRET`)
Store the HMAC signing secret securely in Cloudflare:

```bash
# Generate a strong 64-character random hex string:
openssl rand -hex 32

# Store the secret in Cloudflare Worker (prompts to paste your secret):
cd worker
npx wrangler secret put SYNC_SECRET
cd ..
```

---

## 4. Configure Cloud Run Secrets & Environment Variables
Add `SYNC_SECRET`, `SYNC_TICK_TOKEN`, and `WORKER_BASE_URL` to Google Cloud Secret Manager and deploy to your admin Cloud Run service:

```bash
# 1. Generate a secure random token for Cloud Scheduler tick
SYNC_TICK_TOKEN=$(openssl rand -hex 32)
echo "Generated SYNC_TICK_TOKEN: $SYNC_TICK_TOKEN"

# 2. Store SYNC_SECRET in Secret Manager (use the same secret generated in Step 3)
echo -n "<PASTE_YOUR_SYNC_SECRET_HERE>" | \
  gcloud secrets create SYNC_SECRET --data-file=- \
  || echo -n "<PASTE_YOUR_SYNC_SECRET_HERE>" | gcloud secrets versions add SYNC_SECRET --data-file=-

# 3. Store SYNC_TICK_TOKEN in Secret Manager
echo -n "$SYNC_TICK_TOKEN" | \
  gcloud secrets create SYNC_TICK_TOKEN --data-file=- \
  || echo -n "$SYNC_TICK_TOKEN" | gcloud secrets versions add SYNC_TICK_TOKEN --data-file=-

# 4. Grant Cloud Run service account access to both secrets
PROJECT_NUM=$(gcloud projects describe gen-lang-client-0638643565 --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUM}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding SYNC_SECRET \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SYNC_TICK_TOKEN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# 5. Update Cloud Run service with secrets & worker base URL
gcloud run services update currentnews \
  --region="asia-east1" \
  --set-secrets="SYNC_SECRET=SYNC_SECRET:latest,SYNC_TICK_TOKEN=SYNC_TICK_TOKEN:latest" \
  --update-env-vars="WORKER_BASE_URL=https://api.currentnews.blog,FIREBASE_PROJECT_ID=gen-lang-client-0638643565"
```

---

## 5. Deploy Cloudflare Worker
Deploy the updated edge worker with signed internal synchronization endpoints (`/internal/*`) and public reader routes (`/articles*`):

```bash
cd worker
npx wrangler deploy
cd ..
```

---

## 6. Configure Google Cloud Scheduler for Outbox Background Sync
Set up a recurring Cloud Scheduler job to trigger `POST /api/admin/sync-tick` every 5 minutes to flush any pending outbox items:

```bash
# Create the 5-minute scheduler job with the X-Sync-Token header:
gcloud scheduler jobs create http currentnews-outbox-sync \
  --location="asia-east1" \
  --schedule="*/5 * * * *" \
  --uri="https://admin.currentnews.blog/api/admin/sync-tick" \
  --http-method="POST" \
  --headers="Content-Type=application/json,X-Sync-Token=$SYNC_TICK_TOKEN" \
  --description="Hourly/5-min automated outbox flush for Current News D1 publish pipeline"
```

---

## 7. Initial Historical Resync (Neon -> D1)
Populate D1 with all currently published articles and prune orphaned rows:

```bash
# Dry run first to verify batches
node scripts/resync-d1.mjs --dry-run

# Run live resync and reconciliation
node scripts/resync-d1.mjs
```

---

## 8. Verification & Adversarial Test Plan

### Test A: Publish an Article & Verify Edge Propagation
1. Sign in to `https://admin.currentnews.blog/admin/draft`.
2. Compose a new story with headline, manuscript, and image.
3. Click **Publish Article**.
4. Observe the response:
   - Status badge in `/admin/publications` displays **`Live`** (emerald pill).
   - If D1 is temporarily unreachable, displays **`Sync pending`** or **`Sync failed`** with hover tooltip, and the save still succeeds!
5. Test public edge reader endpoint immediately:
   ```bash
   curl -i "https://api.currentnews.blog/articles?limit=5"
   # Verify the new article appears in the JSON response
   ```
6. Test direct lookup by ID or slug:
   ```bash
   curl -i "https://api.currentnews.blog/articles/<POST_ID>"
   ```

### Test B: Edit an Article & Verify Keyset Consistency
1. Edit the title or content in `/admin/draft?id=<POST_ID>`.
2. Click **Publish Article**.
3. Query D1 edge:
   ```bash
   curl -i "https://api.currentnews.blog/articles/<POST_ID>"
   # Verify updated content and incremented version
   ```

### Test C: Unpublish / Delete an Article & Verify Purge
1. In `/admin/publications`, click the trash icon on the article.
2. Confirm deletion.
3. Query D1 edge:
   ```bash
   curl -i "https://api.currentnews.blog/articles/<POST_ID>"
   # Expected: HTTP/1.1 404 Not Found
   ```
4. Verify the article is removed from `/articles` feed.

### Test D: Security & Replay Attack Defense Check
1. **Unauthorized Internal Route Access:**
   ```bash
   curl -i -X POST https://api.currentnews.blog/internal/publish \
     -H "Content-Type: application/json" \
     -d '{"article":{"id":"post_test"}}'
   # Expected: HTTP/1.1 401 Unauthorized (never reveals why)
   ```
2. **Expired Timestamp Replay Attack:**
   ```bash
   curl -i -X POST https://api.currentnews.blog/internal/publish \
     -H "Content-Type: application/json" \
     -H "X-Timestamp: 1500000000000" \
     -H "X-Signature: abcdef" \
     -d '{"article":{"id":"post_test"}}'
   # Expected: HTTP/1.1 401 Unauthorized
   ```
3. **Trigger Manual Outbox Sync from Admin:**
   In `/admin/publications`, click the **Retry sync** button or call:
   ```bash
   curl -i -X POST https://admin.currentnews.blog/api/admin/sync/run \
     -H "Authorization: Bearer <ID_TOKEN>"
   # Expected: HTTP/1.1 200 OK {"success":true,"processed":...,"succeeded":...}
   ```
