import path from 'path';
import * as metrics from '../../lib/hybrid-sdk/common/utils/metrics';
import { axiosClient } from '../setup/axios-client';
import {
  BrokerClient,
  closeBrokerClient,
  createBrokerClient,
} from '../setup/broker-client';
import {
  BrokerServer,
  closeBrokerServer,
  createBrokerServer,
  waitForBrokerClientConnection,
} from '../setup/broker-server';
import { TestWebServer, createTestWebServer } from '../setup/test-web-server';

const fixtures = path.resolve(__dirname, '..', 'fixtures');
const serverAccept = path.join(fixtures, 'server', 'filters.json');
const clientAccept = path.join(fixtures, 'client', 'filters.json');

describe('metrics', () => {
  let tws: TestWebServer;
  let bs: BrokerServer;
  let bc: BrokerClient;
  let brokerToken: string;

  beforeAll(async () => {
    const PORT = 9999;
    process.env.BROKER_SERVER_URL = `http://localhost:${PORT}`;
    tws = await createTestWebServer();

    bs = await createBrokerServer({ port: PORT, filters: serverAccept });

    bc = await createBrokerClient({
      brokerServerUrl: `${process.env.BROKER_SERVER_URL}`,
      brokerToken: '12345',
      filters: clientAccept,
    });
    ({ brokerToken } = await waitForBrokerClientConnection(bs));
  });

  afterAll(async () => {
    await tws.server.close();
    await closeBrokerClient(bc);
    await closeBrokerServer(bs);
    delete process.env.BROKER_SERVER_URL;
  });

  it('observes response size when streaming', async () => {
    const metricsSpy = jest.spyOn(metrics, 'observeResponseSize');
    const httpMetricsSpy = jest.spyOn(metrics, 'incrementHttpRequestsTotal');
    const wsMetricsSpy = jest.spyOn(metrics, 'incrementWebSocketRequestsTotal');
    const expectedBytes = 256_000; // 250kb

    await axiosClient.get(
      `http://localhost:${bs.port}/broker/${brokerToken}/test-blob-param/${expectedBytes}`,
      { timeout: 10_000 },
    );

    expect(metricsSpy).toHaveBeenCalledWith({
      bytes: expectedBytes,
      isStreaming: true,
    });
    expect(httpMetricsSpy).toHaveBeenCalledTimes(3); // 1 inbound http, one data request inbound, one outbound (from the simulated client)
    expect(wsMetricsSpy).toHaveBeenCalledTimes(2); // 1 outbound-request to client, 1 inbound-request (from the simulated client)
  });
});
