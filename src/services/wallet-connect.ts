import {EventEmitter} from 'events';

import {WALLET_CONNECT_PROJECT_ID, WALLET_CONNECT_RELAY_URL} from '@env';
import {Core} from '@walletconnect/core';
import {ICore, SessionTypes, SignClientTypes} from '@walletconnect/types';
import {getSdkError} from '@walletconnect/utils';
import {IWeb3Wallet, Web3Wallet} from '@walletconnect/web3wallet';

import {app} from '@app/contexts';
import {DEBUG_VARS} from '@app/debug-vars';
import {Events, WalletConnectEvents} from '@app/events';
import {captureException} from '@app/helpers';
import {I18N} from '@app/i18n';
import {VariablesBool} from '@app/models/variables-bool';
import {WalletConnectSessionMetadata} from '@app/models/wallet-connect-session-metadata';
import {sendNotification} from '@app/services/toast';
import {sleep} from '@app/utils';

import {AppUtils} from './app-utils';
import {RemoteConfig} from './remote-config';

export type WalletConnectEventTypes = keyof SignClientTypes.EventArguments;
const EMPTY_NAMESPACE = {
  methods: [],
  events: [],
  chains: [],
};

export class WalletConnect extends EventEmitter {
  static instance = new WalletConnect();
  private _client: IWeb3Wallet | null = null;
  private _core: ICore | null = null;

  public getActiveSessions() {
    return this._client?.engine?.signClient?.session?.getAll?.() || [];
  }

  public disconnectSession(topic: string) {
    return this._client?.disconnectSession?.({
      reason: getSdkError('USER_DISCONNECTED'),
      topic,
    });
  }

  public async init(): Promise<void> {
    try {
      if (DEBUG_VARS.enableWalletConnectLogger) {
        console.log(
          'WalletConnect:init',
          WALLET_CONNECT_PROJECT_ID,
          WALLET_CONNECT_RELAY_URL,
        );
      }

      if (this._client) {
        return console.warn('WalletConnect:init already initialized');
      }

      this._core = new Core({
        logger: DEBUG_VARS.enableWalletConnectLogger ? 'debug' : 'error',
        projectId: WALLET_CONNECT_PROJECT_ID,
        relayUrl: WALLET_CONNECT_RELAY_URL,
      });

      this._client = await Web3Wallet.init({
        core: this._core,
        metadata: {
          name: 'HAQQ Wallet',
          description: 'HAQQ Wallet for WalletConnect',
          url: 'https://walletconnect.com/',
          icons: ['https://islamiccoin.net/favicon.ico'],
        },
      });

      this._emitActiveSessions();

      this
        // https://docs.walletconnect.com/2.0/javascript/web3wallet/wallet-usage#responding-to-session-requests
        ._walletConnectOnEvent('session_proposal', proposal => {
          if (DEBUG_VARS.enableWalletConnectLogger) {
            console.log(
              '🟢 session_proposal',
              JSON.stringify(proposal, null, 2),
            );
          }
          app.emit(Events.onWalletConnectApproveConnection, proposal);
        })
        // https://docs.walletconnect.com/2.0/javascript/web3wallet/wallet-usage#responding-to-session-requests
        .on('session_request', async event => {
          if (DEBUG_VARS.enableWalletConnectLogger) {
            console.log('🟢 session_request', JSON.stringify(event, null, 2));
          }
          app.emit(Events.onWalletConnectSignTransaction, event);
        })
        // https://docs.walletconnect.com/2.0/javascript/web3wallet/wallet-usage#extend-a-session
        .on('session_update', async event => {
          if (DEBUG_VARS.enableWalletConnectLogger) {
            console.log('🟢 session_update', JSON.stringify(event, null, 2));
          }
          await this._client?.extendSession?.({topic: event?.topic});
          this._emitActiveSessions();
        })
        .on('session_expire', this._emitActiveSessions.bind(this))
        .on('session_delete', this._emitActiveSessions.bind(this));

      // this event called when user disconect from web site
      this._client.core.expirer.on(
        'expirer_deleted',
        this._emitActiveSessions.bind(this),
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error('[WalletConnect] init error', err);
        captureException(err, 'WalletConnect:init');
        await sleep(5000);
        return WalletConnect.instance._reInit();
      }
    }
  }

  public async pair(uri: string) {
    if (!this._client || !this._core) {
      return sendNotification(I18N.walletConnectPairInitError);
    }

    try {
      const resp = await this._core.pairing.pair({uri});

      if (!resp) {
        sendNotification(I18N.walletConnectPairError);
      }

      if (DEBUG_VARS.enableWalletConnectLogger) {
        console.log('WalletConnect:pair ', resp);
      }
    } catch (err) {
      console.error('[WalletConnect] pair', err);
      sendNotification(I18N.walletConnectPairError);
      await this._reInit();
    }
  }

