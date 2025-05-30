import { computeContentLength } from '../../lib/broker-workload/content-length';
import { PostFilterPreparedRequest } from '../../lib/broker-workload/prepareRequest';

describe('utils', () => {
  it('computeContentLength 0 for bodylessr requests', () => {
    const dummyReq: PostFilterPreparedRequest = {
      url: 'dummy',
      headers: {},
      method: 'GET',
    };
    expect(computeContentLength(dummyReq)).toEqual(0);
  });

  it('computeContentLength for body', () => {
    const dummyReq: PostFilterPreparedRequest = {
      url: 'dummy',
      headers: {},
      method: 'POST',
      body: '1234567890',
    };
    expect(computeContentLength(dummyReq)).toEqual(10);
  });

  it('computeContentLength for body with standard hyphen character', () => {
    const dummyReq: PostFilterPreparedRequest = {
      url: 'dummy',
      headers: {},
      method: 'POST',
      body: '1234567890-1234567890',
    };
    expect(computeContentLength(dummyReq)).toEqual(21);
  });
  it('computeContentLength for body with non standard hyphen character', () => {
    const dummyReq: PostFilterPreparedRequest = {
      url: 'dummy',
      headers: {},
      method: 'POST',
      body: '1234567890–1234567890',
    };
    expect(computeContentLength(dummyReq)).toEqual(23);
  });
});
