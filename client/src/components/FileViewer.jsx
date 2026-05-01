import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const EXT_LANG = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  css: 'css',
  html: 'html',
  xml: 'xml',
}

function inferLang(path) {
  if (!path) return 'text'
  const ext = path.split('.').pop().toLowerCase()
  return EXT_LANG[ext] || 'text'
}

export default function FileViewer({ file }) {
  const isDark = document.documentElement.classList.contains('dark')
  const highlightTheme = isDark ? atomDark : oneLight

  if (!file) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
        Select a file to view.
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{
        background: 'var(--color-bg-surface)',
        padding: '0.4rem 0.75rem',
        fontSize: '0.8rem',
        color: 'var(--color-text-muted)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {file.path}
      </div>
      <SyntaxHighlighter
        language={inferLang(file.path)}
        style={highlightTheme}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.85rem' }}
        showLineNumbers
      >
        {file.content || ''}
      </SyntaxHighlighter>
    </div>
  )
}
