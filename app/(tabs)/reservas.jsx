import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { guardarCache, leerCacheSinExpiry } from '../../src/hooks/useCache'

function formatFechaCompleta(fechaISO) {
  return new Date(fechaISO).toLocaleString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatHora(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const ESTADOS_COLOR = {
  pendiente: colors.yellow,
  confirmada: colors.green,
  cancelada: colors.red,
}

function ModalAgregarReserva({ visible, onCerrar, onGuardado, mesas }) {
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nota, setNota] = useState('')
  const [mesaId, setMesaId] = useState(null)
  const [fecha, setFecha] = useState(new Date())
  const [mostrandoFecha, setMostrandoFecha] = useState(false)
  const [mostrandoHora, setMostrandoHora] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function limpiar() {
    setNombreCliente('')
    setTelefono('')
    setNota('')
    setMesaId(null)
    setFecha(new Date())
  }

  function onChangeFecha(event, selectedDate) {
    setMostrandoFecha(false)
    if (event.type === 'dismissed') return
    if (selectedDate) {
      const nueva = new Date(fecha)
      nueva.setFullYear(selectedDate.getFullYear())
      nueva.setMonth(selectedDate.getMonth())
      nueva.setDate(selectedDate.getDate())
      setFecha(nueva)
    }
  }

  function onChangeHora(event, selectedTime) {
    setMostrandoHora(false)
    if (event.type === 'dismissed') return
    if (selectedTime) {
      const nueva = new Date(fecha)
      nueva.setHours(selectedTime.getHours())
      nueva.setMinutes(selectedTime.getMinutes())
      setFecha(nueva)
    }
  }

async function guardar() {
  if (!nombreCliente.trim()) {
    Alert.alert('Error', 'El nombre del cliente es obligatorio')
    return
  }
  if (!mesaId) {
    Alert.alert('Error', 'Selecciona una mesa')
    return
  }
  if (fecha < new Date()) {
    Alert.alert('Error', 'La fecha debe ser en el futuro')
    return
  }

  setGuardando(true)
  try {
    const fechaInicioDia = new Date(fecha)
    fechaInicioDia.setHours(0, 0, 0, 0)
    const fechaFinDia = new Date(fecha)
    fechaFinDia.setHours(23, 59, 59, 999)

    const { data: reservasMismaMesa, error: errorConsulta } = await supabase
      .from('reservas')
      .select('id, fecha_reserva, estado')
      .eq('mesa_id', mesaId)
      .neq('estado', 'cancelada')
      .gte('fecha_reserva', fechaInicioDia.toISOString())
      .lte('fecha_reserva', fechaFinDia.toISOString())

    if (errorConsulta) throw new Error(errorConsulta.message)

    const conflicto = (reservasMismaMesa || []).find(r => {
      const distancia = Math.abs(new Date(r.fecha_reserva) - fecha)
      return distancia <= 2 * 60 * 60 * 1000
    })

    if (conflicto) {
      Alert.alert(
        'Error',
        'Ya existe una reserva para esta mesa en un horario cercano (2 horas de margen). Elige otra hora o mesa.'
      )
      return
    }

    const { error } = await supabase.from('reservas').insert({
      mesa_id: mesaId,
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim() || null,
      fecha_reserva: fecha.toISOString(),
      nota: nota.trim() || null,
      estado: 'pendiente',
    })
    if (error) throw new Error(error.message)
    limpiar()
    onGuardado()
    onCerrar()
  } catch (err) {
    Alert.alert('Error', err.message)
  } finally {
    setGuardando(false)
  }
}

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>📅 Nueva reserva</Text>
            <TouchableOpacity onPress={onCerrar}>
              <Text style={styles.btnCerrarTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Nombre del cliente *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Juan García"
              placeholderTextColor={colors.textSecondary}
              value={nombreCliente}
              onChangeText={setNombreCliente}
            />

            <Text style={styles.inputLabel}>Teléfono</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 3001234567"
              placeholderTextColor={colors.textSecondary}
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Fecha y hora *</Text>
            <View style={styles.fechaRow}>
              <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrandoFecha(true)}>
                <Text style={styles.fechaBtnTxt}>
                  📅 {fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrandoHora(true)}>
                <Text style={styles.fechaBtnTxt}>🕐 {formatHora(fecha)}</Text>
              </TouchableOpacity>
            </View>

            {mostrandoFecha && (
              <DateTimePicker value={fecha} mode="date" minimumDate={new Date()} onChange={onChangeFecha} />
            )}
            {mostrandoHora && (
              <DateTimePicker value={fecha} mode="time" onChange={onChangeHora} />
            )}

            <Text style={styles.inputLabel}>Mesa *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {mesas.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.mesaBtn, mesaId === m.id && styles.mesaBtnActivo]}
                    onPress={() => setMesaId(m.id)}
                  >
                    <Text style={[styles.mesaBtnTxt, mesaId === m.id && styles.mesaBtnTxtActivo]}>
                      {m.tipo === 'billar' ? '🎱' : m.tipo === 'domino' ? '⬜' : '🪑'} {m.numero}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>Notas</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Observaciones adicionales..."
              placeholderTextColor={colors.textSecondary}
              value={nota}
              onChangeText={setNota}
              multiline
            />

            <TouchableOpacity
              style={[styles.btnGuardar, guardando && { opacity: 0.6 }]}
              onPress={guardar}
              disabled={guardando}
            >
              <Text style={styles.btnGuardarTxt}>
                {guardando ? 'Guardando...' : 'Crear reserva'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export default function Reservas() {
  const insets = useSafeAreaInsets()
  const [reservas, setReservas] = useState([])
  const [mesas, setMesas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [filtro, setFiltro] = useState('todas')

  async function cargarMesas() {
    const { data } = await supabase.from('mesas').select('*').eq('activo', true).order('tipo').order('numero')
    setMesas(data || [])
  }

  async function cargarReservas() {
    try {
      let query = supabase
        .from('reservas')
        .select('*')
        .order('fecha_reserva', { ascending: true })

      if (filtro !== 'todas') {
        query = query.eq('estado', filtro)
      }

      const { data, error } = await query
      if (error) throw error

      const mesaIds = [...new Set((data || []).map(r => r.mesa_id))]
      let mesasMap = {}
      if (mesaIds.length > 0) {
        const { data: mesasData } = await supabase
          .from('mesas')
          .select('id, numero, tipo')
          .in('id', mesaIds)
        ;(mesasData || []).forEach(m => { mesasMap[m.id] = m })
      }

      const reservasConMesa = (data || []).map(r => ({
        ...r,
        mesa: mesasMap[r.mesa_id] || null
      }))

      await guardarCache(`reservas_${filtro}`, reservasConMesa)
      setReservas(reservasConMesa)
    } catch (err) {
      console.error('Error cargando reservas:', err.message)
      const cache = await leerCacheSinExpiry(`reservas_${filtro}`)
      if (cache) setReservas(cache)
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    cargarMesas()
  }, [])

  useEffect(() => {
    setCargando(true)
    cargarReservas()
  }, [filtro])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarReservas()
  }, [filtro])

  async function cambiarEstado(id, nuevoEstado) {
    const labels = { confirmada: 'confirmar', cancelada: 'cancelar' }
    Alert.alert(
      `${nuevoEstado === 'confirmada' ? 'Confirmar' : 'Cancelar'} reserva`,
      `¿Deseas ${labels[nuevoEstado]} esta reserva?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: nuevoEstado === 'cancelada' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (nuevoEstado === 'cancelada') {
                const { error } = await supabase
                  .from('reservas')
                  .delete()
                  .eq('id', id)
                if (error) throw new Error(error.message)
              } else {
                const { error } = await supabase
                  .from('reservas')
                  .update({ estado: nuevoEstado })
                  .eq('id', id)
                if (error) throw new Error(error.message)
              }
              cargarReservas()
            } catch (err) {
              Alert.alert('Error', err.message)
            }
          }
        }
      ]
    )
  }

  async function eliminarReserva(id) {
    Alert.alert(
      'Eliminar reserva',
      '¿Deseas eliminar esta reserva confirmada?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reservas')
                .delete()
                .eq('id', id)
              if (error) throw new Error(error.message)
              cargarReservas()
            } catch (err) {
              Alert.alert('Error', err.message)
            }
          }
        }
      ]
    )
  }

  const pendientes = reservas.filter(r => r.estado === 'pendiente').length

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Filtros */}
    <View style={styles.filtrosContainer}>
      {['pendiente', 'todas'].map(f => (
        <TouchableOpacity
          key={f}
          style={[styles.filtroBtn, filtro === f && styles.filtroBtnActivo]}
          onPress={() => setFiltro(f)}
        >
          <Text style={[styles.filtroBtnTxt, filtro === f && styles.filtroBtnTxtActivo]}>
            {f === 'pendiente' ? 'Pendientes' : 'Todas'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          <View style={styles.tituloRow}>
            <View>
              <Text style={styles.titulo}>📅 Reservas</Text>
              {pendientes > 0 && (
                <Text style={styles.subtitulo}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.btnAgregar} onPress={() => setModalVisible(true)}>
              <Text style={styles.btnAgregarTxt}>+ Nueva</Text>
            </TouchableOpacity>
          </View>

          {reservas.length === 0 ? (
            <View style={styles.vacioCont}>
              <Text style={styles.vacioEmoji}>📭</Text>
              <Text style={styles.vacioTxt}>No hay reservas {filtro !== 'todas' ? filtro + 's' : ''}</Text>
            </View>
          ) : (
            reservas.map(r => (
              <View key={r.id} style={[styles.item, { borderLeftColor: ESTADOS_COLOR[r.estado] || colors.border }]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemCliente}>{r.nombre_cliente}</Text>
                  <View style={[styles.estadoBadge, { backgroundColor: ESTADOS_COLOR[r.estado] + '33' }]}>
                    <Text style={[styles.estadoTxt, { color: ESTADOS_COLOR[r.estado] }]}>
                      {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemFecha}>🕐 {formatFechaCompleta(r.fecha_reserva)}</Text>

                {r.mesa && (
                  <Text style={styles.itemMesa}>
                    {r.mesa.tipo === 'billar' ? '🎱' : r.mesa.tipo === 'domino' ? '⬜' : '🪑'} Mesa {r.mesa.numero} — {r.mesa.tipo.charAt(0).toUpperCase() + r.mesa.tipo.slice(1)}
                  </Text>
                )}

                {r.telefono && <Text style={styles.itemTel}>📞 {r.telefono}</Text>}
                {r.nota && <Text style={styles.itemNota}>📝 {r.nota}</Text>}

                {r.estado === 'pendiente' && (
                  <View style={styles.accionesRow}>
                    <TouchableOpacity
                      style={[styles.btnAccion, { backgroundColor: colors.green + '22', borderColor: colors.green }]}
                      onPress={() => cambiarEstado(r.id, 'confirmada')}
                    >
                      <Text style={[styles.btnAccionTxt, { color: colors.green }]}>✓ Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAccion, { backgroundColor: colors.red + '22', borderColor: colors.red }]}
                      onPress={() => cambiarEstado(r.id, 'cancelada')}
                    >
                      <Text style={[styles.btnAccionTxt, { color: colors.red }]}>✕ Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {r.estado === 'confirmada' && (
                  <View style={styles.accionesRow}>
                    <TouchableOpacity
                      style={[styles.btnAccion, { backgroundColor: colors.red + '22', borderColor: colors.red }]}
                      onPress={() => eliminarReserva(r.id)}
                    >
                      <Text style={[styles.btnAccionTxt, { color: colors.red }]}>🗑 Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ModalAgregarReserva
        visible={modalVisible}
        onCerrar={() => setModalVisible(false)}
        onGuardado={cargarReservas}
        mesas={mesas}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filtrosContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filtroBtnActivo: { backgroundColor: colors.blue, borderColor: colors.blue },
  filtroBtnTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filtroBtnTxtActivo: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 32 },
  tituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 13, color: colors.yellow, marginTop: 2 },
  btnAgregar: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnAgregarTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  vacioCont: { alignItems: 'center', marginTop: 60 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioTxt: { color: colors.textSecondary, fontSize: 16 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemCliente: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', flex: 1 },
  estadoBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  estadoTxt: { fontSize: 12, fontWeight: '700' },
  itemFecha: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  itemMesa: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  itemTel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  itemNota: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  accionesRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnAccion: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 8, alignItems: 'center' },
  btnAccionTxt: { fontSize: 13, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  btnCerrarTxt: { fontSize: 18, color: colors.textSecondary },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 16 },
  fechaRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  fechaBtn: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' },
  fechaBtnTxt: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  mesaBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  mesaBtnActivo: { backgroundColor: colors.blue, borderColor: colors.blue },
  mesaBtnTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  mesaBtnTxtActivo: { color: '#fff' },
  btnGuardar: { backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnGuardarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})