# Contributing a Template

A template is a directory inside `templates/` containing:

## Required: `template.json`

A manifest file with these fields:

| Field         | Type             | Rules                                             |
|---------------|------------------|---------------------------------------------------|
| `id`          | string           | Lowercase, alphanumeric, hyphens only. Max 64 chars. Must be unique across all templates. |
| `label`       | string           | Human-readable name shown in the UI. Max 100 chars. |
| `description` | string           | One or two sentences. Max 500 chars.              |
| `tags`        | array of strings | 1–10 tags. Each tag max 32 chars.                 |

Example:

```json
{
  "id": "react-express-postgres",
  "label": "React + Express + PostgreSQL",
  "description": "A full-stack starter with a React frontend, Express API, and PostgreSQL database. Includes Docker Compose for local development.",
  "tags": ["react", "express", "postgres", "docker"]
}
```

## Required: at least one file alongside `template.json`

Template files can be in any subdirectory structure. Common layout:

```
my-template/
├── template.json
├── README.md          ← should contain {{PROJECT_NAME}} placeholder
├── frontend/
├── backend/
└── deploy/
```

## Placeholder

Use `{{PROJECT_NAME}}` anywhere in file content where the project name should appear. The LLM customisation pass will replace all occurrences.

## Validation

Run the server locally — invalid `template.json` files are logged at startup and skipped. Fix any reported errors before submitting.
