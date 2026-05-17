# Using the App

Open **http://localhost:5173** (or your production URL) in a browser.

---

## User journey

The app has six pages. A typical session goes through the first four in order.

### 1. Template Picker

Browse and select a starting template. Templates are grouped by language and framework. Each card shows the template name, a short description, and tags (e.g. `python`, `docker`, `postgres`).

Click a template card to select it, then click **Continue** (or the card itself) to proceed.

See [Templates](./06-templates.md) for the full list of available templates.

---

### 2. Configure

Fill in three fields:

| Field | Description |
|-------|-------------|
| **Project name** | Used to replace `{{PROJECT_NAME}}` placeholders throughout the template files. Stick to lowercase alphanumeric and hyphens. |
| **Description** | Plain-language description of your project. Claude uses this to customise the template — be specific about domain, data models, key features, and constraints. |
| **Export method** | How you want to receive the output: **ZIP download**, **Push to GitHub**, or **Push to GitLab**. OAuth must be configured for the provider options to appear. |

Click **Generate** to start streaming. You will be taken to the Preview page automatically.

---

### 3. Preview

The generated files stream in real time. The page has three panels:

**File tree (left)**
Lists every file in the generated template. Click a file to open it in the viewer. New files appear as they finish streaming.

**File viewer (centre)**
Shows the selected file with syntax highlighting. Files can be edited in-browser — click the edit icon to open the inline editor.

**Refinement panel (right)**
Multi-turn conversation panel. Type a follow-up instruction (e.g. "add JWT authentication", "switch to SQLite for the test suite", "rename the main entity from User to Account") and click **Refine**. Claude updates only the affected files; unchanged files stay as-is. You can refine as many times as you like within the `MAX_HISTORY_CHARS` budget (default 600 k characters).

The conversation history is shown below the input so you can track what was requested in each turn.

---

### 4. Export

Once you are satisfied with the output, export it:

**ZIP download**
Click **Download ZIP**. The server packages all generated files into a `.zip` archive and triggers a browser download.

**Push to GitHub / GitLab**
If OAuth is configured and you authorised the app, click **Create repository**. Enter a repository name, choose public or private, and click **Push**. The server creates the repository via the provider API and pushes all generated files in a single commit.

After a successful push, a link to the new repository is shown.

---

### 5. Share

After exporting, a shareable link is generated. Copy the link and send it to a colleague — they will see a read-only view of your generated template with the same file tree and viewer.

---

### 6. Workspace

The **Workspace** page (accessible from the navigation) lists previous sessions stored in your browser's IndexedDB. Click a session to restore the file tree and continue refining. Sessions are local to your browser — they are not stored on the server.

---

## Dark mode

A toggle in the top-right corner switches between light and dark themes. The preference is persisted in `localStorage`.

---

## Tips

- **Be specific in the description.** Claude performs better when you name concrete entities, routes, and behaviours rather than abstract goals.
- **Use refinement for incremental changes.** Each refinement turn has access to the full conversation history, so you can refer to previous requests.
- **Edit files inline.** The in-browser editor is useful for small tweaks without needing another LLM call.
- **Save your ZIP early.** The Workspace page stores sessions in IndexedDB, which can be cleared by the browser. Download a ZIP as a backup if the work matters.
