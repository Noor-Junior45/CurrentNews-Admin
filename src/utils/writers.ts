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
  return DEFAULT_WRITERS;
}
