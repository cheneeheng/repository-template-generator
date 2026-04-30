import { Octokit } from '@octokit/rest';

export async function createRepo({ token, owner, repoName, description, isPrivate, fileTree }) {
  const octokit = new Octokit({ auth: token });

  const { data: me } = await octokit.rest.users.getAuthenticated();
  const isOrg = owner && owner !== me.login;

  const { data } = isOrg
    ? await octokit.rest.repos.createInOrg({
        org: owner,
        name: repoName,
        description: description ?? '',
        private: isPrivate ?? false,
        auto_init: false,
      })
    : await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        description: description ?? '',
        private: isPrivate ?? false,
        auto_init: false,
      });

  const repoOwner = data.owner.login;

  for (const file of fileTree) {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: file.path,
      message: `add ${file.path}`,
      content: Buffer.from(file.content).toString('base64'),
    });
  }

  return { repoUrl: data.html_url };
}
