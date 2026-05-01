import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import FileTree from '../components/FileTree.jsx'
import FileViewer from '../components/FileViewer.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'
import { streamGenerate } from '../lib/streamGenerate.js'
import './PreviewPage.css'

export default function PreviewPage() {
  const navigate = useNavigate()
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const projectConfig = useStore((s) => s.projectConfig)
  const setFileTree = useStore((s) => s.setFileTree)

  const [streamState, setStreamState] = useState({
    status: 'streaming',
    files: [],
    fileTree: null,
    error: null,
    tokenCount: 0,
  })
  const [activeFile, setActiveFile] = useState(null)

  const started = useRef(false)
  const readerRef = useRef(null)

  useEffect(() => {
    if (!selectedTemplate || !projectConfig) {
      navigate('/')
      return
    }

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
          setStreamState((prev) => ({ ...prev, tokenCount: prev.tokenCount + chunk.length }))
        },
        onFileDone(path, content) {
          setStreamState((prev) => ({
            ...prev,
            files: [...prev.files, { path, content }],
          }))
        },
        onDone(tree) {
          setFileTree(tree)
          setStreamState((prev) => ({ ...prev, status: 'done', fileTree: tree }))
          setActiveFile((prev) => prev ?? (tree[0] ?? null))
        },
        onError(msg) {
          setStreamState((prev) => ({ ...prev, status: 'error', error: msg }))
        },
      }
    )

    return () => {
      readerRef.current?.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { status, files, fileTree, error, tokenCount } = streamState

  if (status === 'streaming') {
    return (
      <div>
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
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? '' : 's'} complete`
              : 'Starting...'}
            <span style={{ marginLeft: '1rem', fontSize: '0.8em', color: '#999' }}>
              {tokenCount} chars received
            </span>
          </p>
        </div>
        {files.length > 0 && (
          <div className="preview-layout">
            <div className="preview-layout__tree">
              <FileTree
                files={files}
                onSelect={setActiveFile}
                activeFile={activeFile}
              />
            </div>
            <div className="preview-layout__viewer">
              <FileViewer file={activeFile} />
            </div>
          </div>
        )}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        <ErrorToast message={error} onDismiss={() => setStreamState((p) => ({ ...p, error: null }))} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
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
    <div>
      <h1>Preview</h1>
      <div className="preview-layout">
        <div className="preview-layout__tree">
          <FileTree files={fileTree} onSelect={setActiveFile} activeFile={activeFile} />
        </div>
        <div className="preview-layout__viewer">
          <FileViewer file={activeFile} />
        </div>
      </div>
      <button
        onClick={() => navigate('/export')}
        style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem' }}
      >
        Proceed to Export
      </button>
      <ErrorToast message={error} onDismiss={() => setStreamState((p) => ({ ...p, error: null }))} />
    </div>
  )
}
