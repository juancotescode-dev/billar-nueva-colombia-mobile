import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { colors } from '../constants/colors'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setOffline(!state.isConnected)
    })
    return () => unsub()
  }, [])

  if (!offline) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.txt}>📵 Sin conexión — mostrando datos en caché</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#451a03',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.yellow,
  },
  txt: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
})