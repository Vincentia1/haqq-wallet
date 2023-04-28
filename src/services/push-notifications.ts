import {EventEmitter} from 'events';

import {PUSH_NOTIFICATIONS_URL} from '@env';
import {jsonrpcRequest} from '@haqq/shared-react-native';
import messaging from '@react-native-firebase/messaging';

import {app} from '@app/contexts';
import {Events} from '@app/events';
import {VariablesBool} from '@app/models/variables-bool';
import {VariablesString} from '@app/models/variables-string';

export class PushNotifications extends EventEmitter {
  static instance = new PushNotifications();
  path: string = PUSH_NOTIFICATIONS_URL;

  constructor() {
    super();

    messaging().onMessage(remoteMessage => {
      app.emit(Events.onPushNotification, remoteMessage);
    });

    messaging().onNotificationOpenedApp(remoteMessage => {
      app.emit(Events.onPushNotification, remoteMessage);
    });
  }

  get isAvailable() {
    return this.path !== '';
  }

  async requestPermissions() {
    if (!this.isAvailable) {
      throw new Error('push messages unavailable');
    }

    const authStatus = await messaging().requestPermission();

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const token = await messaging().getToken();

      const subscription = await this.createNotificationToken<{id: string}>(
        token,
      );

      if (subscription) {
        VariablesString.set('notificationToken', subscription.id);
        VariablesBool.set('notifications', true);
      }
    }
  }

  async subscribeToTopic(topic: string) {
    if (!this.isAvailable) {
      throw new Error('push messages unavailable');
    }

    await messaging().subscribeToTopic(topic);
  }

  getPath(subPath: string) {
    if (subPath.startsWith('/')) {
      return `${this.path}${subPath}`;
    }

    return `${this.path}/${subPath}`;
  }

  createNotificationToken<T extends object>(token: string) {
    return jsonrpcRequest<T>(this.path, 'createNotificationToken', [token]);
  }

  async removeNotificationToken<T extends object>(token: string) {
    return jsonrpcRequest<T>(this.path, 'removeNotificationToken', [token]);
  }

  async createNotificationSubscription<T extends object>(
    token_id: string,
    address: string,
  ) {
    return jsonrpcRequest<T>(this.path, 'createNotificationSubscription', [
      token_id,
      address,
    ]);
  }

  async unsubscribeAddress<T extends object>(
    token_id: string,
    address: string,
  ) {
    return jsonrpcRequest<T>(this.path, 'unsubscribeAddress', [
      token_id,
      address,
    ]);
  }
}
