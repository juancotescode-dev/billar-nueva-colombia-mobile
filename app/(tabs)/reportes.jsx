import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, TouchableOpacity
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function Reportes() {
  const insets = useSafeAreaInsets()
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function cargarReporte() {
    try {
      const inicio = new Date(anio, mes, 1, 0, 0, 0)
      const fin = new Date(anio, mes + 1, 0, 23, 59, 59, 999)
      const inicioISO = inicio.toISOString()
      const finISO = fin.toISOString()

      const { data: ventas } = await supabase
        .from('ventas')
        .select('precio_venta, cantidad, producto_id, registrado_en')
        .gte('registrado_en', inicioISO)
        .lte('registrado_en', finISO)

      const { data: turnos } = await supabase
        .from('turnos_billar')
        .select('costo_turno, registrado_en')
        .gte('registrado_en', inicioISO)
        .lte('registrado_en', finISO)

      const { data: gastos } = await supabase
        .from('gastos')
        .select('monto, categoria')
        .gte('fecha', inicioISO)
        .lte('fecha', finISO)

      const productoIds = [...new Set((ventas || []).map(v => v.producto_id))]
      let productosMap = {}
      if (productoIds.length > 0) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, costo_compra, categoria')
          .in('id', productoIds)
        ;(productos || []).forEach(p => { productosMap[p.id] = p })
      }

      const totalVentas = (ventas || []).reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
      const totalTurnos = (turnos || []).reduce((s, t) => s + Number(t.costo_turno), 0)
      const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.monto), 0)
      const ingresos = totalVentas + totalTurnos
      const costoVentas = (ventas || []).reduce((s, v) => {
        const costo = productosMap[v.producto_id]?.costo_compra || 0
        return s + costo * v.cantidad
      }, 0)
      const gananciaBruta = ingresos - costoVentas
      const gananciaNeta = ingresos - totalGastos

      // Productos más vendidos
      const productosVendidos = {}
      ;(ventas || []).forEach(v => {
        const id = v.producto_id
        if (!productosVendidos[id]) {
          productosVendidos[id] = {
            nombre: productosMap[id]?.nombre || 'Producto',
            cantidad: 0,
            total: 0
          }
        }
        productosVendidos[id].cantidad += v.cantidad
        productosVendidos[id].total += v.precio_venta * v.cantidad
      })
      const topProductos = Object.values(productosVendidos)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5)

      // Gastos por categoría
      const gastosCat = {}
      ;(gastos || []).forEach(g => {
        const cat = g.categoria || 'Sin categoría'
        if (!gastosCat[cat]) gastosCat[cat] = 0
        gastosCat[cat] += Number(g.monto)
      })

      // Ingresos por día
      const ingresosDia = {}
      ;[...(ventas || []), ...(turnos || [])].forEach(r => {
        const fecha = new Date(r.registrado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
        if (!ingresosDia[fecha]) ingresosDia[fecha] = 0
        ingresosDia[fecha] += r.precio_venta ? r.precio_venta * r.cantidad : Number(r.costo_turno)
      })

      setDatos({
        ingresos,
        totalVentas,
        totalTurnos,
        totalGastos,
        gananciaBruta,
        gananciaNeta,
        numVentas: (ventas || []).length,
        numTurnos: (turnos || []).length,
        topProductos,
        gastosCat,
        ingresosDia,
      })
    } catch (err) {
      console.error('Error cargando reporte:', err.message)
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setCargando(true)
    cargarReporte()
  }, [mes, anio])

  usePolling(cargarReporte, 30000)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarReporte()
  }, [])

  const anios = []
  for (let a = hoy.getFullYear(); a >= 2026; a--) anios.push(a)

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Selector mes/año */}
      <View style={styles.selectorContainer}>
        <View style={styles.selectorGrupo}>
          <Text style={styles.selectorLabel}>Mes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.selectorRow}>
              {MESES.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.selectorBtn, mes === i && styles.selectorBtnActivo]}
                  onPress={() => setMes(i)}
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
                onPress={() => setAnio(a)}
              >
                <Text style={[styles.selectorBtnTxt, anio === a && styles.selectorBtnTxtActivo]}>
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        }
      >
        <Text style={styles.titulo}>📈 Reporte — {MESES[mes]} {anio}</Text>

        {datos && (
          <>
            {/* Resumen general */}
            <Text style={styles.seccion}>Resumen general</Text>
            <View style={styles.grid}>
              <View style={[styles.card, { borderColor: colors.green }]}>
                <Text style={styles.cardLabel}>Ingresos totales</Text>
                <Text style={[styles.cardValor, { color: colors.green }]}>{formatCOP(datos.ingresos)}</Text>
              </View>
              <View style={[styles.card, { borderColor: colors.red }]}>
                <Text style={styles.cardLabel}>Gastos totales</Text>
                <Text style={[styles.cardValor, { color: colors.red }]}>{formatCOP(datos.totalGastos)}</Text>
              </View>
              <View style={[styles.card, { borderColor: colors.blue }]}>
                <Text style={styles.cardLabel}>Ganancia bruta</Text>
                <Text style={[styles.cardValor, { color: colors.blue }]}>{formatCOP(datos.gananciaBruta)}</Text>
              </View>
              <View style={[styles.card, { borderColor: datos.gananciaNeta >= 0 ? colors.green : colors.red }]}>
                <Text style={styles.cardLabel}>Ganancia neta</Text>
                <Text style={[styles.cardValor, { color: datos.gananciaNeta >= 0 ? colors.green : colors.red }]}>
                  {formatCOP(datos.gananciaNeta)}
                </Text>
              </View>
            </View>

            {/* Desglose ingresos */}
            <Text style={styles.seccion}>Desglose de ingresos</Text>
            <View style={styles.desgloseCard}>
              <View style={styles.desgloseRow}>
                <Text style={styles.desgloseLabel}>🛍 Ventas ({datos.numVentas})</Text>
                <Text style={styles.desgloseValor}>{formatCOP(datos.totalVentas)}</Text>
              </View>
              <View style={styles.desgloseDivider} />
              <View style={styles.desgloseRow}>
                <Text style={styles.desgloseLabel}>🎱 Turnos ({datos.numTurnos})</Text>
                <Text style={styles.desgloseValor}>{formatCOP(datos.totalTurnos)}</Text>
              </View>
            </View>

            {/* Top productos */}
            {datos.topProductos.length > 0 && (
              <>
                <Text style={styles.seccion}>Productos más vendidos</Text>
                {datos.topProductos.map((p, i) => (
                  <View key={i} style={styles.rankItem}>
                    <View style={styles.rankNumero}>
                      <Text style={styles.rankNumeroTxt}>{i + 1}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankNombre}>{p.nombre}</Text>
                      <Text style={styles.rankSub}>{p.cantidad} unidades vendidas</Text>
                    </View>
                    <Text style={styles.rankTotal}>{formatCOP(p.total)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Gastos por categoría */}
            {Object.keys(datos.gastosCat).length > 0 && (
              <>
                <Text style={styles.seccion}>Gastos por categoría</Text>
                {Object.entries(datos.gastosCat)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => (
                    <View key={cat} style={styles.catItem}>
                      <Text style={styles.catNombre}>{cat}</Text>
                      <Text style={styles.catTotal}>{formatCOP(total)}</Text>
                    </View>
                  ))
                }
              </>
            )}
          </>
        )}
      </ScrollView>
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
  titulo: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 20 },
  seccion: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, width: '47%', borderWidth: 1 },
  cardLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  cardValor: { fontSize: 16, fontWeight: 'bold' },
  desgloseCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  desgloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  desgloseLabel: { color: colors.textPrimary, fontSize: 14 },
  desgloseValor: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  desgloseDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  rankItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  rankNumero: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankNumeroTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  rankInfo: { flex: 1 },
  rankNombre: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rankSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rankTotal: { color: colors.green, fontSize: 14, fontWeight: 'bold' },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  catNombre: { color: colors.textPrimary, fontSize: 14 },
  catTotal: { color: colors.red, fontSize: 14, fontWeight: 'bold' },
})