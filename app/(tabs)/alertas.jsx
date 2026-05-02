import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, TouchableOpacity, Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function formatFecha(fechaISO) {
  return new Date(fechaISO).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default function Alertas() {
  const insets = useSafeAreaInsets()
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function cargarAlertas() {
    try {
      const { data: notifs, error } = await supabase
        .from('notificaciones')
        .select('*')
        .order('enviada_en', { ascending: false })
  
      if (error) throw error
  
      const productoIds = [...new Set((notifs || []).map(n => n.producto_id).filter(Boolean))]
      let productosMap = {}
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, stock, stock_minimo')
          .in('id', productoIds)
        ;(productos || []).forEach(p => { productosMap[p.id] = p })
      }
  
      const alertasConProducto = (notifs || []).map(n => ({
        ...n,
        producto: productosMap[n.producto_id] || null
      }))
  
      setAlertas(alertasConProducto)
    } catch (err) {
      console.error('Error cargando alertas:', err.message)
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    cargarAlertas()
  }, [])

  usePolling(cargarAlertas, 15000)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarAlertas()
  }, [])

  async function marcarLeida(id) {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id)
      if (error) throw new Error(error.message)
      cargarAlertas()
    } catch (err) {
      Alert.alert('Error', err.message)
    }
  }

  async function marcarTodasLeidas() {
    Alert.alert(
      'Marcar todas como leídas',
      '¿Marcar todas las alertas como leídas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('leida', false)
              if (error) throw new Error(error.message)
              cargarAlertas()
            } catch (err) {
              Alert.alert('Error', err.message)
            }
          }
        }
      ]
    )
  }

  const noLeidas = alertas.filter(a => !a.leida).length

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        }
      >
        <View style={styles.tituloRow}>
          <View>
            <Text style={styles.titulo}>🔔 Alertas</Text>
            <Text style={styles.subtitulo}>
              {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
            </Text>
          </View>
          {noLeidas > 0 && (
            <TouchableOpacity style={styles.btnTodas} onPress={marcarTodasLeidas}>
              <Text style={styles.btnTodasTxt}>Marcar todas</Text>
            </TouchableOpacity>
          )}
        </View>

        {alertas.length === 0 ? (
          <View style={styles.vacioCont}>
            <Text style={styles.vacioEmoji}>✅</Text>
            <Text style={styles.vacioTxt}>No hay alertas registradas</Text>
          </View>
        ) : (
          alertas.map(a => (
            <View key={a.id} style={[styles.item, a.leida && styles.itemLeida]}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemEmoji}>
                  {a.tipo === 'stock_bajo' ? '⚠️' : '🔔'}
                </Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemMensaje, a.leida && styles.itemMensajeLeido]}>
                  {a.mensaje}
                </Text>
                {a.producto && (
                  <Text style={styles.itemStock}>
                    Stock actual: {a.producto.stock} / Mínimo: {a.producto.stock_minimo}
                  </Text>
                )}
                <Text style={styles.itemFecha}>{formatFecha(a.enviada_en)}</Text>
              </View>
              {!a.leida && (
                <TouchableOpacity
                  style={styles.btnLeida}
                  onPress={() => marcarLeida(a.id)}
                >
                  <Text style={styles.btnLeidaTxt}>✓</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  tituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  btnTodas: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  btnTodasTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  vacioCont: { alignItems: 'center', marginTop: 60 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioTxt: { color: colors.textSecondary, fontSize: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  itemLeida: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  itemLeft: { marginRight: 12, paddingTop: 2 },
  itemEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemMensaje: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemMensajeLeido: { color: colors.textSecondary, fontWeight: '400' },
  itemStock: { color: colors.yellow, fontSize: 12, marginBottom: 4 },
  itemFecha: { color: colors.textSecondary, fontSize: 11 },
  btnLeida: {
    backgroundColor: colors.green,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  btnLeidaTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
})