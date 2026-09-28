import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { BrowserScreen } from '../screens/BrowserScreen';
import { MediaScreen } from '../screens/MediaScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, typography } from '../theme';
export type RootTabParamList = { الرئيسية: undefined; المتصفح: undefined; المعرض: undefined; الإعدادات: undefined };
const Tabs = createBottomTabNavigator<RootTabParamList>();
export function AppNavigator() { return <NavigationContainer><Tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.tealDark, tabBarInactiveTintColor: colors.inkFaint, tabBarLabelStyle: { ...typography.label, fontSize: 11, marginBottom: 5 }, tabBarStyle: { height: 72, paddingTop: 8, borderTopColor: colors.line, backgroundColor: colors.paper }, tabBarIcon: ({ color, size }) => { const icons: Record<string, keyof typeof Ionicons.glyphMap> = { الرئيسية: 'grid-outline', المتصفح: 'compass-outline', المعرض: 'images-outline', الإعدادات: 'settings-outline' }; return <Ionicons name={icons[route.name]} size={size} color={color} />; } })}><Tabs.Screen name="الرئيسية" component={HomeScreen} /><Tabs.Screen name="المتصفح" component={BrowserScreen} /><Tabs.Screen name="المعرض" component={MediaScreen} /><Tabs.Screen name="الإعدادات" component={SettingsScreen} /></Tabs.Navigator></NavigationContainer>; }
