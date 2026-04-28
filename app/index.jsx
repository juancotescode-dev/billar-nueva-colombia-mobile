import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import * as bcrypt from 'bcryptjs'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/constants/colors'

const MAX_INTENTOS = 3

export default function Login() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [cargando, setCargando] = useState(false)
  const [intentos, setIntentos] = useState(0)

  async function verificarPin(pinIngresado) {
    if (intentos >= MAX_INTENTOS) return
    try {
      setCargando(true)

      const { data, error } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'admin_pin_hash')
        .single()

      if (error || !data) throw new Error('No se pudo obtener la configuración')

      const valido = await bcrypt.compare(String(pinIngresado), data.valor)

        if (valido) {
          router.replace('/(tabs)/dashboard')
        } else {
        const nuevosIntentos = intentos + 1
        setIntentos(nuevosIntentos)
        setPin('')
        if (nuevosIntentos >= MAX_INTENTOS) {
          Alert.alert('Bloqueado', 'Demasiados intentos fallidos. Reinicia la aplicación.')
        } else {
          Alert.alert('PIN incorrecto', `Intentos fallidos: ${nuevosIntentos}/${MAX_INTENTOS}`)
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message)
      setPin('')
    } finally {
      setCargando(false)
    }
  }

  function presionarTecla(tecla) {
    if (intentos >= MAX_INTENTOS) return
    if (tecla === 'DEL') {
      setPin(p => p.slice(0, -1))
      return
    }
    const nuevo = pin + tecla
    setPin(nuevo)
    if (nuevo.length === 4) {
      verificarPin(nuevo)
    }
  }

  const teclas = ['1','2','3','4','5','6','7','8','9','','0','DEL']

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.titulo}>🎱 Billares</Text>
        <Text style={styles.subtitulo}>Nueva Colombia</Text>
        <Text style={styles.instruccion}>Ingresa tu PIN de administrador</Text>

        <View style={styles.puntosContainer}>
          {[0,1,2,3].map(i => (
            <View
              key={i}
              style={[styles.punto, pin.length > i && styles.puntoActivo]}
            />
          ))}
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.teclado}>
            {teclas.map((tecla, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.tecla, tecla === '' && styles.teclaVacia]}
                onPress={() => tecla !== '' && presionarTecla(tecla)}
                disabled={tecla === ''}
              >
                <Text style={styles.teclaTxt}>{tecla}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  titulo: {
    fontSize: 40,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  subtitulo: {
    fontSize: 18,
    color: colors.blue,
    marginBottom: 48,
    fontWeight: '600',
  },
  instruccion: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  puntosContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 48,
  },
  punto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    backgroundColor: 'transparent',
  },
  puntoActivo: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  teclado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: 16,
  },
  tecla: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  teclaVacia: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  teclaTxt: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
})