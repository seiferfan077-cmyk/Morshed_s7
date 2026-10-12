import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isDailyNotificationDue } from './dailyNotificationPolicy';

const LAST_SENT_KEY = '@murshid/daily-update-notification/last-sent-at';
const PERMISSION_PROMPTED_KEY = '@murshid/daily-update-notification/permission-prompted';
const ANDROID_CHANNEL_ID = 'murshid-daily-updates';

const NOTIFICATION_TITLE = 'أهــلًا بيك ✿ في مُرشد ۝';
const NOTIFICATION_BODY = `رفيقك اليومي ♡ علشان تستخدم موبايلك بسهولة، وتستمتع بتجربة أسهل وأوضح! (◔‿◔)

♥️ عزيزنا مستخدم مُرشد،

علشان نقدر نقدّم لك أفضل تجربة، بننصحك تزور موقع مُرشد الإلكتروني من وقت للتاني، علشان تتابع أحدث الإصدارات والتحديثات أول بأول. 💫

📌 إزاي تتابع آخر تحديثات مُرشد؟

١. افتح تطبيق مُرشد.
٢. ادخل على الإعدادات.
٣. اضغط على «زيارة الموقع الإلكتروني»، واستنى شوية.

أول ما يتوفر إصدار جديد من مُرشد، هتلاقي تفاصيله واضحة على الموقع، وكمان هيوصلك إشعار من التطبيق نفسه علشان تفضل عارف كل جديد! 🚀

ومتنساش تتابع القناة الرسمية لمُرشد الموجودة جوه التطبيق، علشان يوصلك كل جديد وتستمتع بتجربة أسهل وأفضل معانا. ♥️

مُرشد S7 ۝
رفيقك اليومي، وكل يوم معاك للأفضل! 💫

#فريق_مطوري_مرشد_S7`;

type NotificationPermission = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

function hasNotificationPermission(permission: NotificationPermission): boolean {
  if (permission.granted) return true;
  if (Platform.OS !== 'ios') return false;
  return permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // SDK 57 requires this on Android for foreground alerts; sound stays off
      // through the notification content and Android channel configuration.
      shouldPlaySound: Platform.OS === 'android',
      shouldSetBadge: false,
    }),
  });
}

let deliveryInFlight: Promise<boolean> | null = null;

/** Sends at most one local notice per 24 hours, on the first app open after that interval. */
export function showDailyUpdateNotificationIfDue(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  if (deliveryInFlight) return deliveryInFlight;

  deliveryInFlight = deliverDailyUpdateNotification().finally(() => {
    deliveryInFlight = null;
  });
  return deliveryInFlight;
}

async function deliverDailyUpdateNotification(): Promise<boolean> {
  try {
    const lastSentValue = await AsyncStorage.getItem(LAST_SENT_KEY);
    const lastSentAt = lastSentValue === null ? null : Number(lastSentValue);
    if (!isDailyNotificationDue(lastSentAt, Date.now())) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'تحديثات مُرشد',
        description: 'رسائل مُرشد عند فتح التطبيق.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        enableVibrate: false,
        enableLights: false,
        showBadge: false,
      });

      const channel = await Notifications.getNotificationChannelAsync(ANDROID_CHANNEL_ID);
      if (channel?.importance === Notifications.AndroidImportance.NONE) return false;
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!hasNotificationPermission(permission)) {
      const alreadyAsked = (await AsyncStorage.getItem(PERMISSION_PROMPTED_KEY)) === 'true';
      if (alreadyAsked || !permission.canAskAgain) return false;

      // Persist before opening the system prompt so foreground/resume events cannot ask twice.
      await AsyncStorage.setItem(PERMISSION_PROMPTED_KEY, 'true');
      permission = Platform.OS === 'ios'
        ? await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: false, allowSound: false },
          })
        : await Notifications.requestPermissionsAsync();
    }
    if (!hasNotificationPermission(permission)) return false;

    const trigger: Notifications.NotificationTriggerInput = Platform.OS === 'android'
      ? { channelId: ANDROID_CHANNEL_ID }
      : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
        data: { kind: 'murshid-daily-update' },
        sound: false,
        color: '#E53935',
      },
      trigger,
    });

    await AsyncStorage.setItem(LAST_SENT_KEY, String(Date.now()));
    return true;
  } catch {
    // Notifications are optional; a device or OS error must not prevent app startup.
    return false;
  }
}
