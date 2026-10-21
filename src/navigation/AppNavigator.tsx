import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
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

export type RootTabParamList = {
  الرئيسية: undefined;
  'مُرشد AI': undefined;
  'القناة الرسمية': undefined;
  الرسائل: undefined;
  المتصفح: undefined;
  المعرض: undefined;
  الذاكرة: undefined;
  المميزات: undefined;
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
  const pendingChannelOpen = useRef(false);
  useEffect(() => {
    const openChannel = () => {
      if (navigationRef.isReady()) navigationRef.navigate('القناة الرسمية');
      else pendingChannelOpen.current = true;
    };
    const isChannelResponse = (response: Notifications.NotificationResponse | null) => response?.notification.request.content.data?.route === 'channel';
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isChannelResponse(response)) openChannel();
    });
    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (isChannelResponse(response)) openChannel();
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
            tabBarLabelStyle: { ...typography.label, fontSize: 11, marginBottom: 5 },
            tabBarStyle: { height: 72, paddingTop: 8, borderTopColor: isMurshidAI ? '#26313A' : colors.line, backgroundColor: isMurshidAI ? '#080B0F' : colors.paper },
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                الرئيسية: 'grid-outline',
                'مُرشد AI': 'sparkles-outline',
                'القناة الرسمية': 'megaphone-outline',
                الرسائل: 'chatbubbles-outline',
                المتصفح: 'compass-outline',
                المعرض: 'images-outline',
                الذاكرة: 'bookmark-outline',
                المميزات: 'star-outline',
                الإعدادات: 'settings-outline',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
          };
        }}
      >
        <Tabs.Screen name="الرئيسية" component={HomeScreen} />
        <Tabs.Screen name="مُرشد AI" component={MurshidAIScreen} />
        <Tabs.Screen name="القناة الرسمية" component={ChannelScreen} />
        <Tabs.Screen name="الرسائل" component={MessagesScreen} />
        <Tabs.Screen name="المتصفح" component={BrowserScreen} />
        <Tabs.Screen name="المعرض" component={MediaScreen} />
        <Tabs.Screen name="الذاكرة" component={MemoryScreen} />
        <Tabs.Screen name="المميزات" component={FeaturesScreen} />
        <Tabs.Screen name="الإعدادات" component={SettingsScreen} />
      </Tabs.Navigator>
    </NavigationContainer>
  );
}
