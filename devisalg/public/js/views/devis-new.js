import { docEditor, attachDocEditor } from './docEditor.js';
export const title = () => window.t('Créer un Devis', 'إنشاء عرض سعر');

export async function render() {
  // Check for prefill from conversation extraction
  let prefill = { items: [] };
  try { prefill = JSON.parse(sessionStorage.getItem('devisPrefill') || 'null') || { items: [] }; } catch {}
  window.DOC_PREFILL = prefill;
  const editor = docEditor({
    kind: 'devis',
    prefill,
    backPath: '/app/devis',
  });
  return editor + (prefill.conversation_id ? `
    <div class="card mt-12" style="padding:12px;background:var(--green-soft);border-color:#bbe7c6">
      <b>🤖 ${window.t('IA a détecté une demande de devis', 'اكتشف الذكاء الاصطناعي طلب عرض سعر')}:</b>
      <span class="small">${window.t('Le formulaire est pré-rempli avec les infos de la conversation.', 'البيانات معبأة من المحادثة.')}</span>
    </div>` : '');
}

export async function after() {
  const prefill = window.DOC_PREFILL || { items: [] };
  attachDocEditor({
    kind: 'devis',
    prefill,
    backPath: '/app/devis',
    onSaved: (res) => { navigate('/app/devis/' + res.id); },
  });
}
