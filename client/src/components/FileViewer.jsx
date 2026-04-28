import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/esm/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

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
  if (!file) {
    return <div style={{ padding: '1rem', color: '#888' }}>Select a file to view.</div>
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{ background: '#f3f4f6', padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#555', borderBottom: '1px solid #e5e7eb' }}>
        {file.path}
      </div>
      <SyntaxHighlighter
        language={inferLang(file.path)}
        style={oneLight}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.85rem' }}
        showLineNumbers
      >
        {file.content || ''}
      </SyntaxHighlighter>
    </div>
  )
}
