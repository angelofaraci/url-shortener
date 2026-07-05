const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateRandomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * ALPHANUMERIC.length);
    code += ALPHANUMERIC[index];
  }
  return code;
}
