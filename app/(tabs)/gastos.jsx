import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

function formatFecha(fechaISO) {
  return new Date(fechaISO).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const CATEGORIAS = ['Nómina', 'Insumos', 'Servicios', 'Mantenimiento', 'Otros']

const CATEGORIAS_COLORES = {
  'Nómina': '#2a1a3a',
  'Insumos': '#1a3a2a',
  'Servicios': '#1e3a5f',
  'Mantenimiento': '#3a1a1a',
  'Otros': '#2a2a2a',
}

function ModalAgregarGasto({ visible, onCerrar, onGuardado }) {
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('Servicios')
  const [guardando, setGuardando] = useState(false)

  function limpiar() {
    setDescripcion('')
    setMonto('')
    setCategoria('Servicios')
  }

  async function guardar() {
    if (!descripcion.trim()) {
      Alert.alert('Error', 'La descripción es obligatoria')
      return
    }
    const montoNum = parseFloat(monto.replace(',', '.'))
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido')
      return
    }

    setGuardando(true)
    try {
      const { error } = await supabase
        .from('gastos')
        .insert({
          descripcion: descripcion.trim(),
          monto: montoNum,
          categoria,
          fecha: new Date().toISOString()
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
            <Text style={styles.modalTitulo}>➕ Nuevo gasto</Text>
            <TouchableOpacity onPress={onCerrar} style={styles.btnCerrar}>
              <Text style={styles.btnCerrarTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Descripción</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Pago de luz"
            placeholderTextColor={colors.textSecondary}
            value={descripcion}
            onChangeText={setDescripcion}
          />

          <Text style={styles.inputLabel}>Monto</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 50000"
            placeholderTextColor={colors.textSecondary}
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriasScroll}>
            <View style={styles.categoriasRow}>
              {CATEGORIAS.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, categoria === cat && styles.catBtnActivo]}
                  onPress={() => setCategoria(cat)}
                >
                  <Text style={[styles.catBtnTxt, categoria === cat && styles.catBtnTxtActivo]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.btnGuardar, guardando && { opacity: 0.6 }]}
            onPress={guardar}
            disabled={guardando}
          >
            <Text style={styles.btnGuardarTxt}>
              {guardando ? 'Guardando...' : 'Guardar gasto'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function SelectorMesAnio({ mes, anio, onCambiarMes, onCambiarAnio }) {
  const hoy = new Date()
  const anios = []
  for (let a = hoy.getFullYear(); a >= hoy.getFullYear() - 3; a--) anios.push(a)

  return (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorGrupo}>
        <Text style={styles.selectorLabel}>Mes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.selectorRow}>
            {MESES.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.selectorBtn, mes === i && styles.selectorBtnActivo]}
                onPress={() => onCambiarMes(i)}
              >
                <Text style={[styles.selectorBtnTxt, mes === i && styles.selectorBtnTxtActivo]}>
                  {m.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={styles.selectorGrupo}>
        <Text style={styles.selectorLabel}>Año</Text>
        <View style={styles.selectorRow}>
          {anios.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.selectorBtn, anio === a && styles.selectorBtnActivo]}
              onPress={() => onCambiarAnio(a)}
            >
              <Text style={[styles.selectorBtnTxt, anio === a && styles.selectorBtnTxtActivo]}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

export default function Gastos() {
  const insets = useSafeAreaInsets()
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [gastos, setGastos] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  function obtenerRango() {
    const inicio = new Date(anio, mes, 1, 0, 0, 0)
    const fin = new Date(anio, mes + 1, 0, 23, 59, 59, 999)
    return { inicio, fin }
  }

  async function cargarDatos() {
    try {
      const { inicio, fin } = obtenerRango()
      const inicioISO = inicio.toISOString()
      const finISO = fin.toISOString()

      const { data: gastosData, error } = await supabase
        .from('gastos')
        .select('*')
        .gte('fecha', inicioISO)
        .lte('fecha', finISO)
        .order('fecha', { ascending: false })

      if (error) throw error

      // Para el resumen usamos siempre el día de hoy
      const hoyInicio = new Date()
      hoyInicio.setHours(0, 0, 0, 0)
      const hoyFin = new Date()
      hoyFin.setHours(23, 59, 59, 999)

      const { data: ventas } = await supabase
        .from('ventas')
        .select('precio_venta, cantidad, producto_id')
        .gte('registrado_en', hoyInicio.toISOString())
        .lte('registrado_en', hoyFin.toISOString())

      const { data: turnos } = await supabase
        .from('turnos_billar')
        .select('costo_turno')
        .gte('registrado_en', hoyInicio.toISOString())
        .lte('registrado_en', hoyFin.toISOString())

      const { data: gastosHoy } = await supabase
        .from('gastos')
        .select('monto')
        .gte('fecha', hoyInicio.toISOString())
        .lte('fecha', hoyFin.toISOString())

      const productoIds = [...new Set((ventas || []).map(v => v.producto_id))]
      let productosMap = {}
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, costo_compra')
          .in('id', productoIds)
        ;(productos || []).forEach(p => { productosMap[p.id] = p })
      }

      const totalVentas = (ventas || []).reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
      const totalTurnos = (turnos || []).reduce((s, t) => s + Number(t.costo_turno), 0)
      const totalGastosHoy = (gastosHoy || []).reduce((s, g) => s + Number(g.monto), 0)
      const ingresos = totalVentas + totalTurnos
      const costoVentas = (ventas || []).reduce((s, v) => {
        const costo = productosMap[v.producto_id]?.costo_compra || 0
        return s + costo * v.cantidad
      }, 0)

      setGastos(gastosData || [])
      setResumen({
        ingresos,
        gananciaBruta: ingresos - costoVentas,
        gananciaNeta: ingresos - totalGastosHoy,
        totalGastos: totalGastosHoy,
      })
    } catch (err) {
      console.error('Error cargando datos:', err.message)
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setCargando(true)
    cargarDatos()
  }, [mes, anio])

  usePolling(cargarDatos, 15000)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarDatos()
  }, [])

  async function eliminarGasto(id) {
    Alert.alert(
      'Eliminar gasto',
      '¿Estás seguro de que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('gastos').delete().eq('id', id)
              if (error) throw new Error(error.message)
              cargarDatos()
            } catch (err) {
              Alert.alert('Error', err.message)
            }
          }
        }
      ]
    )
  }

  const porCategoria = gastos.reduce((acc, g) => {
    const cat = g.categoria || 'Sin categoría'
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 }
    acc[cat].total += Number(g.monto)
    acc[cat].count += 1
    return acc
  }, {})

  const totalMes = gastos.reduce((s, g) => s + Number(g.monto), 0)

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SelectorMesAnio
        mes={mes}
        anio={anio}
        onCambiarMes={setMes}
        onCambiarAnio={setAnio}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        }
      >
        <View style={styles.tituloRow}>
          <Text style={styles.titulo}>💰 Resumen financiero</Text>
          <TouchableOpacity style={styles.btnAgregar} onPress={() => setModalVisible(true)}>
            <Text style={styles.btnAgregarTxt}>+ Gasto</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitulo}>Resumen del día de hoy</Text>

        {resumen && (
          <View style={styles.grid}>
            <View style={[styles.card, { borderColor: colors.green }]}>
              <Text style={styles.cardLabel}>Ingresos</Text>
              <Text style={[styles.cardValor, { color: colors.green }]}>{formatCOP(resumen.ingresos)}</Text>
            </View>
            <View style={[styles.card, { borderColor: colors.red }]}>
              <Text style={styles.cardLabel}>Gastos</Text>
              <Text style={[styles.cardValor, { color: colors.red }]}>{formatCOP(resumen.totalGastos)}</Text>
            </View>
            <View style={[styles.card, { borderColor: colors.blue }]}>
              <Text style={styles.cardLabel}>Ganancia bruta</Text>
              <Text style={[styles.cardValor, { color: colors.blue }]}>{formatCOP(resumen.gananciaBruta)}</Text>
            </View>
            <View style={[styles.card, { borderColor: resumen.gananciaNeta >= 0 ? colors.green : colors.red }]}>
              <Text style={styles.cardLabel}>Ganancia neta</Text>
              <Text style={[styles.cardValor, { color: resumen.gananciaNeta >= 0 ? colors.green : colors.red }]}>
                {formatCOP(resumen.gananciaNeta)}
              </Text>
            </View>
          </View>
        )}

        {Object.keys(porCategoria).length > 0 && (
          <>
            <Text style={styles.seccion}>Gastos por categoría — {MESES[mes]} {anio}</Text>
            <View style={styles.categoriasGrid}>
              {Object.entries(porCategoria).map(([cat, info]) => (
                <View key={cat} style={styles.categoriaCard}>
                  <Text style={styles.categoriaNombre}>{cat}</Text>
                  <Text style={styles.categoriaValor}>{formatCOP(info.total)}</Text>
                  <Text style={styles.categoriaCuenta}>{info.count} registro{info.count !== 1 ? 's' : ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.totalMesRow}>
          <Text style={styles.totalMesLabel}>Total gastos {MESES[mes]} {anio}</Text>
          <Text style={styles.totalMesValor}>{formatCOP(totalMes)}</Text>
        </View>

        <Text style={styles.seccion}>Detalle de gastos</Text>
        {gastos.length === 0 ? (
          <Text style={styles.vacio}>No hay gastos en {MESES[mes]} {anio}.</Text>
        ) : (
          gastos.map(g => (
            <View key={g.id} style={styles.item}>
              <View style={[styles.itemBadge, { backgroundColor: CATEGORIAS_COLORES[g.categoria] || '#2a2a2a' }]}>
                <Text style={styles.itemBadgeTxt}>💸</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemNombre}>{g.descripcion}</Text>
                <Text style={styles.itemCat}>
                  {g.categoria || 'Sin categoría'} · {formatFecha(g.fecha)}
                </Text>
              </View>
              <View style={styles.itemDerecha}>
                <Text style={styles.itemMonto}>{formatCOP(g.monto)}</Text>
                <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminarGasto(g.id)}>
                  <Text style={styles.btnEliminarTxt}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ModalAgregarGasto
        visible={modalVisible}
        onCerrar={() => setModalVisible(false)}
        onGuardado={cargarDatos}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  selectorContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  selectorGrupo: { gap: 6 },
  selectorLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  selectorRow: { flexDirection: 'row', gap: 6 },
  selectorBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  selectorBtnActivo: { backgroundColor: colors.blue, borderColor: colors.blue },
  selectorBtnTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  selectorBtnTxtActivo: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 32 },
  tituloRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', fontWeight: '600' },
  btnAgregar: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnAgregarTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, width: '47%', borderWidth: 1 },
  cardLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  cardValor: { fontSize: 18, fontWeight: 'bold' },
  seccion: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  categoriasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  categoriaCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, width: '47%', borderWidth: 1, borderColor: colors.border },
  categoriaNombre: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  categoriaValor: { color: colors.red, fontSize: 16, fontWeight: 'bold' },
  categoriaCuenta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  totalMesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.red },
  totalMesLabel: { color: colors.textSecondary, fontSize: 14 },
  totalMesValor: { color: colors.red, fontSize: 18, fontWeight: 'bold' },
  vacio: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  itemBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemBadgeTxt: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemNombre: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  itemCat: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemDerecha: { alignItems: 'flex-end', gap: 4 },
  itemMonto: { color: colors.red, fontSize: 15, fontWeight: 'bold' },
  btnEliminar: { padding: 4 },
  btnEliminarTxt: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  btnCerrar: { padding: 4 },
  btnCerrarTxt: { fontSize: 18, color: colors.textSecondary },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 16 },
  categoriasScroll: { marginBottom: 20 },
  categoriasRow: { flexDirection: 'row', gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  catBtnActivo: { backgroundColor: colors.blue, borderColor: colors.blue },
  catBtnTxt: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  catBtnTxtActivo: { color: '#fff' },
  btnGuardar: { backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnGuardarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})