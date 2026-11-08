export function isSQLiteDatabaseCorruption(error: unknown): boolean {
  const candidate = error as { message?: unknown; code?: unknown } | null;
  const message = typeof candidate?.message === 'string' ? candidate.message : String(error ?? '');
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  return /database disk image is malformed|sqlite_corrupt|sqlite_notadb|file is not a database/i.test(`${code} ${message}`);
}
