import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import FileEditor from './FileEditor.jsx'

describe('FileEditor', () => {
  it('renders textarea with correct initial content', () => {
    render(<FileEditor file={{ path: 'README.md', content: '# Hello' }} onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /file editor/i })).toHaveValue('# Hello')
  })

  it('shows the filename in the header bar', () => {
    render(<FileEditor file={{ path: 'src/index.js', content: '' }} onChange={vi.fn()} />)
    expect(screen.getByText('src/index.js')).toBeInTheDocument()
  })

  it('calls onChange with updated content when user types', async () => {
    const onChange = vi.fn()
    render(<FileEditor file={{ path: 'a.js', content: 'hello' }} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox', { name: /file editor/i }), '!')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toContain('hello')
  })

  it('renders placeholder when file is null', () => {
    render(<FileEditor file={null} onChange={vi.fn()} />)
    expect(screen.getByText(/select a file to edit/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /file editor/i })).not.toBeInTheDocument()
  })
})
