import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';
import { createTestStore } from './helpers';

describe('App', () => {
  it('muestra la interfaz en español', () => {
    const { store } = createTestStore();
    render(<App store={store} />);
    expect(screen.getAllByText('Simulador de control eléctrico').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeTruthy();
    expect(screen.getByTestId('mode').textContent).toBe('EDICIÓN');
  });
});
