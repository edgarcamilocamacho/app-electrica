import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

describe('App', () => {
  it('muestra el título en español', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Simulador de control eléctrico' })).toBeTruthy();
  });
});
