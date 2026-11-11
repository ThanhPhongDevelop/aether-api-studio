/** Mirrors the API's password policy (backend/src/models/user.model.ts). */
export const PASSWORD_RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: '8 to 72 characters', test: (value) => value.length >= 8 && value.length <= 72 },
  { label: 'A lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'A number', test: (value) => /\d/.test(value) },
  { label: 'A symbol', test: (value) => /[^A-Za-z0-9]/.test(value) },
];