  public rejectSession(eventId: number, message?: string) {
    return this._client?.rejectSession?.({
      id: eventId,
      reason: getSdkError('USER_REJECTED', message),
    });
  }

  public async rejectSessionRequest(
    eventId: number,
    topic: string,
    message?: string,
  ) {
    await this._client?.respondSessionRequest({
      topic,
      response: {
        id: eventId,
        jsonrpc: '2.0',
        error: getSdkError('USER_REJECTED', message),
      },
    });
    this.redirect();
  }

  public async approveSession(
    proposalId: number,
    currentETHAddress: string,
    params: SignClientTypes.EventArguments['session_proposal']['params'],
  ) {
    if (!this._client) {
      return;
    }

    const {requiredNamespaces, optionalNamespaces, relays} = params;

    const allowedNamespaces = DEBUG_VARS.allowAnySourcesForWalletConnectLogin
      ? requiredNamespaces
      : RemoteConfig.get('wallet_connect');

    if (!allowedNamespaces) {
      throw Error('[WalletConnect]: allowedNamespaces not found');
    }
    const namespaces: SessionTypes.Namespaces = {};

    Object.keys(allowedNamespaces).forEach(namespace => {
      const allowed = {...EMPTY_NAMESPACE, ...allowedNamespaces[namespace]};
      const required = {...EMPTY_NAMESPACE, ...requiredNamespaces[namespace]};
      const optional = {...EMPTY_NAMESPACE, ...optionalNamespaces[namespace]};

      const methods: string[] = [];
      [...required?.methods, ...optional?.methods].forEach(method => {
        if (
          !methods.includes?.(method) &&
          allowed.methods?.includes?.(method)
        ) {
          methods.push(method);
        }
      });

      const events: string[] = [];
      [...required?.events, ...optional?.events].forEach(event => {
        if (!events.includes?.(event) && allowed.events?.includes?.(event)) {
          events.push(event);
        }
      });

      const chains: string[] = [];
      [...(required?.chains || []), ...(optional?.chains || [])].forEach(
        chain => {
          if (!chains.includes?.(chain) && allowed.chains?.includes?.(chain)) {
            chains.push(chain);
          }
        },
      );

      const accounts = Array.from(chains).map(
        chain => `${chain}:${currentETHAddress}`,
      );

      namespaces[namespace] = {
        accounts,
        methods,
        events,
        chains,
      };
    });

    console.log('namespaces', JSON.stringify(namespaces, null, 2));

    const session = await this._client.approveSession({
      id: proposalId,
      relayProtocol: relays[0].protocol,
      namespaces,
    });

    WalletConnectSessionMetadata.create(session.topic);
    this._emitActiveSessions();
    this.redirect();
    return session;
  }

  public getSessionByTopic(topic: string) {
    return this._client?.engine?.signClient?.session?.get?.(topic);
  }

  public async approveSessionRequest(
    result: any,
    event: SignClientTypes.EventArguments['session_request'],
  ) {
    if (!result) {
      throw new Error(
        '[WalletConnect:approveEIP155Request]: result is undefined',
      );
    }

    if (DEBUG_VARS.enableWalletConnectLogger) {
      console.log('✅ approveSessionRequest result:', result);
    }

    const isDisconnected = !this.getSessionByTopic(event?.topic);
    if (isDisconnected) {
      return this.rejectSessionRequest(event?.id, event?.topic);
    }

    return this._client?.respondSessionRequest({
      topic: event.topic,
      response: {id: event.id, result, jsonrpc: '2.0'},
    });
  }

  private redirect() {
    const isWalletConnectFromDeepLink = VariablesBool.get(
      'isWalletConnectFromDeepLink',
    );
    if (isWalletConnectFromDeepLink) {
      VariablesBool.set('isWalletConnectFromDeepLink', false);
      setTimeout(() => {
        AppUtils.goBack();
      }, 500);
    }
  }

  private _emitActiveSessions() {
    this.emit(WalletConnectEvents.onSessionsChange, this.getActiveSessions());
  }

  private async _reInit() {
    if (this._core?.relayer?.connected) {
      await this._core?.relayer?.transportClose?.();
    }
    this._core = null;
    this._client = null;
    await this.init();
  }

  // typed fix for `Web3Wallet.on`
  private _walletConnectOnEvent<EventName extends WalletConnectEventTypes>(
    eventName: EventName,
    cb: (event: SignClientTypes.EventArguments[EventName]) => void,
  ) {
    // @ts-ignore
    return this._client?.on?.(eventName, cb) as unknown as Omit<
      EventEmitter,
      'on'
    > & {
      on: typeof WalletConnect.instance._walletConnectOnEvent;
    };
  }
}
