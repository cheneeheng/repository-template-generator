# OAuth Setup

OAuth is optional. Without it, users can still generate and download templates as ZIP files. OAuth is required only for the **Push to GitHub** and **Push to GitLab** export options.

---

## GitHub OAuth App

### 1. Create the app

1. Go to **GitHub** → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: any name (shown to users on the consent screen)
   - **Homepage URL**: your application URL (e.g. `http://localhost:5173`)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
     (use your production URL in production)
3. Click **Register application**.
4. Click **Generate a new client secret**.
5. Copy the **Client ID** and **Client Secret**.

### 2. Configure the server

Add to `server/.env`:

```dotenv
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

### Scope

The app requests the `repo` scope, which allows creating both public and private repositories.

### Production callback URL

Change `GITHUB_REDIRECT_URI` to `https://yourdomain.com/api/auth/github/callback` and update the callback URL in the GitHub OAuth App settings to match.

---

## GitHub App (alternative)

A GitHub App can be used instead of an OAuth App. This gives more granular permission control. Configure one or the other — not both.

### 1. Create the app

1. Go to **GitHub** → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.
2. Set a name, homepage URL, and callback URL.
3. Under **Permissions**, grant **Contents: Read & Write** (to create and push to repositories).
4. After creating, note the **App ID**.
5. Generate a **Private Key** (PEM file).

### 2. Configure the server

```dotenv
GITHUB_APP_ID=<numeric-app-id>
GITHUB_APP_PRIVATE_KEY=<pem-content-with-newlines-as-\n>
GITHUB_APP_INSTALLATION_URL=https://github.com/apps/<slug>/installations/new
```

For the private key, replace literal newlines with `\n` so the value fits on one line:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private-key.pem
```

---

## GitLab OAuth

### 1. Create the application

1. Go to **GitLab** → **User Settings** (top-right avatar) → **Applications** → **Add new application**.
   - For group-owned applications: **Group** → **Settings** → **Applications**.
2. Fill in:
   - **Name**: any name
   - **Redirect URI**: `http://localhost:3000/api/auth/gitlab/callback`
   - **Scopes**: check `api`
3. Click **Save application**.
4. Copy the **Application ID** and **Secret**.

### 2. Configure the server

```dotenv
GITLAB_CLIENT_ID=<application-id>
GITLAB_CLIENT_SECRET=<secret>
GITLAB_REDIRECT_URI=http://localhost:3000/api/auth/gitlab/callback
```

### Self-hosted GitLab

Set `GITLAB_BASE_URL` to your instance URL:

```dotenv
GITLAB_BASE_URL=https://gitlab.mycompany.com
```

The OAuth flow and API calls will use this base URL automatically.

### Production callback URL

Change `GITLAB_REDIRECT_URI` to `https://yourdomain.com/api/auth/gitlab/callback` and update the Redirect URI in the GitLab application settings.

---

## Verifying OAuth is active

```bash
curl http://localhost:3000/api/auth/providers
```

Returns which providers are configured, for example:

```json
{ "github": true, "gitlab": false }
```

If a provider shows `false`, check that the corresponding `CLIENT_ID` variable is set in `server/.env` and restart the server.

---

## Token revocation

Users can revoke their OAuth tokens from the UI (Settings or profile menu). The server calls the provider's revoke endpoint via `GET /api/auth/:provider/revoke`. This is best-effort — the token is removed from the server's state regardless of whether the provider call succeeds.
