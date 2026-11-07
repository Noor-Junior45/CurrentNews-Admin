/**
 * Writer / Editorial Byline Configuration Helper
 * Loads the list of allowed or configured authors from environment variable VITE_WRITERS.
 * In the future, administrators can add or remove writers at any time by simply updating
 * the VITE_WRITERS environment variable (comma-separated), requiring zero code modifications!
 */

export const DEFAULT_WRITERS = [
  'Current News',
  'Current News Staff Report',
  'Investigative Editorial Bureau',
  'Chief Political Correspondent',
  'Technology & Science Desk',
  'Global Affairs Dispatch',
  'Chronicle Desk'
];

export function getAvailableWriters(): string[] {
  try {
    const envVal = (import.meta as any).env?.VITE_WRITERS || '';
    if (typeof envVal === 'string' && envVal.trim().length > 0) {
      const parsed = envVal
        .split(',')
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.debug('Failed to read VITE_WRITERS from environment:', err);
  }

  return DEFAULT_WRITERS;
}
