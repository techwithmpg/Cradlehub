export const PASSWORD_REQUIREMENT_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, and a number.";

export const PASSWORD_REQUIREMENTS = [
  "At least 8 characters",
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one number",
] as const;

export function getPasswordValidationError(password: string): string | null {
  if (password.length < 8) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[A-Z]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[a-z]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_REQUIREMENT_MESSAGE;
  return null;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationError(password) === null;
}
