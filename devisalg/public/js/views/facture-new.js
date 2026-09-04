import { docEditor, attachDocEditor } from './docEditor.js';
export const title = () => window.t('Créer une Facture', 'إنشاء فاتورة');

export async function render() {
  const editor = docEditor({ kind: 'facture', prefill: { items: [] }, backPath: '/app/factures' });
  return editor;
}

export async function after() {
  attachDocEditor({ kind: 'facture', prefill: { items: [] }, backPath: '/app/factures', onSaved: (res) => navigate('/app/factures/' + res.id) });
}
