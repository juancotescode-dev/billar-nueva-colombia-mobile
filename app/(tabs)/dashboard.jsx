import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

function Card({ titulo, valor, color, subtitulo }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>{titulo}</Text>
      <Text style={[styles.cardValor, { color: color || colors.textPrimary }]}>{valor}</Text>
      {subtitulo ? <Text style={styles.cardSub}>{subtitulo}</Text> : null}
    </View>
  )
}

export default function Dashboard() {
  const insets = useSafeAreaInsets()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function cargarDatos() {
    try {
      const hoy = new Date()
      const inicio = new Date(hoy)
      inicio.setHours(0, 0, 0, 0)
      const fin = new Date(hoy)
      fin.setHours(23, 59, 59, 999)

      const inicioISO = inicio.toISOString()
      const finISO = fin.toISOString()

      const { data: ventas } = await supabase
        .from('ventas')
        .select('precio_venta, cantidad')
        .gte('registrado_en', inicioISO)
        .lte('registrado_en', finISO)

      const { data: turnos } = await supabase
        .from('turnos_billar')
        .select('costo_turno')
        .gte('registrado_en', inicioISO)
        .lte('registrado_en', finISO)

      const { data: gastos } = await supabase
        .from('gastos')
        .select('monto')
        .gte('fecha', inicioISO)
        .lte('fecha', finISO)

      const { data: mesas } = await supabase
        .from('mesas')
        .select('estado')
        .eq('activo', true)

      const { data: alertas } = await supabase
        .from('notificaciones')
        .select('id')
        .eq('leida', false)

      const totalVentas = (ventas || []).reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
      const totalTurnos = (turnos || []).reduce((s, t) => s + Number(t.costo_turno), 0)
      const totalGastos = (gastos || []).reduce((s, g) => s + Number(g.monto), 0)
      const totalIngresos = totalVentas + totalTurnos
      const gananciaNeta = totalIngresos - totalGastos

      const mesasOcupadas = (mesas || []).filter(m => m.estado === 'ocupada').length
      const totalMesas = (mesas || []).length

      setDatos({
        totalIngresos,
        totalGastos,
        gananciaNeta,
        mesasOcupadas,
        totalMesas,
        alertas: (alertas || []).length,
      })
    } catch (err) {
      console.error('Error cargando dashboard:', err.message)
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  usePolling(cargarDatos, 10000)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarDatos()
  }, [])

  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

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
        <Text style={styles.titulo}>📊 Dashboard</Text>
        <Text style={styles.fecha}>{fechaHoy}</Text>

        <Text style={styles.seccion}>Resumen del día</Text>

        <View style={styles.grid}>
          <Card
            titulo="Ingresos totales"
            valor={formatCOP(datos.totalIngresos)}
            color={colors.green}
          />
          <Card
            titulo="Gastos"
            valor={formatCOP(datos.totalGastos)}
            color={colors.red}
          />
          <Card
            titulo="Ganancia neta"
            valor={formatCOP(datos.gananciaNeta)}
            color={datos.gananciaNeta >= 0 ? colors.green : colors.red}
          />
          <Card
            titulo="Mesas ocupadas"
            valor={`${datos.mesasOcupadas} / ${datos.totalMesas}`}
            color={colors.blue}
            subtitulo={datos.mesasOcupadas > 0 ? 'En uso ahora' : 'Todas libres'}
          />
        </View>

        {datos.alertas > 0 && (
          <View style={styles.alerta}>
            <Text style={styles.alertaTxt}>
              ⚠️ {datos.alertas} alerta{datos.alertas > 1 ? 's' : ''} de stock bajo sin leer
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centrado: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fecha: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    textTransform: 'capitalize',
  },
  seccion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    width: '47%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitulo: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  cardValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  alerta: {
    marginTop: 16,
    backgroundColor: '#451a03',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  alertaTxt: {
    color: colors.yellow,
    fontSize: 14,
    fontWeight: '600',
  },
})