import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  DEFAULT_DAILY_DUA_SETTINGS,
  DailyDuaSettings,
  normalizeDailyDuaSettings,
} from './dailyDuaPolicy';

const SETTINGS_KEY = '@murshid/daily-dua-notification/settings';
const IDENTIFIER_KEY = '@murshid/daily-dua-notification/identifier';
export const DUA_CHANNEL_ID = 'murshid-daily-dua';
const NOTIFICATION_KIND = 'murshid-daily-dua';

type NotificationPermission = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

export type DailyDuaSaveResult = {
  saved: boolean;
  reason?: string;
  warning?: string;
  requiresSettings?: boolean;
};

function hasNotificationPermission(permission: NotificationPermission): boolean {
  if (permission.granted) return true;
  return Platform.OS === 'ios'
    && (permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL);
}

async function ensureNotificationPermission(): Promise<{ allowed: boolean; canOpenSettings: boolean }> {
  let permission = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permission) && permission.canAskAgain) {
    permission = Platform.OS === 'ios'
      ? await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: true },
        })
      : await Notifications.requestPermissionsAsync();
  }
  return { allowed: hasNotificationPermission(permission), canOpenSettings: !permission.canAskAgain };
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DUA_CHANNEL_ID, {
    name: 'الأدعية والأذكار اليومية',
    description: 'تذكير يومي اختياري بالورد الذي تختاره.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: true,
    showBadge: false,
  });
}

export async function getDailyDuaSettings(): Promise<DailyDuaSettings> {
  if (Platform.OS === 'web') return { ...DEFAULT_DAILY_DUA_SETTINGS };
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    return stored ? normalizeDailyDuaSettings(JSON.parse(stored)) : { ...DEFAULT_DAILY_DUA_SETTINGS };
  } catch {
    return { ...DEFAULT_DAILY_DUA_SETTINGS };
  }
}

export async function saveDailyDuaSettings(settings: DailyDuaSettings): Promise<DailyDuaSaveResult> {
  if (Platform.OS === 'web') {
    return { saved: false, reason: 'التنبيهات اليومية متاحة على أجهزة Android وiOS فقط.' };
  }

  const normalized = normalizeDailyDuaSettings(settings);
  let previousIdentifier: string | null = null;
  let previousSettings: string | null = null;
  try {
    [previousIdentifier, previousSettings] = await Promise.all([
      AsyncStorage.getItem(IDENTIFIER_KEY),
      AsyncStorage.getItem(SETTINGS_KEY),
    ]);
  } catch {
    return { saved: false, reason: 'تعذر قراءة إعدادات التذكير المحفوظة.' };
  }

  if (!normalized.enabled) {
    try {
      if (previousIdentifier) await Notifications.cancelScheduledNotificationAsync(previousIdentifier);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      await AsyncStorage.removeItem(IDENTIFIER_KEY);
      return { saved: true };
    } catch {
      return { saved: false, reason: 'تعذر إيقاف التذكير الآن. حاول مرة أخرى.' };
    }
  }

  let newIdentifier: string | null = null;
  try {
    await ensureAndroidChannel();
    const permission = await ensureNotificationPermission();
    if (!permission.allowed) {
      return {
        saved: false,
        reason: 'يلزم السماح بإشعارات مُرشد لتفعيل التذكير اليومي.',
        requiresSettings: permission.canOpenSettings,
      };
    }

    if (Platform.OS === 'android') {
      const channel = await Notifications.getNotificationChannelAsync(DUA_CHANNEL_ID);
      if (channel?.importance === Notifications.AndroidImportance.NONE) {
        return {
          saved: false,
          reason: 'قناة تذكير الأدعية متوقفة من إعدادات Android.',
          requiresSettings: true,
        };
      }
    }

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: normalized.hour,
      minute: normalized.minute,
      ...(Platform.OS === 'android' ? { channelId: DUA_CHANNEL_ID } : {}),
    };
    newIdentifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'وردك اليومي من مُرشد',
        body: 'حان وقت الذكر والدعاء. افتح مُرشد للاطلاع على دعاء اليوم.',
        data: { kind: NOTIFICATION_KIND },
        sound: 'default',
        color: '#087C73',
      },
      trigger,
    });

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    await AsyncStorage.setItem(IDENTIFIER_KEY, newIdentifier);

    if (previousIdentifier && previousIdentifier !== newIdentifier) {
      try {
        await Notifications.cancelScheduledNotificationAsync(previousIdentifier);
      } catch {
        await Notifications.cancelScheduledNotificationAsync(newIdentifier).catch(() => undefined);
        if (previousSettings === null) await AsyncStorage.removeItem(SETTINGS_KEY).catch(() => undefined);
        else await AsyncStorage.setItem(SETTINGS_KEY, previousSettings).catch(() => undefined);
        await AsyncStorage.setItem(IDENTIFIER_KEY, previousIdentifier).catch(() => undefined);
        return { saved: false, reason: 'تعذر استبدال موعد التذكير السابق؛ أبقينا الإعداد القديم كما هو.' };
      }
    }

    return { saved: true };
  } catch {
    if (newIdentifier) await Notifications.cancelScheduledNotificationAsync(newIdentifier).catch(() => undefined);
    if (previousSettings === null) await AsyncStorage.removeItem(SETTINGS_KEY).catch(() => undefined);
    else await AsyncStorage.setItem(SETTINGS_KEY, previousSettings).catch(() => undefined);
    if (previousIdentifier === null) await AsyncStorage.removeItem(IDENTIFIER_KEY).catch(() => undefined);
    else await AsyncStorage.setItem(IDENTIFIER_KEY, previousIdentifier).catch(() => undefined);
    return { saved: false, reason: 'تعذر جدولة التذكير الآن. تحقّق من الإشعارات وحاول مجددًا.' };
  }
}
