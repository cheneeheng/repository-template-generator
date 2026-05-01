import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import FileTree from '../components/FileTree.jsx'
import FileViewer from '../components/FileViewer.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'
import { RefinementPanel } from '../components/RefinementPanel.jsx'
import { streamGenerate } from '../lib/streamGenerate.js'
import { streamRefine } from '../lib/streamRefine.js'
import { truncateHistory } from '../lib/truncateHistory.js'
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
    rateLimitWait: null,
  })
  const [activeFile, setActiveFile] = useState(null)
  const [history, setHistory] = useState([])

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
        onRateLimit(reset) {
          const waitMin = reset
            ? Math.ceil((reset * 1000 - Date.now()) / 60000)
            : 15
          setStreamState((prev) => ({
            ...prev,
            status: 'error',
            error: 'rate_limited',
            rateLimitWait: waitMin,
          }))
        },
      }
    )

    return () => {
      readerRef.current?.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefine(instruction) {
    const userTurn = { role: 'user', content: instruction }
    const nextHistory = truncateHistory([...history, userTurn])

    setHistory(nextHistory)
    setStreamState((prev) => ({ ...prev, status: 'streaming', files: [], tokenCount: 0, error: null }))

    streamRefine(
      { fileTree: streamState.fileTree, history: nextHistory, instruction },
      {
        onFileDone(path, content) {
          setStreamState((prev) => ({
            ...prev,
            files: [...prev.files, { path, content }],
          }))
        },
        onDone(updatedTree) {
          setHistory((prev) => [
            ...prev,
            { role: 'assistant', content: JSON.stringify(updatedTree) },
          ])
          setFileTree(updatedTree)
          setStreamState((prev) => ({ ...prev, status: 'done', fileTree: updatedTree }))
          setActiveFile((prev) => prev ?? (updatedTree[0] ?? null))
        },
        onError(msg) {
          setStreamState((prev) => ({ ...prev, status: 'error', error: msg }))
        },
        onRateLimit(reset) {
          const waitMin = reset
            ? Math.ceil((reset * 1000 - Date.now()) / 60000)
            : 15
          setStreamState((prev) => ({
            ...prev,
            status: 'error',
            error: 'rate_limited',
            rateLimitWait: waitMin,
          }))
        },
      }
    )
  }

  function clearAllState() {
    setStreamState({ status: 'streaming', files: [], fileTree: null, error: null, tokenCount: 0, rateLimitWait: null })
    setHistory([])
    setActiveFile(null)
  }

  const { status, files, fileTree, error, tokenCount, rateLimitWait } = streamState

  if (status === 'error') {
    return (
      <div>
        <h1>Generation Failed</h1>
        {error === 'rate_limited' ? (
          <div className="error-state error-state--rate-limit" role="alert">
            <p>You've reached the request limit.</p>
            <p>Try again in ~{rateLimitWait} minute{rateLimitWait !== 1 ? 's' : ''}.</p>
          </div>
        ) : (
          <p style={{ color: 'var(--color-error)' }}>
            {error === 'context_overflow'
              ? "Conversation too long — further refinement isn't possible. Export what you have, or start over with a new generation."
              : error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/configure')} style={{ padding: '0.5rem 1.5rem' }}>
            Back
          </button>
          <button
            onClick={() => { clearAllState(); navigate('/') }}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            ← Start over
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1>{status === 'streaming' ? 'Generating...' : 'Preview'}</h1>
      {status === 'streaming' && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              height: '8px',
              background: 'var(--color-bg-surface)',
              borderRadius: '4px',
              overflow: 'hidden',
              maxWidth: '400px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                background: 'var(--color-accent)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? '' : 's'} complete`
              : 'Starting...'}
            <span style={{ marginLeft: '1rem', fontSize: '0.8em', color: 'var(--color-text-muted)' }}>
              {tokenCount} chars received
            </span>
          </p>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      )}

      {(files.length > 0 || status === 'done') && (
        <div className="preview-layout">
          <div className="preview-layout__tree">
            <FileTree
              files={status === 'done' ? fileTree : files}
              onSelect={setActiveFile}
              activeFile={activeFile}
              streaming={status === 'streaming'}
            />
          </div>
          <div className="preview-layout__viewer">
            <FileViewer file={activeFile} />
          </div>
        </div>
      )}

      {status === 'done' && (
        <>
          <RefinementPanel onSubmit={handleRefine} disabled={false} />
          <button
            onClick={() => navigate('/export')}
            style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem' }}
          >
            Proceed to Export
          </button>
        </>
      )}

      <ErrorToast message={error === 'rate_limited' || error === 'context_overflow' ? null : error} onDismiss={() => setStreamState((p) => ({ ...p, error: null }))} />
    </div>
  )
}
