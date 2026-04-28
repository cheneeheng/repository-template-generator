import archiver from 'archiver';

export function createZip(fileTree) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip');
    const chunks = [];

    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    for (const { path, content } of fileTree) {
      archive.append(content, { name: path });
    }

    archive.finalize();
  });
}
