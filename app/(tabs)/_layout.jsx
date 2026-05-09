import { Tabs } from 'expo-router'
import { colors } from '../../src/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{
        title: 'Inicio',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
      }} />
      <Tabs.Screen name="mesas" options={{
        title: 'Mesas',
        tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />
      }} />
      <Tabs.Screen name="historial" options={{
        title: 'Historial',
        tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />
      }} />
      <Tabs.Screen name="gastos" options={{
        title: 'Finanzas',
        tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />
      }} />
      <Tabs.Screen name="alertas" options={{
        title: 'Alertas',
        tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />
      }} />
      <Tabs.Screen name="reportes" options={{
        title: 'Reportes',
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />
      }} />
      <Tabs.Screen name="reservas" options={{
        title: 'Reservas',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />
      }} />
      <Tabs.Screen name="asistente" options={{
        href: null,
      }} />
    </Tabs>
  )
}