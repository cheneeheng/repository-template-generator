import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const defaultHandlers = [
  http.get('/api/config', () => HttpResponse.json({ llmEnabled: true })),
  http.get('/api/templates', () => HttpResponse.json([])),
  http.get('/api/auth/providers', () => HttpResponse.json({ github: false, gitlab: false })),
];

export const server = setupServer(...defaultHandlers);
