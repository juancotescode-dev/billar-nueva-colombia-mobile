import { Tabs } from 'expo-router'
import { colors } from '../../src/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="mesas" options={{ title: 'Mesas' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="gastos" options={{ title: 'Gastos' }} />
      <Tabs.Screen name="alertas" options={{ title: 'Alertas' }} />
      <Tabs.Screen name="reportes" options={{ title: 'Reportes' }} />
    </Tabs>
  )
}