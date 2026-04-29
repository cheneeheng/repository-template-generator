import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import FileTree from '../components/FileTree.jsx'
import FileViewer from '../components/FileViewer.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'
import { streamGenerate } from '../lib/streamGenerate.js'

export default function PreviewPage() {
  const navigate = useNavigate()
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const projectConfig = useStore((s) => s.projectConfig)
  const setFileTree = useStore((s) => s.setFileTree)

  // status: 'streaming' | 'done' | 'error'
  // Note: ITER_01 spec includes an 'idle' state with a Generate button, but
  // ConfigurePage owns the form + navigation trigger, so streaming auto-starts here.
  const [status, setStatus] = useState('streaming')
  const [tokenCount, setTokenCount] = useState(0)
  const [completedPaths, setCompletedPaths] = useState([])
  const [fileTree, setLocalFileTree] = useState(null)
  const [activeFile, setActiveFile] = useState(null)
  const [error, setError] = useState(null)

  const started = useRef(false)
  const readerRef = useRef(null)

  useEffect(() => {
    if (!selectedTemplate || !projectConfig) {
      navigate('/')
      return
    }

    // Guard against StrictMode double-invocation in dev
    if (started.current) return
    started.current = true

    streamGenerate(
      {
        templateId: selectedTemplate.id,
        projectName: projectConfig.projectName,
        description: projectConfig.description,
      },
      {
        onReader(reader) {
          readerRef.current = reader
        },
        onDelta(chunk) {
          setTokenCount((n) => n + chunk.length)
        },
        onFileDone(path) {
          setCompletedPaths((prev) => [...prev, path])
        },
        onDone(tree) {
          setLocalFileTree(tree)
          setFileTree(tree)
          setActiveFile(tree[0] ?? null)
          setStatus('done')
        },
        onError(msg) {
          setError(msg)
          setStatus('error')
        },
      }
    )

    return () => {
      readerRef.current?.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'streaming') {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Generating...</h1>
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              height: '8px',
              background: '#eee',
              borderRadius: '4px',
              overflow: 'hidden',
              maxWidth: '400px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                background: '#0070f3',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {tokenCount} chars received
          </p>
        </div>
        {completedPaths.length > 0 && (
          <div>
            <p style={{ fontWeight: 600 }}>Files completed:</p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {completedPaths.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <ErrorToast message={error} onDismiss={() => setError(null)} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Generation Failed</h1>
        <p style={{ color: '#c0392b' }}>{error}</p>
        <button onClick={() => navigate('/configure')} style={{ padding: '0.5rem 1.5rem' }}>
          Back
        </button>
      </div>
    )
  }

  // done
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Preview</h1>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ width: '240px', flexShrink: 0 }}>
          <FileTree files={fileTree} onSelect={setActiveFile} activeFile={activeFile} />
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
      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  )
}
