import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ErrorToast } from './ErrorToast.jsx';

describe('ErrorToast', () => {
  it('renders the message', () => {
    render(<ErrorToast message="Something went wrong" onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders nothing when message is null', () => {
    const { container } = render(<ErrorToast message={null} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onDismiss after 5 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ErrorToast message="oops" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls onDismiss on dismiss button click', async () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="oops" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
