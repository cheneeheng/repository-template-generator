export function FileIcon({ filename }) {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  return <span className={`file-icon ext-${ext}`} aria-hidden="true" />;
}
