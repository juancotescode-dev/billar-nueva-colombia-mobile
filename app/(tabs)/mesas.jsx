import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function tiempoTranscurrido(fechaISO) {
  if (!fechaISO) return ''
  const diff = Date.now() - new Date(fechaISO).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

function ModalMesa({ mesa, visible, onCerrar }) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [tiempo, setTiempo] = useState('')

  useEffect(() => {
    if (!visible || !mesa) return
    cargarDetalle()
    if (mesa.estado === 'ocupada') {
      setTiempo(tiempoTranscurrido(mesa.abierta_en))
      const interval = setInterval(() => {
        setTiempo(tiempoTranscurrido(mesa.abierta_en))
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [visible, mesa])

  async function cargarDetalle() {
    if (mesa.estado !== 'ocupada') return
    setCargando(true)
    try {
      const { data: sesion } = await supabase
        .from('sesiones')
        .select('*')
        .eq('mesa_id', mesa.id)
        .eq('estado', 'activa')
        .single()

      if (!sesion) return

      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('sesion_id', sesion.id)
        .order('registrado_en')

      const productoIds = [...new Set((ventas || []).map(v => v.producto_id))]
      let productosMap = {}
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre')
          .in('id', productoIds)
        ;(productos || []).forEach(p => { productosMap[p.id] = p })
      }

      const ventasConProducto = (ventas || []).map(v => ({
        ...v,
        productos: productosMap[v.producto_id] || null
      }))

      let turnos = []
      if (mesa.tipo === 'billar') {
        const { data } = await supabase
          .from('turnos_billar')
          .select('*')
          .eq('sesion_id', sesion.id)
          .order('registrado_en')
        turnos = data || []
      }

      const totalVentas = ventasConProducto.reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
      const totalTurnos = turnos.reduce((s, t) => s + Number(t.costo_turno), 0)

      setDetalle({
        sesion,
        ventas: ventasConProducto,
        turnos,
        totalVentas,
        totalTurnos,
        total: totalVentas + totalTurnos
      })
    } catch (err) {
      console.error('Error cargando detalle:', err.message)
    } finally {
      setCargando(false)
    }
  }

  if (!mesa) return null

  const ocupada = mesa.estado === 'ocupada'
  const esBillar = mesa.tipo === 'billar'
  const tipoLabel = mesa.tipo === 'billar' ? 'Billar' : mesa.tipo === 'domino' ? 'Dominó' : 'General'
  const emoji = mesa.tipo === 'billar' ? '🎱' : mesa.tipo === 'domino' ? '⬜' : '🪑'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitulo}>{emoji} Mesa {mesa.numero} — {tipoLabel}</Text>
              <View style={[styles.badge, { backgroundColor: ocupada ? colors.red : colors.green }]}>
                <Text style={styles.badgeTxt}>{ocupada ? 'Ocupada' : 'Libre'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCerrar} style={styles.btnCerrar}>
              <Text style={styles.btnCerrarTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            {!ocupada ? (
              <Text style={styles.libreMsg}>Esta mesa está disponible.</Text>
            ) : cargando ? (
              <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
            ) : detalle ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Abierta a las</Text>
                  <Text style={styles.infoValor}>
                    {new Date(detalle.sesion.abierta_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tiempo transcurrido</Text>
                  <Text style={styles.infoValor}>⏱ {tiempo}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Personas</Text>
                  <Text style={styles.infoValor}>{detalle.sesion.num_personas}</Text>
                </View>

                {esBillar && (
                  <>
                    <Text style={styles.seccionLabel}>Turnos jugados ({detalle.turnos.length})</Text>
                    {detalle.turnos.length === 0 ? (
                      <Text style={styles.vacio}>Sin turnos registrados</Text>
                    ) : (
                      detalle.turnos.map((t, i) => (
                        <View key={t.id} style={styles.itemRow}>
                          <Text style={styles.itemNombre}>Turno {i + 1}</Text>
                          <Text style={styles.itemValor}>{formatCOP(t.costo_turno)}</Text>
                        </View>
                      ))
                    )}
                    <View style={styles.subtotalRow}>
                      <Text style={styles.subtotalLabel}>Subtotal turnos</Text>
                      <Text style={styles.subtotalValor}>{formatCOP(detalle.totalTurnos)}</Text>
                    </View>
                  </>
                )}

                <Text style={styles.seccionLabel}>Ventas ({detalle.ventas.length})</Text>
                {detalle.ventas.length === 0 ? (
                  <Text style={styles.vacio}>Sin ventas registradas</Text>
                ) : (
                  detalle.ventas.map(v => (
                    <View key={v.id} style={styles.itemRow}>
                      <Text style={styles.itemNombre}>
                        {v.productos?.nombre || 'Producto'} x{v.cantidad}
                      </Text>
                      <Text style={styles.itemValor}>{formatCOP(v.precio_venta * v.cantidad)}</Text>
                    </View>
                  ))
                )}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal ventas</Text>
                  <Text style={styles.subtotalValor}>{formatCOP(detalle.totalVentas)}</Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total acumulado</Text>
                  <Text style={styles.totalValor}>{formatCOP(detalle.total)}</Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function TarjetaMesa({ mesa, onPress }) {
  const ocupada = mesa.estado === 'ocupada'
  const [tiempo, setTiempo] = useState(tiempoTranscurrido(mesa.abierta_en))

  useEffect(() => {
    if (!ocupada) return
    const interval = setInterval(() => {
      setTiempo(tiempoTranscurrido(mesa.abierta_en))
    }, 60000)
    return () => clearInterval(interval)
  }, [ocupada, mesa.abierta_en])

  return (
    <TouchableOpacity
      style={[styles.tarjeta, ocupada ? styles.tarjetaOcupada : styles.tarjetaLibre]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.tarjetaHeader}>
        <Text style={styles.tarjetaTipo}>
          {mesa.tipo === 'billar' ? '🎱' : mesa.tipo === 'domino' ? '⬜' : '🪑'}
        </Text>
        <View style={[styles.badge, { backgroundColor: ocupada ? colors.red : colors.green }]}>
          <Text style={styles.badgeTxt}>{ocupada ? 'Ocupada' : 'Libre'}</Text>
        </View>
      </View>
      <Text style={styles.tarjetaNumero}>Mesa {mesa.numero}</Text>
      <Text style={styles.tarjetaTipoTxt}>
        {mesa.tipo === 'billar' ? 'Billar' : mesa.tipo === 'domino' ? 'Dominó' : 'General'}
      </Text>
      {ocupada && <Text style={styles.tarjetaTiempo}>⏱ {tiempo}</Text>}
    </TouchableOpacity>
  )
}

export default function Mesas() {
  const insets = useSafeAreaInsets()
  const [mesas, setMesas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  async function cargarMesas() {
    try {
      const { data: mesasData, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('activo', true)
        .order('tipo')
        .order('numero')

      if (error) throw error

      const { data: sesionesData } = await supabase
        .from('sesiones')
        .select('mesa_id, abierta_en')
        .eq('estado', 'activa')

      const sesionesMap = {}
      ;(sesionesData || []).forEach(s => {
        sesionesMap[s.mesa_id] = s.abierta_en
      })

      const mesasConSesion = (mesasData || []).map(m => ({
        ...m,
        abierta_en: sesionesMap[m.id] || null
      }))

      setMesas(mesasConSesion)
    } catch (err) {
      console.error('Error cargando mesas:', err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarMesas()
  }, [])

  usePolling(cargarMesas, 10000)

  function abrirModal(mesa) {
    setMesaSeleccionada(mesa)
    setModalVisible(true)
  }

  const billar = mesas.filter(m => m.tipo === 'billar')
  const domino = mesas.filter(m => m.tipo === 'domino')
  const general = mesas.filter(m => m.tipo === 'general')
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>🗺 Mapa de Mesas</Text>
        <Text style={styles.subtitulo}>
          {ocupadas} ocupada{ocupadas !== 1 ? 's' : ''} de {mesas.length} en total
        </Text>

        {billar.length > 0 && (
          <>
            <Text style={styles.seccion}>Billar</Text>
            <View style={styles.grid}>
              {billar.map(m => <TarjetaMesa key={m.id} mesa={m} onPress={() => abrirModal(m)} />)}
            </View>
          </>
        )}

        {domino.length > 0 && (
          <>
            <Text style={styles.seccion}>Dominó</Text>
            <View style={styles.grid}>
              {domino.map(m => <TarjetaMesa key={m.id} mesa={m} onPress={() => abrirModal(m)} />)}
            </View>
          </>
        )}

        {general.length > 0 && (
          <>
            <Text style={styles.seccion}>General</Text>
            <View style={styles.grid}>
              {general.map(m => <TarjetaMesa key={m.id} mesa={m} onPress={() => abrirModal(m)} />)}
            </View>
          </>
        )}
      </ScrollView>

      <ModalMesa
        mesa={mesaSeleccionada}
        visible={modalVisible}
        onCerrar={() => setModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  subtitulo: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  seccion: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tarjeta: { width: '47%', borderRadius: 12, padding: 14, borderWidth: 1 },
  tarjetaLibre: { backgroundColor: colors.card, borderColor: colors.border },
  tarjetaOcupada: { backgroundColor: '#1a1a2e', borderColor: colors.red },
  tarjetaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tarjetaTipo: { fontSize: 20 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, color: '#fff', fontWeight: '700' },
  tarjetaNumero: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  tarjetaTipoTxt: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tarjetaTiempo: { fontSize: 12, color: colors.yellow, marginTop: 6, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  btnCerrar: { padding: 4 },
  btnCerrarTxt: { fontSize: 18, color: colors.textSecondary },
  modalScroll: { maxHeight: '90%' },
  libreMsg: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textSecondary, fontSize: 14 },
  infoValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  seccionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  vacio: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemNombre: { color: colors.textPrimary, fontSize: 14, flex: 1, marginRight: 8 },
  itemValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
  subtotalLabel: { color: colors.textSecondary, fontSize: 14 },
  subtotalValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 2, borderTopColor: colors.blue, marginTop: 8 },
  totalLabel: { color: colors.blue, fontSize: 16, fontWeight: '700' },
  totalValor: { color: colors.blue, fontSize: 16, fontWeight: '700' },
})