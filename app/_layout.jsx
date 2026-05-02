import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useNotificaciones } from '../src/hooks/useNotificaciones'
import OfflineBanner from '../src/components/OfflineBanner'
import { View, StyleSheet } from 'react-native'

export default function RootLayout() {
  useNotificaciones()

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#111827" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})