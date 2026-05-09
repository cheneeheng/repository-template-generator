import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RefinementPanel } from './RefinementPanel.jsx';

describe('RefinementPanel', () => {
  it('renders input and button when not disabled', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refine/i })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed value on button click', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(screen.getByRole('textbox'), '  make it TypeScript  ');
    await userEvent.click(screen.getByRole('button', { name: /refine/i }));
    expect(onSubmit).toHaveBeenCalledWith('make it TypeScript');
  });

  it('calls onSubmit on Enter key', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(screen.getByRole('textbox'), 'add tests{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('add tests');
  });

  it('clears input after submit', async () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello{Enter}');
    expect(input).toHaveValue('');
  });

  it('does not call onSubmit when disabled', async () => {
    const onSubmit = vi.fn();
    render(<RefinementPanel onSubmit={onSubmit} disabled={true} />);
    const input = screen.getByRole('textbox');
    // input is disabled so type events are ignored, but try pressing Enter
    await userEvent.type(input, 'hello{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows disabledReason instead of input row', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={true} disabledReason="LLM unavailable" />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('LLM unavailable')).toBeInTheDocument();
  });

  it('keeps submit button disabled when input is empty', () => {
    render(<RefinementPanel onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: /refine/i })).toBeDisabled();
  });

  it('does not call onSubmit when disabled even with a non-empty value', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<RefinementPanel onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    // Now disable the panel while value is still in state
    rerender(<RefinementPanel onSubmit={onSubmit} disabled={true} />);
    // Fire keyDown directly on the now-disabled input to trigger handleSubmit
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', code: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
