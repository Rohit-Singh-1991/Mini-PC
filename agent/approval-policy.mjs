const RISKY_WORDS = /\b(submit|pay|payment|purchase|buy now|delete|remove|accept|consent|confirm|finalize|register now|apply now|send now|transfer|sign|authorize|approve|book now|otp|captcha|verification|two.factor|mfa|log.?out|unsubscribe|publish|upload|share|save|update|invite|reset|cancel|withdraw|disconnect|checkout|place order|complete order|continue|proceed|revoke|execute|run now|create account|close account|apply|login|log in|sign in|subscribe|verify|authenticate|enable|disable)\b/i;

/**
 * Conservative action policy shared by the runtime and regression tests.
 * Browser links are auto-clickable only when they are ordinary public navigations;
 * non-link controls, form actions and ambiguous links always pause for approval.
 */
export function actionNeedsApproval({ action, mode, targetText = '', clickInfo = null }) {
  const tool = action?.tool || '';
  const actionText = [
    targetText,
    action?.target,
    action?.value,
    action?.summary,
    action?.key,
    clickInfo?.text,
    clickInfo?.ariaLabel,
    clickInfo?.title,
    clickInfo?.href,
    clickInfo?.formAction
  ].filter(Boolean).join(' ');

  if (mode === 'pc' && ['pc_click', 'pc_type', 'pc_key'].includes(tool)) return true;
  if (RISKY_WORDS.test(actionText) && ['click', 'pc_click', 'pc_type', 'pc_key', 'fill', 'select'].includes(tool)) return true;

  if (mode === 'browser' && tool === 'click') {
    if (!clickInfo) return true;
    if (clickInfo.tag !== 'a' || clickInfo.role === 'button' || clickInfo.formAssociated || clickInfo.submitType || clickInfo.disabled) return true;
    if (!clickInfo.href || !/^https?:\/\//i.test(clickInfo.href)) return true;
  }
  return false;
}
