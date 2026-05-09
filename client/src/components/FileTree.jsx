import { useState } from 'react'
import { SkeletonBlock } from './SkeletonBlock.jsx'
import './FileTree.css'

function buildTree(files) {
  const tree = {}
  for (const file of files) {
    const parts = file.path.split('/')
    let node = tree
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { __children: {} }
      node = node[parts[i]].__children
    }
    node[parts[parts.length - 1]] = { __file: file }
  }
  return tree
}

function TreeNode({ name, node, onSelect, activeFile, depth }) {
  const isFile = !!node.__file
  const [open, setOpen] = useState(true)
  const isActive = isFile && activeFile && activeFile.path === node.__file.path

  if (isFile) {
    return (
      <button
        className={`file-tree__entry${isActive ? ' is-active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.__file)}
      >
        {name}
      </button>
    )
  }

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          paddingTop: '3px',
          paddingBottom: '3px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.875rem',
          userSelect: 'none',
          color: 'var(--color-text)',
        }}
      >
        {open ? '▾' : '▸'} {name}
      </div>
      {open &&
        Object.entries(node.__children || {}).map(([childName, childNode]) => (
          <TreeNode
            key={childName}
            name={childName}
            node={childNode}
            onSelect={onSelect}
            activeFile={activeFile}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export default function FileTree({ files, onSelect, activeFile, streaming = false }) {
  const tree = buildTree(files)

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '0.5rem',
      background: 'var(--color-bg-surface)',
    }}>
      {Object.entries(tree).map(([name, node]) => (
        <TreeNode
          key={name}
          name={name}
          node={node}
          onSelect={onSelect}
          activeFile={activeFile}
          depth={0}
        />
      ))}
      {streaming && (
        <>
          <SkeletonBlock height="1rem" width="70%" style={{ margin: '0.4rem 0' }} />
          <SkeletonBlock height="1rem" width="55%" style={{ margin: '0.4rem 0' }} />
          <SkeletonBlock height="1rem" width="80%" style={{ margin: '0.4rem 0' }} />
        </>
      )}
    </div>
  )
}
