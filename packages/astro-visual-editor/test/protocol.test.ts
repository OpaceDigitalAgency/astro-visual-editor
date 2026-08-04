import { describe, expect, it } from 'vitest';
import { parseSaveRequest } from '../src/shared/protocol.js';

describe('toolbar protocol', () => {
  const valid = {
    clientId: 'tab-1',
    requestId: 'request-1',
    changes: [
      {
        kind: 'text',
        id: 'change-1',
        filePath: 'src/pages/index.astro',
        route: '/',
        oldText: 'Old',
        newText: 'New',
        selector: '#title',
      },
    ],
  };

  it('accepts a bounded discriminated request', () => {
    expect(parseSaveRequest(valid, 10, 10_000)).toEqual(valid);
  });

  it('rejects malformed, oversized and over-count requests', () => {
    expect(() => parseSaveRequest({ ...valid, clientId: '' }, 10, 10_000)).toThrow('validation');
    expect(() => parseSaveRequest(valid, 0, 10_000)).toThrow('validation');
    expect(() => parseSaveRequest(valid, 10, 10)).toThrow('byte');
  });
});
