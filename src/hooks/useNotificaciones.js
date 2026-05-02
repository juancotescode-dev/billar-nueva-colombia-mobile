import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function solicitarPermisos() {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

async function enviarNotificacionLocal(mensaje) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Stock bajo',
        body: mensaje,
        sound: true,
      },
      trigger: null,
    })
  } catch (err) {
    console.log('Notificación local no disponible en Expo Go:', err.message)
  }
}

export function useNotificaciones() {
  useEffect(() => {
    let ultimoId = null
    let interval = null

    async function iniciar() {
      try {
        await solicitarPermisos()
      } catch {}

      try {
        const { data } = await supabase
          .from('notificaciones')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          ultimoId = data[0].id
        }
      } catch {}

      interval = setInterval(async () => {
        try {
          let query = supabase
            .from('notificaciones')
            .select('*')
            .eq('leida', false)
            .order('id', { ascending: true })

          if (ultimoId) {
            query = query.gt('id', ultimoId)
          }

          const { data: nuevas } = await query

          for (const notif of (nuevas || [])) {
            await enviarNotificacionLocal(notif.mensaje)
            ultimoId = notif.id
          }
        } catch (err) {
          console.error('Error verificando notificaciones:', err.message)
        }
      }, 15000)
    }

    iniciar()
    return () => { if (interval) clearInterval(interval) }
  }, [])
}