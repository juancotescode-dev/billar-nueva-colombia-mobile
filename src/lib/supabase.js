import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'; // 1. Importamos Constants

// 2. Extraemos las variables desde el objeto extra de app.config.js
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

// 3. Inicializamos el cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})