# User Manual

This manual covers everything you need to use, run, and deploy the Repository Template Generator.

## Contents

| Doc | Description |
|-----|-------------|
| [01 — Getting Started](./01-getting-started.md) | Prerequisites and quick-start in under 5 minutes |
| [02 — Environment Variables](./02-environment-variables.md) | Full reference for all server configuration |
| [03 — Running Locally](./03-running-locally.md) | Dev setup with and without Docker |
| [04 — Deployment](./04-deployment.md) | Production deployment with Docker Compose |
| [05 — Using the App](./05-using-the-app.md) | End-to-end walkthrough of the UI |
| [06 — Templates](./06-templates.md) | Available templates and how to add your own |
| [07 — OAuth Setup](./07-oauth-setup.md) | Connecting GitHub and GitLab for repo creation |
| [08 — API Reference](./08-api-reference.md) | All HTTP endpoints with request/response shapes |
| [09 — Testing](./09-testing.md) | Running unit tests and the eval harness |
| [10 — Troubleshooting](./10-troubleshooting.md) | Common errors and how to fix them |

## What is this?

A web application that generates customised repository scaffolding. You pick a template (e.g. FastAPI + PostgreSQL, NestJS, Rust Axum), describe your project in plain language, and Claude rewrites the template files to match. You can then download a ZIP or push directly to a new GitHub or GitLab repository. After the initial generation, use the refinement panel to iterate on the output through multi-turn conversation.

## Architecture at a glance

```
client/      React 18 + Vite + Zustand   — UI served on :5173
server/      Express + Anthropic SDK     — API served on :3000
templates/   Template source files       — loaded at runtime
deployment/  Docker Compose files        — production and dev stacks
```
