import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store.js'
import FileTree from '../components/FileTree.jsx'
import FileEditor from '../components/FileEditor.jsx'
import { ErrorToast } from '../components/ErrorToast.jsx'
import { RefinementPanel } from '../components/RefinementPanel.jsx'
import { RefinementHistory } from '../components/RefinementHistory.jsx'
import { streamGenerate } from '../lib/streamGenerate.js'
import { streamRefine } from '../lib/streamRefine.js'
import { truncateHistory } from '../lib/truncateHistory.js'
import { useAppConfig } from '../context/AppConfigContext.jsx'
import './PreviewPage.css'

export default function PreviewPage() {
  const navigate = useNavigate()
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const projectConfig = useStore((s) => s.projectConfig)
  const storeSetFileTree = useStore((s) => s.setFileTree)

  const [streamState, setStreamState] = useState({
    status: 'streaming',
    files: [],
    error: null,
    tokenCount: 0,
    rateLimitWait: null,
  })
  const [snapshots, setSnapshots] = useState([])
  const [activeSnapshot, setActiveSnapshot] = useState(0)
  const [activeFilePath, setActiveFilePath] = useState(null)
  const [history, setHistory] = useState([])

  const { llmEnabled } = useAppConfig()
  const started = useRef(false)
  const readerRef = useRef(null)

  // fileTree is derived from the active snapshot
  const fileTree = snapshots[activeSnapshot]?.fileTree ?? null

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
          storeSetFileTree(tree)
          setSnapshots([{ id: 0, label: 'Generated', fileTree: tree.map(f => ({ ...f })), timestamp: Date.now() }])
          setActiveSnapshot(0)
          setStreamState((prev) => ({ ...prev, status: 'done' }))
          setActiveFilePath((prev) => prev ?? (tree[0]?.path ?? null))
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

  function handleEdit(newContent) {
    setSnapshots((prev) =>
      prev.map((snap, i) =>
        i === activeSnapshot
          ? { ...snap, fileTree: snap.fileTree.map(f => f.path === activeFilePath ? { ...f, content: newContent } : f) }
          : snap
      )
    )
  }

  function handleRevert(index) {
    setActiveSnapshot(index)
  }

  function handleRefine(instruction) {
    const userTurn = { role: 'user', content: instruction }
    const nextHistory = truncateHistory([...history, userTurn])

    setHistory(nextHistory)
    setStreamState((prev) => ({ ...prev, status: 'streaming', files: [], tokenCount: 0, error: null }))

    streamRefine(
      { fileTree, history, instruction },
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
          storeSetFileTree(updatedTree)
          const newSnapshotIndex = snapshots.length
          setSnapshots((prev) => {
            const newSnapshot = {
              id: prev.length,
              label: `Refinement ${prev.length}`,
              fileTree: updatedTree.map(f => ({ ...f })),
              timestamp: Date.now(),
            }
            return [...prev, newSnapshot]
          })
          setActiveSnapshot(newSnapshotIndex)
          setStreamState((prev) => ({ ...prev, status: 'done' }))
          setActiveFilePath((prev) => prev ?? (updatedTree[0]?.path ?? null))
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
    setStreamState({ status: 'streaming', files: [], error: null, tokenCount: 0, rateLimitWait: null })
    setSnapshots([])
    setActiveSnapshot(0)
    setActiveFilePath(null)
    setHistory([])
  }

  const { status, files, error, tokenCount, rateLimitWait } = streamState
  const activeFile = fileTree?.find((f) => f.path === activeFilePath) ?? null

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
      <h1>
        {status === 'streaming' ? 'Generating...' : 'Preview'}
        {status !== 'streaming' && !llmEnabled && (
          <span className="badge badge--neutral" aria-label="LLM bypass mode active" style={{ marginLeft: '0.75rem' }}>
            Raw template
          </span>
        )}
      </h1>
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
              onSelect={(file) => setActiveFilePath(file.path)}
              activeFile={activeFile}
              streaming={status === 'streaming'}
            />
          </div>
          <div className="preview-layout__editor">
            <FileEditor file={activeFile} onChange={handleEdit} />
          </div>
        </div>
      )}

      {(status === 'done' || (status === 'streaming' && fileTree !== null)) && (
        <>
          <RefinementPanel
            onSubmit={handleRefine}
            disabled={status === 'streaming' || !llmEnabled}
            disabledReason={!llmEnabled ? 'Refinement requires an Anthropic API key.' : undefined}
          />
          <RefinementHistory
            snapshots={snapshots}
            activeSnapshot={activeSnapshot}
            onRevert={handleRevert}
          />
          {status === 'done' && (
            <button
              onClick={() => navigate('/export')}
              style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem' }}
            >
              Proceed to Export
            </button>
          )}
        </>
      )}

      <ErrorToast message={error === 'rate_limited' || error === 'context_overflow' ? null : error} onDismiss={() => setStreamState((p) => ({ ...p, error: null }))} />
    </div>
  )
}
