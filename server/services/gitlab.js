import createError from 'http-errors';

function gitlabBase() {
  return process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
}

export async function createRepo({ token, owner, repoName, description, isPrivate, fileTree }) {
  const base = gitlabBase();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const projectRes = await fetch(`${base}/api/v4/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: description ?? '',
      visibility: isPrivate ? 'private' : 'public',
      initialize_with_readme: false,
    }),
  });

  if (!projectRes.ok) {
    if (projectRes.status === 401) throw createError(401, 'GitLab authentication expired');
    const err = await projectRes.text();
    throw new Error(`GitLab project creation failed: ${err}`);
  }

  const project = await projectRes.json();

  for (const file of fileTree) {
    const encodedPath = encodeURIComponent(file.path);
    const fileRes = await fetch(
      `${base}/api/v4/projects/${project.id}/repository/files/${encodedPath}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch: 'main',
          content: file.content,
          commit_message: `add ${file.path}`,
        }),
      }
    );

    if (!fileRes.ok) {
      if (fileRes.status === 401) throw createError(401, 'GitLab authentication expired');
      const err = await fileRes.text();
      throw new Error(`GitLab file create failed for ${file.path}: ${err}`);
    }
  }

  return { repoUrl: project.web_url };
}
