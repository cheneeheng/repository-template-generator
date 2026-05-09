import './FileEditor.css'

export default function FileEditor({ file, onChange }) {
  if (!file) {
    return (
      <div className="file-editor file-editor--empty">
        Select a file to edit.
      </div>
    )
  }

  return (
    <div className="file-editor">
      <div className="file-editor__header">{file.path}</div>
      <textarea
        className="file-editor__textarea"
        aria-label="File editor"
        value={file.content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  )
}
