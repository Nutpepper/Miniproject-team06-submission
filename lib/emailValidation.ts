const ALLOWED_EMAIL_DOMAINS = ['lamduan.mfu.ac.th', 'mfu.ac.th'] as const;

export function isAllowedEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const domain = normalizedEmail.slice(atIndex + 1);
  return ALLOWED_EMAIL_DOMAINS.includes(domain as (typeof ALLOWED_EMAIL_DOMAINS)[number]);
}

export const allowedEmailHint = 'Use your MFU email (@lamduan.mfu.ac.th or @mfu.ac.th).';
