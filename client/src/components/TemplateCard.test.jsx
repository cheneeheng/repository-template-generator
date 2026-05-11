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

  it('renders without tags when template has no tags property', () => {
    const noTagsTemplate = { id: 'x', label: 'X', description: 'D', files: [] };
    render(<TemplateCard template={noTagsTemplate} onSelect={vi.fn()} />);
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('shows default document icon for unknown file extensions', async () => {
    const txtTemplate = { ...template, files: ['notes.txt'] };
    render(<TemplateCard template={txtTemplate} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /show files/i }));
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('shows docker icon for Dockerfile in file list', async () => {
    const dockerTemplate = { ...template, files: ['Dockerfile', 'src/app.js'] };
    render(<TemplateCard template={dockerTemplate} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /show files/i }));
    // The Dockerfile entry renders the docker whale emoji
    expect(screen.getByText('Dockerfile')).toBeInTheDocument();
  });

  it('shows docker icon for dockerfile.dev variant', async () => {
    const dockerTemplate = { ...template, files: ['dockerfile.dev', 'README.md'] };
    render(<TemplateCard template={dockerTemplate} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /show files/i }));
    expect(screen.getByText('dockerfile.dev')).toBeInTheDocument();
  });

  it('sets aria-expanded correctly', async () => {
    render(<TemplateCard template={template} onSelect={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /show files/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
