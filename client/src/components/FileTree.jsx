import { useState } from 'react'

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
      <div
        onClick={() => onSelect(node.__file)}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          paddingTop: '3px',
          paddingBottom: '3px',
          cursor: 'pointer',
          background: isActive ? '#dbeafe' : 'transparent',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: isActive ? '#1d4ed8' : '#333',
        }}
      >
        {name}
      </div>
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

export default function FileTree({ files, onSelect, activeFile }) {
  const tree = buildTree(files)

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem', background: '#fafafa' }}>
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
    </div>
  )
}
