import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

function formatHora(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(fechaISO) {
  return new Date(fechaISO).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

const RANGOS = [
  { label: 'Hoy', dias: 0 },
  { label: 'Ayer', dias: 1 },
  { label: '7 días', dias: 7 },
  { label: '15 días', dias: 15 },
  { label: '30 días', dias: 30 },
]

export default function Historial() {
  const insets = useSafeAreaInsets()
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [rangoSeleccionado, setRangoSeleccionado] = useState(0)

  function obtenerFechas(dias) {
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)
    const inicio = new Date()
    if (dias === 1) {
      inicio.setDate(inicio.getDate() - 1)
      inicio.setHours(0, 0, 0, 0)
      fin.setDate(fin.getDate() - 1)
      fin.setHours(23, 59, 59, 999)
    } else {
      inicio.setDate(inicio.getDate() - dias)
      inicio.setHours(0, 0, 0, 0)
    }
    return { inicio, fin }
  }

  async function cargarHistorial() {
    try {
      const { inicio, fin } = obtenerFechas(RANGOS[rangoSeleccionado].dias)

      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .gte('registrado_en', inicio.toISOString())
        .lte('registrado_en', fin.toISOString())
        .order('registrado_en', { ascending: false })

      const { data: turnos } = await supabase
        .from('turnos_billar')
        .select('*')
        .gte('registrado_en', inicio.toISOString())
        .lte('registrado_en', fin.toISOString())
        .order('registrado_en', { ascending: false })

      const productoIds = [...new Set((ventas || []).map(v => v.producto_id))]
      let productosMap = {}
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, categoria')
          .in('id', productoIds)
        ;(productos || []).forEach(p => { productosMap[p.id] = p })
      }

      const ventasMapped = (ventas || []).map(v => ({
        id: `v-${v.id}`,
        tipo: 'venta',
        descripcion: `${productosMap[v.producto_id]?.nombre || 'Producto'} x${v.cantidad}`,
        categoria: productosMap[v.producto_id]?.categoria || 'Sin categoría',
        monto: v.precio_venta * v.cantidad,
        hora: v.registrado_en,
      }))

      const turnosMapped = (turnos || []).map(t => ({
        id: `t-${t.id}`,
        tipo: 'turno',
        descripcion: 'Turno de billar',
        categoria: 'Billar',
        monto: t.costo_turno,
        hora: t.registrado_en,
      }))

      const todos = [...ventasMapped, ...turnosMapped]
        .sort((a, b) => new Date(b.hora) - new Date(a.hora))

      setRegistros(todos)
    } catch (err) {
      console.error('Error cargando historial:', err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    setCargando(true)
    cargarHistorial()
  }, [rangoSeleccionado])

  usePolling(cargarHistorial, 15000)

  const totalPeriodo = registros.reduce((s, r) => s + Number(r.monto), 0)
  const totalVentas = registros.filter(r => r.tipo === 'venta').reduce((s, r) => s + Number(r.monto), 0)
  const totalTurnos = registros.filter(r => r.tipo === 'turno').reduce((s, r) => s + Number(r.monto), 0)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Selector de rango */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rangosScroll}
        contentContainerStyle={styles.rangosContent}
      >
        {RANGOS.map((r, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.rangoBtn, rangoSeleccionado === i && styles.rangoBtnActivo]}
            onPress={() => setRangoSeleccionado(i)}
          >
            <Text style={[styles.rangoBtnTxt, rangoSeleccionado === i && styles.rangoBtnTxtActivo]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.titulo}>📋 Historial</Text>

          {/* Resumen */}
          <View style={styles.resumenCard}>
            <View style={styles.resumenRow}>
              <Text style={styles.resumenLabel}>Total período</Text>
              <Text style={styles.resumenTotal}>{formatCOP(totalPeriodo)}</Text>
            </View>
            <View style={styles.resumenDivider} />
            <View style={styles.resumenFila}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenSubLabel}>Ventas</Text>
                <Text style={[styles.resumenSubValor, { color: colors.blue }]}>{formatCOP(totalVentas)}</Text>
              </View>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenSubLabel}>Turnos</Text>
                <Text style={[styles.resumenSubValor, { color: colors.green }]}>{formatCOP(totalTurnos)}</Text>
              </View>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenSubLabel}>Registros</Text>
                <Text style={styles.resumenSubValor}>{registros.length}</Text>
              </View>
            </View>
          </View>

          {registros.length === 0 ? (
            <Text style={styles.vacio}>No hay registros para este período.</Text>
          ) : (
            registros.map(r => (
              <View key={r.id} style={styles.item}>
                <View style={[styles.itemBadge, { backgroundColor: r.tipo === 'turno' ? '#1e3a5f' : '#1a3a2a' }]}>
                  <Text style={styles.itemBadgeTxt}>{r.tipo === 'turno' ? '🎱' : '🛍'}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemNombre}>{r.descripcion}</Text>
                  <Text style={styles.itemCat}>
                    {r.categoria} · {RANGOS[rangoSeleccionado].dias > 1 ? formatFecha(r.hora) + ' ' : ''}{formatHora(r.hora)}
                  </Text>
                </View>
                <Text style={styles.itemMonto}>{formatCOP(r.monto)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rangosScroll: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 52,
  },
  rangosContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  rangoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  rangoBtnActivo: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  rangoBtnTxt: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  rangoBtnTxtActivo: {
    color: '#fff',
  },
  scroll: { padding: 16, paddingBottom: 32 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 },
  resumenCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumenLabel: { color: colors.textSecondary, fontSize: 14 },
  resumenTotal: { color: colors.green, fontSize: 20, fontWeight: 'bold' },
  resumenDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between' },
  resumenItem: { alignItems: 'center' },
  resumenSubLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  resumenSubValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  vacio: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemBadgeTxt: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemNombre: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  itemCat: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemMonto: { color: colors.green, fontSize: 15, fontWeight: 'bold' },
})