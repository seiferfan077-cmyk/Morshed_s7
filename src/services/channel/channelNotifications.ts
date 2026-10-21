import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerChannelPushToken } from './channelService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForChannelNotifications() {
  if (Platform.OS === 'web') return false;

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
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return false;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('expo_project_id_missing');
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerChannelPushToken(pushToken.data);
  return true;
}
