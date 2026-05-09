export function FileIcon({ filename }) {
  /* v8 ignore next */
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  return <span className={`file-icon ext-${ext}`} aria-hidden="true" />;
}
