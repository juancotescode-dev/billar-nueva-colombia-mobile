import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Keyboard
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/constants/colors'
import { preguntarAGroq } from '../../src/lib/groq'

const SUGERENCIAS = [
  '¿Cuánto gané neto hoy?',
  '¿Cuál fue mi mejor día de ventas esta semana?',
  '¿Qué producto me genera más ganancia?',
  '¿Qué mesas se usan más?',
  '¿Cuáles productos tienen stock bajo?',
  '¿Cómo van las ventas este mes?',
]

function BurbujaCargando() {
  const [dots, setDots] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setDots(d => (d + 1) % 4), 400)
    return () => clearInterval(i)
  }, [])
  return (
    <View style={styles.burbujaAsistente}>
      <View style={styles.dotsContainer}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, dots === i && styles.dotActivo]} />
        ))}
      </View>
    </View>
  )
}

export default function Asistente() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [mensajes, cargando])

  async function enviar(texto) {
    const pregunta = texto || input.trim()
    if (!pregunta || cargando) return

    setInput('')
    Keyboard.dismiss()

    const nuevosMensajes = [...mensajes, { role: 'user', content: pregunta }]
    setMensajes(nuevosMensajes)
    setCargando(true)

    try {
      const historial = mensajes.map(m => ({ role: m.role, content: m.content }))
      const respuesta = await preguntarAGroq(historial, pregunta)
      setMensajes(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (err) {
      const esRateLimit = err.message?.includes('Rate limit')
      setMensajes(prev => [...prev, {
        role: 'assistant',
        content: esRateLimit
          ? '⏳ Muchas consultas seguidas. Espera unos segundos e intenta de nuevo.'
          : '❌ Error al consultar el asistente. Verifica tu conexión.'
      }])
    } finally {
      setCargando(false)
    }
  }

  function limpiarChat() {
    setMensajes([])
    setInput('')
  }

  const sinMensajes = mensajes.length === 0

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.btnVolver} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCentro}>
            <Text style={styles.headerTitulo}>🤖 Asistente IA</Text>
          </View>
          {mensajes.length > 0 ? (
            <TouchableOpacity style={styles.btnLimpiar} onPress={limpiarChat}>
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={[
            styles.chatContent,
            sinMensajes && styles.chatCentrado
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {sinMensajes ? (
            <View style={styles.bienvenida}>
              <View style={styles.bienvenidaIcono}>
                <Text style={styles.bienvenidaEmoji}>🤖</Text>
              </View>
              <Text style={styles.bienvenidaTitulo}>Asistente de análisis</Text>
              <Text style={styles.bienvenidaSub}>
                Pregúntame sobre ventas, gastos, mesas o inventario del negocio.
              </Text>

              <View style={styles.sugerenciasWrap}>
                {SUGERENCIAS.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.chip}
                    onPress={() => enviar(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipTxt}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              {mensajes.map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.fila,
                    m.role === 'user' ? styles.filaUser : styles.filaAsistente
                  ]}
                >
                  {m.role === 'assistant' && (
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarTxt}>🤖</Text>
                    </View>
                  )}
                  <View style={[
                    styles.burbuja,
                    m.role === 'user' ? styles.burbujaUser : styles.burbujaAsistente
                  ]}>
                    <Text style={[
                      styles.burbujaTexto,
                      m.role === 'user' ? styles.textoUser : styles.textoAsistente
                    ]}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              ))}
              {cargando && (
                <View style={[styles.fila, styles.filaAsistente]}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarTxt}>🤖</Text>
                  </View>
                  <BurbujaCargando />
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe tu pregunta..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.btnEnviar, (!input.trim() || cargando) && styles.btnEnviarOff]}
            onPress={() => enviar()}
            disabled={!input.trim() || cargando}
            activeOpacity={0.8}
          >
            {cargando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  btnVolver: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCentro: { flex: 1, alignItems: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  btnLimpiar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Chat
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 12, gap: 4 },
  chatCentrado: { flex: 1, justifyContent: 'center' },

  // Bienvenida
  bienvenida: { alignItems: 'center', paddingHorizontal: 12 },
  bienvenidaIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e1b4b',
    borderWidth: 2,
    borderColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bienvenidaEmoji: { fontSize: 32 },
  bienvenidaTitulo: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  bienvenidaSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  sugerenciasWrap: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTxt: { color: colors.textSecondary, fontSize: 12 },

  // Mensajes
  fila: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 6 },
  filaUser: { justifyContent: 'flex-end' },
  filaAsistente: { justifyContent: 'flex-start' },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarTxt: { fontSize: 14 },
  burbuja: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  burbujaUser: { backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  burbujaAsistente: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  burbujaTexto: { fontSize: 14, lineHeight: 20 },
  textoUser: { color: '#fff' },
  textoAsistente: { color: colors.textPrimary },

  // Dots loading
  dotsContainer: { flexDirection: 'row', gap: 5, padding: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActivo: { backgroundColor: colors.blue },

  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
  },
  btnEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEnviarOff: { backgroundColor: colors.border },
})