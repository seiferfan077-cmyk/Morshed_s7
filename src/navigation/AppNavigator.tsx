import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { BrowserScreen } from '../screens/BrowserScreen';
import { MediaScreen } from '../screens/MediaScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MemoryScreen } from '../screens/MemoryScreen';
import { FeaturesScreen } from '../screens/FeaturesScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { MurshidAIScreen } from '../screens/MurshidAIScreen';
import { ChannelScreen } from '../screens/ChannelScreen';
import { typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { MurshidTabIcon } from './MurshidTabIcon';
import { AppTabName, useTabPreferences } from './TabPreferences';
import { registerForChannelNotifications } from '../services/channel/channelNotifications';

export type RootTabParamList = {
  الرئيسية: undefined;
  'مُرشد AI': undefined;
  'القناة الرسمية': undefined;
  الرسائل: undefined;
  المتصفح: undefined;
  المعرض: undefined;
  الذاكرة: undefined;
  المميزات: { openRashid?: boolean } | undefined;
  الإعدادات: undefined;
};

const Tabs = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootTabParamList>();
const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ['murshid://'],
  config: { screens: { الرسائل: 'messages', 'القناة الرسمية': 'channel' } },
};

export function AppNavigator() {
  const { colors } = useAppTheme();
  const { tabOrder } = useTabPreferences();
  const pendingChannelOpen = useRef(false);
  useEffect(() => {
    void registerForChannelNotifications().catch(() => undefined);
    const openChannel = () => {
      if (navigationRef.isReady()) navigationRef.navigate('القناة الرسمية');
      else pendingChannelOpen.current = true;
    };
    const openRashid = () => {
      if (navigationRef.isReady()) navigationRef.navigate('المميزات', { openRashid: true });
    };
    const isChannelResponse = (response: Notifications.NotificationResponse | null) => response?.notification.request.content.data?.route === 'channel';
    const isRashidResponse = (response: Notifications.NotificationResponse | null) => response?.notification.request.content.data?.route === 'rashid';
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isChannelResponse(response)) openChannel();
      if (isRashidResponse(response)) openRashid();
    });
    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (isChannelResponse(response)) openChannel();
      if (isRashidResponse(response)) openRashid();
      if (response) await Notifications.clearLastNotificationResponseAsync();
    }).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        if (pendingChannelOpen.current) {
          pendingChannelOpen.current = false;
          navigationRef.navigate('القناة الرسمية');
        }
      }}
    >
      <Tabs.Navigator
        screenOptions={({ route }) => {
          const isMurshidAI = route.name === 'مُرشد AI';
          return {
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: isMurshidAI ? '#56D8C9' : colors.tealDark,
            tabBarInactiveTintColor: isMurshidAI ? '#71808A' : colors.inkFaint,
            tabBarLabelStyle: { ...typography.label, fontSize: 9, marginBottom: 4 },
            tabBarStyle: {
              height: 76,
              marginHorizontal: 12,
              marginBottom: 8,
              paddingTop: 7,
              borderTopWidth: 0,
              borderTopColor: 'transparent',
              borderRadius: 26,
              backgroundColor: isMurshidAI ? '#080B0F' : colors.paper,
              shadowColor: '#10252B',
              shadowOpacity: 0.13,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 10,
            },
            tabBarIcon: ({ focused, size }) => <MurshidTabIcon name={route.name as AppTabName} size={size + 4} active={focused} />,
          };
        }}
      >
        {tabOrder.map((tab) => renderTab(tab))}
      </Tabs.Navigator>
    </NavigationContainer>
  );
}

function renderTab(tab: AppTabName) {
  switch (tab) {
    case 'الرئيسية': return <Tabs.Screen key={tab} name="الرئيسية" component={HomeScreen} />;
    case 'مُرشد AI': return <Tabs.Screen key={tab} name="مُرشد AI" component={MurshidAIScreen} />;
    case 'القناة الرسمية': return <Tabs.Screen key={tab} name="القناة الرسمية" component={ChannelScreen} />;
    case 'الرسائل': return <Tabs.Screen key={tab} name="الرسائل" component={MessagesScreen} />;
    case 'المتصفح': return <Tabs.Screen key={tab} name="المتصفح" component={BrowserScreen} />;
    case 'المعرض': return <Tabs.Screen key={tab} name="المعرض" component={MediaScreen} />;
    case 'الذاكرة': return <Tabs.Screen key={tab} name="الذاكرة" component={MemoryScreen} />;
    case 'المميزات': return <Tabs.Screen key={tab} name="المميزات" component={FeaturesScreen} />;
    case 'الإعدادات': return <Tabs.Screen key={tab} name="الإعدادات" component={SettingsScreen} />;
  }
}
