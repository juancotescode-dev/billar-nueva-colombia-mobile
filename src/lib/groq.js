import { supabase } from './supabase'
import Constants from 'expo-constants'; // 1. Importamos Constants

// 2. Extraemos la key desde el objeto 'extra' que definimos en app.config.js
const GROQ_API_KEY = Constants.expoConfig?.extra?.groqApiKey; 
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

// Un pequeño check de seguridad para que no te rompa la app si falta la key
if (!GROQ_API_KEY) {
  console.warn("CUIDADO: La API Key de GROQ no está definida en Constants.extra");
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getProductosMap(productoIds) {
  if (!productoIds || productoIds.length === 0) return {}
  const { data } = await supabase
    .from('productos')
    .select('id, nombre, categoria, costo_compra, stock, stock_minimo')
    .in('id', productoIds)
  const map = {}
  ;(data || []).forEach(p => { map[p.id] = p })
  return map
}

async function getMesasMap(mesaIds) {
  if (!mesaIds || mesaIds.length === 0) return {}
  const { data } = await supabase
    .from('mesas')
    .select('id, numero, tipo')
    .in('id', mesaIds)
  const map = {}
  ;(data || []).forEach(m => { map[m.id] = m })
  return map
}

// ─── FUNCIONES DE CONSULTA ───────────────────────────────────────────────────

async function consultarVentasPorPeriodo({ fechaInicio, fechaFin }) {
  const { data, error } = await supabase
    .from('ventas')
    .select('precio_venta, cantidad, registrado_en, producto_id')
    .gte('registrado_en', fechaInicio)
    .lte('registrado_en', fechaFin)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay ventas en este período' }

  const productoIds = [...new Set(data.map(v => v.producto_id))]
  const productosMap = await getProductosMap(productoIds)

  const porDia = data.reduce((acc, v) => {
    const fecha = v.registrado_en.split('T')[0]
    if (!acc[fecha]) acc[fecha] = { fecha, total_ventas: 0, num_transacciones: 0, ganancia_bruta: 0 }
    acc[fecha].total_ventas += v.precio_venta * v.cantidad
    acc[fecha].num_transacciones += 1
    const costo = productosMap[v.producto_id]?.costo_compra || 0
    acc[fecha].ganancia_bruta += (v.precio_venta - costo) * v.cantidad
    return acc
  }, {})

  return Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

async function consultarTurnosPorPeriodo({ fechaInicio, fechaFin }) {
  const { data, error } = await supabase
    .from('turnos_billar')
    .select('costo_turno, registrado_en')
    .gte('registrado_en', fechaInicio)
    .lte('registrado_en', fechaFin)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay turnos en este período' }

  const porDia = data.reduce((acc, t) => {
    const fecha = t.registrado_en.split('T')[0]
    if (!acc[fecha]) acc[fecha] = { fecha, total_turnos: 0, num_partidas: 0 }
    acc[fecha].total_turnos += Number(t.costo_turno)
    acc[fecha].num_partidas += 1
    return acc
  }, {})

  return Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

async function consultarProductosMasVendidos({ fechaInicio, fechaFin, limite = 10 }) {
  const { data, error } = await supabase
    .from('ventas')
    .select('precio_venta, cantidad, producto_id, registrado_en')
    .gte('registrado_en', fechaInicio)
    .lte('registrado_en', fechaFin)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay ventas en este período' }

  const productoIds = [...new Set(data.map(v => v.producto_id))]
  const productosMap = await getProductosMap(productoIds)

  const porProducto = data.reduce((acc, v) => {
    const id = v.producto_id
    if (!acc[id]) {
      const p = productosMap[id] || {}
      acc[id] = { nombre: p.nombre || 'Desconocido', categoria: p.categoria || 'Sin categoría', unidades: 0, ingresos: 0, ganancia: 0 }
    }
    acc[id].unidades += v.cantidad
    acc[id].ingresos += v.precio_venta * v.cantidad
    acc[id].ganancia += (v.precio_venta - (productosMap[id]?.costo_compra || 0)) * v.cantidad
    return acc
  }, {})

  return Object.values(porProducto)
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limite)
}

async function consultarGastosPorPeriodo({ fechaInicio, fechaFin }) {
  const { data, error } = await supabase
    .from('gastos')
    .select('monto, categoria, descripcion, fecha')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay gastos en este período', total_general: 0 }

  const porCategoria = data.reduce((acc, g) => {
    const cat = g.categoria || 'Sin categoría'
    if (!acc[cat]) acc[cat] = { categoria: cat, total: 0, num_gastos: 0 }
    acc[cat].total += Number(g.monto)
    acc[cat].num_gastos += 1
    return acc
  }, {})

  return {
    por_categoria: Object.values(porCategoria).sort((a, b) => b.total - a.total),
    total_general: data.reduce((s, g) => s + Number(g.monto), 0),
    detalle: data.map(g => ({ descripcion: g.descripcion, monto: Number(g.monto), categoria: g.categoria }))
  }
}

async function consultarMesasMasUsadas({ fechaInicio, fechaFin }) {
  const { data, error } = await supabase
    .from('sesiones')
    .select('mesa_id, total, abierta_en, cerrada_en')
    .eq('estado', 'cerrada')
    .gte('cerrada_en', fechaInicio)
    .lte('cerrada_en', fechaFin)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay sesiones cerradas en este período' }

  const mesaIds = [...new Set(data.map(s => s.mesa_id))]
  const mesasMap = await getMesasMap(mesaIds)

  const porMesa = data.reduce((acc, s) => {
    const id = s.mesa_id
    if (!acc[id]) {
      const m = mesasMap[id] || {}
      acc[id] = { mesa_numero: m.numero, mesa_tipo: m.tipo, num_sesiones: 0, total_ingresos: 0, duracion_total_min: 0 }
    }
    acc[id].num_sesiones += 1
    acc[id].total_ingresos += Number(s.total || 0)
    if (s.abierta_en && s.cerrada_en) {
      acc[id].duracion_total_min += (new Date(s.cerrada_en) - new Date(s.abierta_en)) / 60000
    }
    return acc
  }, {})

  return Object.values(porMesa)
    .map(m => ({ ...m, duracion_promedio_min: m.num_sesiones > 0 ? Math.round(m.duracion_total_min / m.num_sesiones) : 0 }))
    .sort((a, b) => b.num_sesiones - a.num_sesiones)
}

async function consultarResumenDia({ fecha }) {
  const dia = fecha.split('T')[0]
  const inicio = `${dia}T00:00:00`
  const fin = `${dia}T23:59:59`

  const [ventasRes, turnosRes, gastosRes] = await Promise.all([
    supabase.from('ventas').select('precio_venta, cantidad, producto_id').gte('registrado_en', inicio).lte('registrado_en', fin),
    supabase.from('turnos_billar').select('costo_turno').gte('registrado_en', inicio).lte('registrado_en', fin),
    supabase.from('gastos').select('monto').gte('fecha', inicio).lte('fecha', fin)
  ])

  const ventas = ventasRes.data || []
  const turnos = turnosRes.data || []
  const gastos = gastosRes.data || []

  const productoIds = [...new Set(ventas.map(v => v.producto_id))]
  const productosMap = await getProductosMap(productoIds)

  const totalVentas = ventas.reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
  const totalTurnos = turnos.reduce((s, t) => s + Number(t.costo_turno), 0)
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const costoVentas = ventas.reduce((s, v) => s + (productosMap[v.producto_id]?.costo_compra || 0) * v.cantidad, 0)
  const totalIngresos = totalVentas + totalTurnos
  // Al calcular ganancia bruta en móvil, verificar que costo_compra no sea null
  const gananciaBruta = ventasData.reduce((acc, v) => {
    const costoCompra = v.productos?.costo_compra || 0
    return acc + (v.precio_venta - costoCompra) * v.cantidad
  }, 0)

  return {
    fecha: dia,
    totalIngresos,
    totalVentas,
    totalTurnos,
    totalGastos,
    gananciaBruta: totalIngresos - costoVentas,
    gananciaNeta: totalIngresos - totalGastos,
    numTransacciones: ventas.length,
    numPartidas: turnos.length
  }
}

// ── FIX PRINCIPAL: sin filtro inventario_activo, solo activo=true ──
async function consultarStockProductos({ soloStockBajo = false }) {
  const { data, error } = await supabase
    .from('productos')
    .select('nombre, categoria, stock, stock_minimo, precio_sugerido, activo, inventario_activo')
    .eq('activo', true)
    .order('nombre')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay productos activos en el inventario' }

  const resultado = data.map(p => ({
    nombre: p.nombre,
    categoria: p.categoria,
    stock: p.stock,
    stock_minimo: p.stock_minimo,
    precio_sugerido: p.precio_sugerido,
    maneja_inventario: p.inventario_activo,
    stock_bajo: p.inventario_activo && p.stock <= p.stock_minimo
  }))

  if (soloStockBajo) {
    const bajos = resultado.filter(p => p.stock_bajo)
    if (bajos.length === 0) return { sin_datos: false, mensaje: 'Todos los productos tienen stock suficiente', productos: [] }
    return { productos: bajos, total_con_stock_bajo: bajos.length }
  }

  return {
    total_productos: resultado.length,
    con_stock_bajo: resultado.filter(p => p.stock_bajo).length,
    productos: resultado
  }
}

async function consultarCatalogoProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('nombre, categoria, precio_sugerido, costo_compra, stock, stock_minimo, inventario_activo, activo')
    .eq('activo', true)
    .order('categoria')
    .order('nombre')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return { sin_datos: true, mensaje: 'No hay productos registrados' }

  return {
    total_productos: data.length,
    productos: data.map(p => ({
      nombre: p.nombre,
      categoria: p.categoria,
      precio_sugerido: p.precio_sugerido,
      costo_compra: p.costo_compra,
      stock: p.stock,
      stock_minimo: p.stock_minimo,
      maneja_inventario: p.inventario_activo,
    }))
  }
}

async function consultarResumenMes({ anio, mes }) {
  const inicio = new Date(anio, mes - 1, 1, 0, 0, 0).toISOString()
  const fin = new Date(anio, mes, 0, 23, 59, 59, 999).toISOString()

  const [ventasRes, turnosRes, gastosRes] = await Promise.all([
    supabase.from('ventas').select('precio_venta, cantidad, producto_id').gte('registrado_en', inicio).lte('registrado_en', fin),
    supabase.from('turnos_billar').select('costo_turno').gte('registrado_en', inicio).lte('registrado_en', fin),
    supabase.from('gastos').select('monto').gte('fecha', inicio).lte('fecha', fin)
  ])

  const ventas = ventasRes.data || []
  const turnos = turnosRes.data || []
  const gastos = gastosRes.data || []

  const productoIds = [...new Set(ventas.map(v => v.producto_id))]
  const productosMap = await getProductosMap(productoIds)

  const totalVentas = ventas.reduce((s, v) => s + v.precio_venta * v.cantidad, 0)
  const totalTurnos = turnos.reduce((s, t) => s + Number(t.costo_turno), 0)
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const costoVentas = ventas.reduce((s, v) => s + (productosMap[v.producto_id]?.costo_compra || 0) * v.cantidad, 0)
  const totalIngresos = totalVentas + totalTurnos

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return {
    periodo: `${MESES[mes - 1]} ${anio}`,
    totalIngresos,
    totalVentas,
    totalTurnos,
    totalGastos,
    gananciaBruta: totalIngresos - costoVentas,
    gananciaNeta: totalIngresos - totalGastos,
    numTransacciones: ventas.length,
    numPartidas: turnos.length
  }
}

// ─── MAPA DE FUNCIONES ───────────────────────────────────────────────────────

const funcionesDisponibles = {
  consultarVentasPorPeriodo,
  consultarTurnosPorPeriodo,
  consultarProductosMasVendidos,
  consultarGastosPorPeriodo,
  consultarMesasMasUsadas,
  consultarResumenDia,
  consultarStockProductos,
  consultarCatalogoProductos, // ← nueva
  consultarResumenMes,
}

// ─── HERRAMIENTAS GROQ ───────────────────────────────────────────────────────

const herramientas = [
  {
    type: 'function',
    function: {
      name: 'consultarVentasPorPeriodo',
      description: 'Ventas agrupadas por día en un rango. Úsalo para tendencias, mejor día, comparar períodos.',
      parameters: {
        type: 'object',
        properties: {
          fechaInicio: { type: 'string', description: 'ISO 8601 ej: 2026-05-01T00:00:00' },
          fechaFin: { type: 'string', description: 'ISO 8601 ej: 2026-05-31T23:59:59' }
        },
        required: ['fechaInicio', 'fechaFin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarTurnosPorPeriodo',
      description: 'Ingresos de partidas de billar agrupados por día en un rango.',
      parameters: {
        type: 'object',
        properties: {
          fechaInicio: { type: 'string', description: 'ISO 8601' },
          fechaFin: { type: 'string', description: 'ISO 8601' }
        },
        required: ['fechaInicio', 'fechaFin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarProductosMasVendidos',
      description: 'Top productos por unidades vendidas en un período.',
      parameters: {
        type: 'object',
        properties: {
          fechaInicio: { type: 'string', description: 'ISO 8601' },
          fechaFin: { type: 'string', description: 'ISO 8601' },
          limite: { type: 'number', description: 'Máximo a retornar, default 10' }
        },
        required: ['fechaInicio', 'fechaFin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarGastosPorPeriodo',
      description: 'Gastos agrupados por categoría en un rango de fechas.',
      parameters: {
        type: 'object',
        properties: {
          fechaInicio: { type: 'string', description: 'ISO 8601' },
          fechaFin: { type: 'string', description: 'ISO 8601' }
        },
        required: ['fechaInicio', 'fechaFin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarMesasMasUsadas',
      description: 'Mesas ordenadas por número de sesiones en un período.',
      parameters: {
        type: 'object',
        properties: {
          fechaInicio: { type: 'string', description: 'ISO 8601' },
          fechaFin: { type: 'string', description: 'ISO 8601' }
        },
        required: ['fechaInicio', 'fechaFin']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarResumenDia',
      description: 'Resumen de un día: ingresos, ventas, turnos, gastos, ganancias.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha ISO 8601 ej: 2026-05-07' }
        },
        required: ['fecha']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarStockProductos',
      description: 'Stock actual de productos. Con soloStockBajo=true retorna solo los que tienen stock igual o menor al mínimo configurado.',
      parameters: {
        type: 'object',
        properties: {
          soloStockBajo: { type: 'boolean', description: 'true = solo productos con stock bajo' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarResumenMes',
      description: 'Resumen mensual: ingresos, ventas, turnos, gastos, ganancias.',
      parameters: {
        type: 'object',
        properties: {
          anio: { type: 'number', description: 'Año ej: 2026' },
          mes: { type: 'number', description: 'Mes 1-12' }
        },
        required: ['anio', 'mes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultarCatalogoProductos',
      description: 'Lista todos los productos registrados en el negocio con nombre, categoría, precio, costo y stock. Úsala cuando pregunten qué productos hay, cuántos productos existen, el catálogo completo, o información general de productos.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
]

// ─── SISTEMA PROMPT COMPACTO ─────────────────────────────────────────────────

function obtenerSistemaPrompt() {
  const hoy = new Date()
  const fechaStr = hoy.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota'
  })
  const diaISO = hoy.toISOString().split('T')[0]
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  // Calcular inicio de semana (lunes)
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  const lunesISO = lunes.toISOString().split('T')[0]

  return `Eres el asistente de Billares Nueva Colombia. Hoy es ${fechaStr} (${diaISO}). Mes actual: ${mesActual}, año: ${anioActual}. Inicio de semana: ${lunesISO}.

Reglas:
- Responde en español, conciso, usando $X.XXX para COP.
- SIEMPRE usa herramientas para obtener datos reales. Nunca inventes.
- "hoy" = ${diaISO}, "esta semana" = ${lunesISO} a ${diaISO}, "este mes" = mes ${mesActual} año ${anioActual}.
- Si no hay datos, dilo claro: "No hay registros para este período."
- Solo responde sobre el negocio.`
}

// ─── MOTOR DE IA ─────────────────────────────────────────────────────────────

async function llamarGroq(body) {
  for (let intento = 0; intento < 3; intento++) {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const msg = errorData.error?.message || ''
      const match = msg.match(/try again in ([\d.]+)s/)
      const espera = match ? Math.ceil(parseFloat(match[1])) * 1000 + 300 : 5000
      await new Promise(res => setTimeout(res, espera))
      continue
    }

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Error Groq ${response.status}: ${err}`)
    }

    return await response.json()
  }
  throw new Error('Rate limit de Groq superado. Espera unos segundos e intenta de nuevo.')
}

export async function preguntarAGroq(historialChat, preguntaUsuario) {
  const mensajes = [
    { role: 'system', content: obtenerSistemaPrompt() },
    ...historialChat.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: preguntaUsuario }
  ]

  for (let i = 0; i < 5; i++) {
    const data = await llamarGroq({
      model: MODEL,
      messages: mensajes,
      tools: herramientas,
      tool_choice: 'auto',
      max_tokens: 600,
      temperature: 0.2
    })

    const mensaje = data.choices?.[0]?.message
    if (!mensaje) throw new Error('Respuesta inválida de Groq')

    mensajes.push(mensaje)

    if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
      return mensaje.content
    }

    // ── FIX: tool calls en paralelo con Promise.all ──
    await Promise.all(
      mensaje.tool_calls.map(async (toolCall) => {
        const nombreFuncion = toolCall.function.name
        let args
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        let resultado
        try {
          const funcion = funcionesDisponibles[nombreFuncion]
          if (!funcion) throw new Error(`Función ${nombreFuncion} no existe`)
          resultado = await funcion(args)
        } catch (err) {
          resultado = { error: err.message }
        }

        mensajes.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultado)
        })
      })
    )
  }

  return 'No pude completar la consulta. Intenta reformular la pregunta.'
}