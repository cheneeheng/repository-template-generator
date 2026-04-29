import { Octokit } from '@octokit/rest';

export async function createRepo({ token, owner, repoName, description, fileTree }) {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    description: description ?? '',
    private: false,
    auto_init: false,
  });

  for (const file of fileTree) {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: file.path,
      message: `add ${file.path}`,
      content: Buffer.from(file.content).toString('base64'),
    });
  }

  return { repoUrl: data.html_url };
}
