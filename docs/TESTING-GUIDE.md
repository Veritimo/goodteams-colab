# GoodTeams Platform - Testing Guide

> Step-by-step guide to running and testing the platform locally.

**Last Updated:** 2026-02-02  
**Status:** Integration Testing Phase

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase A: Get It Running](#2-phase-a-get-it-running)
3. [Phase B: Set Up Real Auth (Entra)](#3-phase-b-set-up-real-auth-entra)
4. [Phase C: Test Real Flows](#4-phase-c-test-real-flows)
5. [Phase D: Google Setup (Optional)](#5-phase-d-google-setup-optional)
6. [API Reference](#6-api-reference)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

### Required
- Node.js 22+
- PostgreSQL running on port 5434 (via Docker)
- pnpm

### Verify Database is Running
```bash
docker ps | grep goodteams
# Should show: goodteams-colab-postgres-1 on port 5434
```

If not running:
```bash
cd ~/Repos/goodteams-colab/goodteams-colab
docker-compose up -d
```

### Verify Database Schema
```bash
cd ~/Repos/goodteams-colab/goodteams-colab
npx prisma db push
```

---

## 2. Phase A: Get It Running

### Step 1: Start the Gateway

```bash
cd ~/Repos/goodteams-colab/goodteams-colab
node openclaw.mjs --profile goodteams gateway --port 19100 --allow-unconfigured
```

Keep this terminal open. You should see:
```
[gateway] listening on ws://127.0.0.1:19100 (PID xxxxx)
[gateway] listening on ws://[::1]:19100
```

> **Note:** We use port 19100 to avoid conflict with your personal OpenClaw on 18789.

### Step 2: Verify It's Alive

In another terminal:
```bash
curl http://127.0.0.1:19100/api/platform/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T...",
  "version": "0.0.0-dev",
  "uptime": 5,
  "checks": {
    "database": "ok"
  }
}
```

### Step 3: Test with Stub Auth

For quick testing without real Entra, use stub tokens:

```bash
# Create a stub token
TOKEN="stub:$(echo '{"id":"test-user","email":"admin@test.com","name":"Test Admin","orgId":"test-org-1","role":"admin"}' | base64)"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:19100/api/platform/org
```

---

## 3. Phase B: Set Up Real Auth (Entra)

### Step 1: Create Entra App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - **Name:** `GoodTeams Dev`
   - **Supported account types:** "Accounts in this organizational directory only"
   - **Redirect URI:** 
     - Platform: Web
     - URL: `http://localhost:19100/api/platform/auth/callback`
4. Click **Register**

### Step 2: Get Credentials

After registration, note down:
- **Application (client) ID** - on the Overview page
- **Directory (tenant) ID** - on the Overview page

### Step 3: Create Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Description: `GoodTeams Dev Secret`
3. Expiration: 12 months (or your preference)
4. Click **Add**
5. **Copy the secret value immediately** (you won't see it again)

### Step 4: Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
   - `offline_access`
4. Click **Grant admin consent** (if you're an admin)

### Step 5: Add to Environment

Create or edit `.env` in the repo root:

```bash
# Entra SSO
ENTRA_CLIENT_ID=<your-application-client-id>
ENTRA_CLIENT_SECRET=<your-client-secret>
ENTRA_TENANT_ID=<your-directory-tenant-id>

# App URLs
APP_URL=http://localhost:19100
PLATFORM_API_URL=http://localhost:19100/api/platform

# Database (should already be set)
DATABASE_URL=postgresql://goodteams:goodteams@localhost:5434/goodteams
```

### Step 6: Restart Gateway

Kill the gateway (Ctrl+C) and restart:
```bash
node openclaw.mjs --profile goodteams gateway --port 19100 --allow-unconfigured
```

---

## 4. Phase C: Test Real Flows

### Test SSO Login

1. Open in browser: `http://localhost:19100/api/platform/auth/login`
2. Should redirect to Microsoft login
3. Sign in with your Microsoft account
4. Should redirect back to callback URL with a token

### Test Authenticated APIs

After login, use the token:

```bash
# Replace with your actual token from the login flow
TOKEN="eyJ..."

# Get current user
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:19100/api/platform/users/me

# Get organization
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:19100/api/platform/org

# List workflows
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:19100/api/platform/workflows
```

### Create Test Data

```bash
# Create a workflow
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Workflow",
    "description": "A test workflow",
    "definition": {
      "nodes": [
        {"id": "t1", "type": "trigger", "position": {"x": 0, "y": 0}, 
         "data": {"label": "Start", "config": {"triggerType": "MANUAL"}}},
        {"id": "a1", "type": "agent", "position": {"x": 200, "y": 0}, 
         "data": {"label": "Process", "config": {"prompt": "Analyze the input"}}}
      ],
      "edges": [{"id": "e1", "source": "t1", "target": "a1"}]
    }
  }' \
  http://127.0.0.1:19100/api/platform/workflows

# Execute a workflow (replace WORKFLOW_ID)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"data": "test"}}' \
  http://127.0.0.1:19100/api/platform/workflows/WORKFLOW_ID/execute
```

---

## 5. Phase D: Google Setup (Optional)

### Step 1: Create GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   - Google Drive API
   - Gmail API
   - Google Calendar API

### Step 2: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:19100/api/platform/auth/google/callback`
5. Click **Create**

### Step 3: Add to Environment

```bash
# Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

---

## 6. API Reference

### Base URL
```
http://localhost:19100/api/platform
```

### Authentication

All endpoints (except `/health`) require authentication:
```
Authorization: Bearer <token>
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| GET | `/org` | Get current organization |
| GET | `/users` | List organization users |
| GET | `/users/me` | Get current user profile |
| PUT | `/users/:id/role` | Change user role (admin only) |
| GET | `/invitations` | List pending invitations |
| POST | `/invitations` | Create invitation |
| GET | `/workflows` | List workflows |
| POST | `/workflows` | Create workflow |
| GET | `/workflows/:id` | Get workflow details |
| PUT | `/workflows/:id` | Update workflow |
| DELETE | `/workflows/:id` | Delete workflow |
| POST | `/workflows/:id/execute` | Execute workflow |
| GET | `/workflows/:id/executions` | Get workflow executions |
| GET | `/audit` | List audit logs |
| GET | `/permissions` | List available permissions |
| GET | `/auth/login` | Initiate SSO login |
| GET | `/auth/callback` | SSO callback |
| POST | `/auth/logout` | Logout |

### Response Format

Success:
```json
{
  "id": "...",
  "name": "...",
  ...
}
```

Error:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## 7. Troubleshooting

### Gateway Won't Start

**"gateway already running"**
```bash
# Kill existing gateway
pkill -f "gateway --port 19100"
# Or use the CLI
node openclaw.mjs --profile goodteams gateway stop
```

**"Port already in use"**
```bash
# Find what's using the port
lsof -i :19100
# Kill it or use a different port
node openclaw.mjs --profile goodteams gateway --port 19200 --allow-unconfigured
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not, start it
cd ~/Repos/goodteams-colab/goodteams-colab
docker-compose up -d

# Verify connection
psql postgresql://goodteams:goodteams@localhost:5434/goodteams -c "SELECT 1"
```

### Auth Not Working

**Stub tokens not accepted:**
- Make sure the token starts with `stub:`
- The JSON must have: `id`, `email`, `orgId`, `role`
- Role must be: `owner`, `admin`, `member`, or `viewer`

**Entra login fails:**
- Verify redirect URI matches exactly in Azure portal
- Check that admin consent was granted for permissions
- Verify `.env` values are correct (no extra spaces)

### CORS Errors in Browser

The API adds CORS headers automatically. If you still see errors:
- Make sure you're hitting the correct port (19100)
- Check that the gateway is actually running

---

## Quick Reference

### Start Everything
```bash
# Terminal 1: Database
cd ~/Repos/goodteams-colab/goodteams-colab
docker-compose up -d

# Terminal 2: Gateway
node openclaw.mjs --profile goodteams gateway --port 19100 --allow-unconfigured
```

### Quick Health Check
```bash
curl http://127.0.0.1:19100/api/platform/health | jq
```

### Quick Auth Test
```bash
TOKEN="stub:$(echo '{"id":"u1","email":"a@t.com","name":"A","orgId":"test-org-1","role":"admin"}' | base64)"
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:19100/api/platform/org | jq
```

---

## Next Steps

Once basic testing is working:
1. Set up real Entra auth
2. Create realistic test data
3. Test workflow execution with BullMQ (requires Redis)
4. Test M365/Google integrations with real credentials
5. Build the Control UI

Questions? Check the other docs in `/docs/` or ask the AI assistant.
