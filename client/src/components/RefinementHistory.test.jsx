import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RefinementHistory } from './RefinementHistory.jsx';

function makeSnap(id, label, minsAgo = 0) {
  return { id, label, fileTree: [], timestamp: Date.now() - minsAgo * 60_000 };
}

describe('RefinementHistory', () => {
  const onRevert = vi.fn();
  let user;

  beforeEach(() => {
    vi.useFakeTimers();
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders nothing when fewer than 2 snapshots', () => {
    const { container } = render(
      <RefinementHistory snapshots={[makeSnap(0, 'Generated')]} activeSnapshot={0} onRevert={onRevert} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one entry per snapshot', () => {
    const snaps = [makeSnap(0, 'Generated'), makeSnap(1, 'Refinement 1')];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={1} onRevert={onRevert} />);
    expect(screen.getByRole('button', { name: /Generated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refinement 1/i })).toBeInTheDocument();
  });

  it('marks the active snapshot with aria-pressed', () => {
    const snaps = [makeSnap(0, 'Generated'), makeSnap(1, 'Refinement 1')];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={0} onRevert={onRevert} />);
    expect(screen.getByRole('button', { name: /Generated/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Refinement 1/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onRevert with correct index on click', () => {
    const snaps = [makeSnap(0, 'Generated'), makeSnap(1, 'Refinement 1')];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={1} onRevert={onRevert} />);
    fireEvent.click(screen.getByRole('button', { name: /Generated/i }));
    expect(onRevert).toHaveBeenCalledWith(0);
  });

  it('labels latest active snapshot as Current', () => {
    const snaps = [makeSnap(0, 'Generated'), makeSnap(1, 'Refinement 1')];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={1} onRevert={onRevert} />);
    expect(screen.getByRole('button', { name: /Refinement 1 \(Current\)/i })).toBeInTheDocument();
  });

  it('renders "just now" for recent snapshots', () => {
    const snaps = [makeSnap(0, 'Generated'), makeSnap(1, 'Refinement 1', 0)];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={1} onRevert={onRevert} />);
    expect(screen.getAllByText('just now').length).toBeGreaterThan(0);
  });

  it('renders relative time for older snapshots', () => {
    const snaps = [makeSnap(0, 'Generated', 5), makeSnap(1, 'Refinement 1', 0)];
    render(<RefinementHistory snapshots={snaps} activeSnapshot={1} onRevert={onRevert} />);
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
  });
});
