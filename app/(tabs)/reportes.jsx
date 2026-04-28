import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../src/constants/colors'

export default function Reportes() {
  return (
    <View style={styles.container}>
      <Text style={styles.texto}>Reportes</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  texto: { color: colors.textPrimary, fontSize: 18 },
})