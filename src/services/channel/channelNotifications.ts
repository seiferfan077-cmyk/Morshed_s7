import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerChannelPushToken } from './channelService';

export type ChannelNotificationRegistration = 'registered' | 'permission-denied' | 'unsupported';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registrationInFlight: Promise<ChannelNotificationRegistration> | null = null;

export function registerForChannelNotifications(options: { requestPermission?: boolean } = {}): Promise<ChannelNotificationRegistration> {
  if (Platform.OS === 'web') return Promise.resolve('unsupported');
  if (!registrationInFlight) {
    registrationInFlight = registerForChannelNotificationsOnce(options.requestPermission !== false).finally(() => {
      registrationInFlight = null;
    });
  }
  return registrationInFlight;
}

async function registerForChannelNotificationsOnce(requestPermission: boolean): Promise<ChannelNotificationRegistration> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('murshid-channel-updates', {
      name: 'القناة الرسمية',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#56D8C9',
      sound: 'default',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return 'permission-denied';

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('expo_project_id_missing');
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!pushToken.data) throw new Error('expo_push_token_missing');
  await registerChannelPushToken(pushToken.data);
  return 'registered';
}
