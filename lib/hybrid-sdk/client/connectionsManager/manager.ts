import { LoadedClientOpts } from '../../common/types/options';
import { IdentifyingMetadata, WebSocketConnection } from '../types/client';
import { log as logger } from '../../../logs/logger';
import { retrieveConnectionsForDeployment } from '../config/remoteConfig';
import { findProjectRoot } from '../../common/config/config';
import { handleTerminationSignal } from '../../common/utils/signals';
import { cleanUpUniversalFile } from '../utils/cleanup';
import { validateUniversalConnectionsRemoteConfig } from './validator';
import { existsSync, writeFileSync } from 'fs';
import { setfetchAndUpdateJwt } from '../auth/oauth';
import { reloadConfig } from '../config/configHelpers';
import { processStartUpHooks } from '../hooks/startup/processHooks';
import { setBackupWatcher, syncClientConfig } from './synchronizer';

export const websocketConnections: WebSocketConnection[] = [];

export const getWebsocketConnections = () => {
  return websocketConnections;
};

export let globalMetadata: IdentifyingMetadata;

export const getGlobalIdentifyingMetadata = () => {
  return globalMetadata;
};

export const manageWebsocketConnections = async (
  clientOpts: LoadedClientOpts,
  globalIdentifyingMetadata: IdentifyingMetadata,
): Promise<WebSocketConnection[]> => {
  globalMetadata = globalIdentifyingMetadata;
  try {
    if (!process.env.SKIP_REMOTE_CONFIG) {
      if (!existsSync(`${findProjectRoot(__dirname)}/config.universal.json`)) {
        process.env.NO_UNIVERSAL_FILE = 'true';
        writeFileSync(
          `${findProjectRoot(__dirname)}/config.universal.json`,
          JSON.stringify({
            BROKER_CLIENT_CONFIGURATION: {
              common: {
                oauth: {
                  clientId: '${CLIENT_ID}',
                  clientSecret: '${CLIENT_SECRET}',
                },
              },
            },
          }),
        );
        await reloadConfig(clientOpts);
      }

      await setfetchAndUpdateJwt(
        clientOpts.config,
        clientOpts.config.brokerClientConfiguration.common.oauth.clientId,
        clientOpts.config.brokerClientConfiguration.common.oauth.clientSecret,
      );

      await retrieveConnectionsForDeployment(
        clientOpts,
        `${findProjectRoot(__dirname)}/config.universal.json`,
      );

      validateUniversalConnectionsRemoteConfig(
        `${findProjectRoot(__dirname)}/config.universal.json`,
      );

      handleTerminationSignal(cleanUpUniversalFile);
    } else {
      handleTerminationSignal(() => {
        logger.debug({}, 'Received process termination signal.');
      });
    }

    await reloadConfig(clientOpts);
  } catch (err) {
    logger.error({ err }, 'Error loading connections from remote');
    throw err;
  }

  // Running preflight check now in universal broker, after configuration loading
  globalIdentifyingMetadata.preflightChecks = (
    await processStartUpHooks(clientOpts, globalIdentifyingMetadata.clientId)
  ).preflightCheckResults;

  // At that point, plugins startup methods have executred and connections objects were mutated if needed

  setBackupWatcher(clientOpts, websocketConnections, globalIdentifyingMetadata);
  await syncClientConfig(
    clientOpts,
    websocketConnections,
    globalIdentifyingMetadata,
  );

  return websocketConnections;
};
