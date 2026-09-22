/**
 * Prohíbe texto de interfaz escrito a mano en JSX: todo texto visible debe salir de t()
 * (app/i18n). Así la UI queda lista para otros idiomas (R2 §26).
 */
const LETTER = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt']);

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Texto de UI literal en JSX; usar t() de app/i18n' },
    messages: { literal: 'Texto de UI literal en JSX: usá t() de app/i18n.' },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        if (LETTER.test(node.value)) context.report({ node, messageId: 'literal' });
      },
      JSXAttribute(node) {
        const name = typeof node.name.name === 'string' ? node.name.name : '';
        if (!TEXT_ATTRIBUTES.has(name) || !node.value) return;
        if (node.value.type === 'Literal' && typeof node.value.value === 'string' && LETTER.test(node.value.value)) {
          context.report({ node, messageId: 'literal' });
        }
      },
    };
  },
};
