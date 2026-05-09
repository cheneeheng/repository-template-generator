import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplateCard from './TemplateCard.jsx';

const template = {
  id: 'react-express',
  label: 'React + Express',
  description: 'A fullstack starter',
  tags: ['react', 'express'],
  files: ['frontend/App.jsx', 'backend/index.js', 'README.md'],
};

describe('TemplateCard', () => {
  it('renders label and description', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByText('React + Express')).toBeInTheDocument();
    expect(screen.getByText('A fullstack starter')).toBeInTheDocument();
  });

  it('renders all tags', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('express')).toBeInTheDocument();
  });

  it('shows file count in toggle button', () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /show files \(3\)/i })).toBeInTheDocument();
  });

  it('expands file list on toggle click', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /show files/i }));
    expect(screen.getByText('frontend/App.jsx')).toBeInTheDocument();
  });

  it('collapses file list on second toggle click', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /show files/i });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: /hide files/i }));
    expect(screen.queryByText('frontend/App.jsx')).not.toBeInTheDocument();
  });

  it('calls onSelect when "Use this template" is clicked', async () => {
    const onSelect = vi.fn();
    render(<TemplateCard template={template} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /use this template/i }));
    expect(onSelect).toHaveBeenCalledWith(template);
  });

  it('sets aria-expanded correctly', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /show files/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
