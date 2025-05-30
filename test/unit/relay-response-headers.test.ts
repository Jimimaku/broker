const PORT = 8001;
process.env.BROKER_SERVER_URL = `http://localhost:${PORT}`;
jest.mock('../../lib/hybrid-sdk/http/request');
import {
  Role,
  WebSocketConnection,
} from '../../lib/hybrid-sdk/client/types/client';
import { makeRequestToDownstream } from '../../lib/hybrid-sdk/http/request';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockedFn = makeRequestToDownstream.mockImplementation((data) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return data;
});

import { forwardWebSocketRequest as relay } from '../../lib/hybrid-sdk/common/connectionToWorkloadInterface/forwardWebsocketRequest';
import {
  CONFIGURATION,
  LoadedClientOpts,
  LoadedServerOpts,
} from '../../lib/hybrid-sdk/common/types/options';
import { AuthObject } from '../../lib/hybrid-sdk/common/types/filter';

const dummyWebsocketHandler: WebSocketConnection = {
  destroy: () => {
    return;
  },
  latency: 0,
  options: {
    ping: 0,
    pong: 0,
    queueSize: Infinity,
    reconnect: '',
    stategy: '',
    timeout: 100,
    transport: '',
  },
  send: () => {},
  serverId: '0',
  socket: {},
  supportedIntegrationType: 'github',
  transport: '',
  url: '',
  on: () => {},
  end: () => {},
  role: Role.primary,
  open: () => {},
  emit: () => {},
  readyState: 3,
};

const dummyAuthObject: AuthObject = {
  scheme: '',
};

const dummyLoadedFilters = {
  private: () => {
    return { method: 'GET', url: '/', auth: dummyAuthObject };
  },
  public: () => {
    return { method: 'GET', url: '/', auth: dummyAuthObject };
  },
};

describe('header relay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(() => {
    delete process.env.BROKER_SERVER_URL;
    jest.clearAllMocks();
  });
  it('swaps header values found in BROKER_VAR_SUB', (done) => {
    expect.hasAssertions();

    const brokerToken = 'test-broker';

    const config: CONFIGURATION = {
      remoteWorkloadName: 'BrokerWorkload',
      remoteWorkloadModulePath: '../broker-workload/websocketRequests',
      clientWorkloadName: 'BrokerClientRequestWorkload',
      clientWorkloadModulePath: '../broker-workload/clientLocalRequests',
      SECRET_TOKEN: 'very-secret',
      VALUE: 'some-special-value',
      supportedBrokerTypes: [],
      filterRulesPaths: {},
      brokerType: 'server',
    };
    const options: LoadedClientOpts | LoadedServerOpts = {
      filters: {
        private: [
          {
            method: 'any',
            url: '/*',
          },
        ],
        public: [],
      },
      config,
      port: 8001,
      loadedFilters: dummyLoadedFilters,
    };
    const route = relay(options, dummyWebsocketHandler)(brokerToken);

    const headers = {
      'x-broker-var-sub': 'private-token,replaceme',
      donttouch: 'not to be changed ${VALUE}',
      'private-token': 'Bearer ${SECRET_TOKEN}',
      replaceme: 'replace ${VALUE}',
    };

    route(
      {
        url: '/',
        method: 'GET',
        headers: headers,
      },
      () => {
        expect(makeRequestToDownstream).toHaveBeenCalledTimes(1);
        const arg = mockedFn.mock.calls[0][0];
        expect(arg.headers['private-token']).toEqual(
          `Bearer ${config.SECRET_TOKEN}`,
        );
        expect(arg.headers.replaceme).toEqual(`replace ${config.VALUE}`);
        expect(arg.headers.donttouch).toEqual('not to be changed ${VALUE}');
        done();
      },
    );
  });

  it('does NOT swap header values found in BROKER_VAR_SUB', (done) => {
    expect.hasAssertions();

    const brokerToken = 'test-broker';

    const config: CONFIGURATION = {
      remoteWorkloadName: 'BrokerWorkload',
      remoteWorkloadModulePath: '../broker-workload/websocketRequests',
      clientWorkloadName: 'BrokerClientRequestWorkload',
      clientWorkloadModulePath: '../broker-workload/clientLocalRequests',
      SECRET_TOKEN: 'very-secret',
      VALUE: 'some-special-value',
      disableHeaderVarsSubstitution: true,
      brokerServerUrl: 'http://localhost:8001',
      supportedBrokerTypes: [],
      filterRulesPaths: {},
      brokerType: 'server',
    };

    const options: LoadedClientOpts | LoadedServerOpts = {
      filters: {
        private: [
          {
            method: 'any',
            url: '/*',
          },
        ],
        public: [],
      },
      config,
      port: 8001,
      loadedFilters: dummyLoadedFilters,
    };
    const route = relay(options, dummyWebsocketHandler)(brokerToken);

    const headers = {
      'x-broker-var-sub': 'private-token,replaceme',
      donttouch: 'not to be changed ${VALUE}',
      'private-token': 'Bearer ${SECRET_TOKEN}',
      replaceme: 'replace ${VALUE}',
    };

    route(
      {
        url: '/',
        method: 'GET',
        headers: headers,
      },
      () => {
        expect(makeRequestToDownstream).toHaveBeenCalledTimes(1);
        const arg = mockedFn.mock.calls[0][0];
        expect(arg.headers['private-token']).toEqual('Bearer ${SECRET_TOKEN}');
        expect(arg.headers.replaceme).toEqual('replace ${VALUE}');
        expect(arg.headers.donttouch).toEqual('not to be changed ${VALUE}');
        done();
      },
    );
  });
});
