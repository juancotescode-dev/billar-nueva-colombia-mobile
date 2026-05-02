import AsyncStorage from '@react-native-async-storage/async-storage'

export async function guardarCache(clave, datos) {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify({
      datos,
      timestamp: Date.now()
    }))
  } catch (err) {
    console.error('Error guardando cache:', err.message)
  }
}

export async function leerCache(clave, maxEdadMs = 5 * 60 * 1000) {
  try {
    const raw = await AsyncStorage.getItem(clave)
    if (!raw) return null
    const { datos, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > maxEdadMs) return null
    return datos
  } catch {
    return null
  }
}

export async function leerCacheSinExpiry(clave) {
  try {
    const raw = await AsyncStorage.getItem(clave)
    if (!raw) return null
    const { datos } = JSON.parse(raw)
    return datos
  } catch {
    return null
  }
}