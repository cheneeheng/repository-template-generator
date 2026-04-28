import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import FileTree from '../components/FileTree.jsx'
import FileViewer from '../components/FileViewer.jsx'

const FALLBACK = [{ path: 'README.md', content: '# my-project\n\nGenerated project scaffold.' }]

export default function PreviewPage() {
  const navigate = useNavigate()
  const fileTree = useStore((s) => s.fileTree)
  const files = fileTree && fileTree.length > 0 ? fileTree : FALLBACK
  const [activeFile, setActiveFile] = useState(files[0])

  useEffect(() => {
    if (!fileTree) navigate('/')
  }, [fileTree, navigate])

  useEffect(() => {
    setActiveFile(files[0])
  }, [fileTree])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Preview</h1>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ width: '240px', flexShrink: 0 }}>
          <FileTree files={files} onSelect={setActiveFile} activeFile={activeFile} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FileViewer file={activeFile} />
        </div>
      </div>
      <button
        onClick={() => navigate('/export')}
        style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem' }}
      >
        Proceed to Export
      </button>
    </div>
  )
}
