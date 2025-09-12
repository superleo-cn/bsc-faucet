export function normalizeAddress(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('invalid_address');
  return addr.toLowerCase();
}
