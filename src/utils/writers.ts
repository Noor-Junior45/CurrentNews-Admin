/**
 * Writer / Editorial Byline Configuration Helper
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
