import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { usePolling } from '../../src/hooks/usePolling'
import { guardarCache, leerCacheSinExpiry } from '../../src/hooks/useCache'
import { Modal, TextInput, Alert, TouchableOpacity } from 'react-native'
import * as bcrypt from 'bcryptjs'
import { getRandomBytes } from 'expo-crypto'

// Fallback for crypto in React Native
bcrypt.setRandomFallback((len) => {
  return getRandomBytes(len)
})

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

function ModalCambiarPin({ visible, onCerrar }) {
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [paso, setPaso] = useState(1) // 1=verificar actual, 2=nuevo pin

  function limpiar() {
    setPinActual('')
    setPinNuevo('')
    setPinConfirmar('')
    setPaso(1)
  }

  async function verificarActual() {
    if (pinActual.length < 1) {
    Alert.alert('Error', 'Ingresa tu PIN actual')
    return
    }
    setGuardando(true)
    try {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'admin_pin_hash')
        .single()
  
      const valido = bcrypt.compareSync(String(pinActual), data.valor)
      if (!valido) {
        Alert.alert('Error', 'PIN actual incorrecto')
        setPinActual('')
        return
      }
      setPaso(2)
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setGuardando(false)
    }
  }
  
  async function guardarNuevoPin() {
    if (pinNuevo.length !== 4) {
      Alert.alert('Error', 'El PIN debe ser exactamente 4 dígitos')
      return
    }
    if (!/^\d{4}$/.test(pinNuevo)) {
      Alert.alert('Error', 'El PIN solo puede contener números')
      return
    }
    if (pinNuevo !== pinConfirmar) {
      Alert.alert('Error', 'Los PINs no coinciden')
      return
    }
    setGuardando(true)
    try {
      const hash = bcrypt.hashSync(String(pinNuevo), 10)
      const { error } = await supabase
        .from('configuracion')
        .upsert({ clave: 'admin_pin_hash', valor: hash, actualizado_en: new Date().toISOString() })
      if (error) throw new Error(error.message)
      Alert.alert('Éxito', 'PIN cambiado correctamente')
      limpiar()
      onCerrar()
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { limpiar(); onCerrar() }}>
      <View style={pinStyles.overlay}>
        <View style={pinStyles.container}>
          <View style={pinStyles.header}>
            <Text style={pinStyles.titulo}>🔐 Cambiar PIN</Text>
            <TouchableOpacity onPress={() => { limpiar(); onCerrar() }}>
              <Text style={pinStyles.cerrarTxt}>✕</Text>
            </TouchableOpacity>
          </View>

        {paso === 1 ? (
          <>
            <Text style={pinStyles.label}>PIN actual</Text>
            <TextInput
              style={pinStyles.input}
              placeholder="Ingresa tu PIN actual"
              placeholderTextColor={colors.textSecondary}
              value={pinActual}
              onChangeText={t => setPinActual(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <TouchableOpacity
              style={[pinStyles.btn, guardando && { opacity: 0.6 }]}
              onPress={verificarActual}
              disabled={guardando}
            >
              <Text style={pinStyles.btnTxt}>{guardando ? 'Verificando...' : 'Continuar'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={pinStyles.label}>Nuevo PIN (4 dígitos)</Text>
            <TextInput
              style={pinStyles.input}
              placeholder="Ingresa el nuevo PIN"
              placeholderTextColor={colors.textSecondary}
              value={pinNuevo}
              onChangeText={t => setPinNuevo(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Text style={pinStyles.label}>Confirmar PIN</Text>
            <TextInput
              style={pinStyles.input}
              placeholder="Repite el nuevo PIN"
              placeholderTextColor={colors.textSecondary}
              value={pinConfirmar}
              onChangeText={t => setPinConfirmar(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <TouchableOpacity
              style={[pinStyles.btn, guardando && { opacity: 0.6 }]}
              onPress={guardarNuevoPin}
              disabled={guardando}
            >
              <Text style={pinStyles.btnTxt}>{guardando ? 'Guardando...' : 'Cambiar PIN'}</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </View>
    </Modal>
  )
}

const pinStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  cerrarTxt: { fontSize: 18, color: colors.textSecondary },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 16 },
  btn: { backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

export default function Dashboard() {
  const insets = useSafeAreaInsets()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalPinVisible, setModalPinVisible] = useState(false)

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
  
      const nuevoDatos = {
        totalIngresos,
        totalGastos,
        gananciaNeta,
        mesasOcupadas,
        totalMesas,
        alertas: (alertas || []).length,
      }
  
      await guardarCache('dashboard', nuevoDatos)
      setDatos(nuevoDatos)
    } catch (err) {
      console.error('Error cargando dashboard:', err.message)
      const cache = await leerCacheSinExpiry('dashboard')
      if (cache) setDatos(cache)
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

        <TouchableOpacity
          style={styles.btnCambiarPin}
          onPress={() => setModalPinVisible(true)}
        >
          <Text style={styles.btnCambiarPinTxt}>🔐 Cambiar PIN de administrador</Text>
        </TouchableOpacity>
      </ScrollView>
      <ModalCambiarPin
        visible={modalPinVisible}
        onCerrar={() => setModalPinVisible(false)}
      />
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
  btnCambiarPin: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnCambiarPinTxt: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
})