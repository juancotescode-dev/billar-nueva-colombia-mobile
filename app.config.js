import 'dotenv/config';

export default {
  "expo": {
    "name": "Billares Nueva Colombia",
    "slug": "billares-nueva-colombia-mobile",
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "orientation": "portrait",
    "scheme": "billares",
    "userInterfaceStyle": "dark",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#111827"
      },
      "package": "com.judacoma.billaresnuevacolombiamobile"
    },
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#111827"
    },
    "ios": {
      "supportsTablet": false
    },
    "plugins": [
      "expo-router",
      "@react-native-community/datetimepicker"
    ],
    "extra": {
      "supabaseUrl": process.env.SUPABASE_URL,
      "supabaseAnonKey": process.env.SUPABASE_ANON_KEY,
      "groqApiKey": process.env.GROQ_API_KEY,
      "router": {},
      "eas": {
        "projectId": "38a26c1c-8f5d-46b6-ad55-e17b22164c41"
      }
    }
  }
};