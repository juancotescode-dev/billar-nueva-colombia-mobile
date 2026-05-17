import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, TouchableOpacity, TextInput
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/constants/colors'
import { guardarCache, leerCacheSinExpiry } from '../../src/hooks/useCache'
import { usePolling } from '../../src/hooks/usePolling'

function formatCOP(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO')
}

const CATEGORIAS_FILTRO = ['Todas']

export default function Inventario() {
  const insets = useSafeAreaInsets()
  const [productos, setProductos] = useState([])
  const [filtrados, setFiltrados] = useState([])
  const [categorias, setCategorias] = useState(['Todas'])
  const [categoriaActiva, setCategoriaActiva] = useState('Todas')
  const [busqueda, setBusqueda] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function cargarProductos() {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('categoria')
        .order('nombre')

      if (error) throw error

      const prods = data || []
      const cats = ['Todas', ...new Set(prods.map(p => p.categoria).filter(Boolean))]

      await guardarCache('inventario', { productos: prods, categorias: cats })
      setProductos(prods)
      setCategorias(cats)
    } catch (err) {
      console.error('Error cargando inventario:', err.message)
      const cache = await leerCacheSinExpiry('inventario')
      if (cache) {
        setProductos(cache.productos || [])
        setCategorias(cache.categorias || ['Todas'])
      }
    } finally {
      setCargando(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setCargando(true)
    cargarProductos()
  }, [])

  usePolling(cargarProductos, 30000)

  // Aplicar filtros
  useEffect(() => {
    let resultado = [...productos]

    if (categoriaActiva !== 'Todas') {
      resultado = resultado.filter(p => p.categoria === categoriaActiva)
    }

    if (busqueda.trim()) {
      const b = busqueda.toLowerCase()
      resultado = resultado.filter(p => p.nombre.toLowerCase().includes(b))
    }

    if (soloStockBajo) {
      resultado = resultado.filter(p => p.inventario_activo && p.stock <= p.stock_minimo)
    }

    setFiltrados(resultado)
  }, [productos, categoriaActiva, busqueda, soloStockBajo])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    cargarProductos()
  }, [])

  const totalProductos = filtrados.length
  const conStockBajo = filtrados.filter(p => p.inventario_activo && p.stock <= p.stock_minimo).length
  const valorInventario = productos
    .filter(p => p.inventario_activo)
    .reduce((s, p) => s + (p.costo_compra || 0) * (p.stock || 0), 0)

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Buscador */}
      <View style={styles.buscadorWrap}>
        <TextInput
          style={styles.buscador}
          placeholder="🔍 Buscar producto..."
          placeholderTextColor={colors.textSecondary}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Filtro categorías */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriasScroll}
        contentContainerStyle={styles.categoriasContent}
      >
        {categorias.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, categoriaActiva === cat && styles.catBtnActivo]}
            onPress={() => setCategoriaActiva(cat)}
          >
            <Text style={[styles.catBtnTxt, categoriaActiva === cat && styles.catBtnTxtActivo]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.catBtn, soloStockBajo && { backgroundColor: colors.red, borderColor: colors.red }]}
          onPress={() => setSoloStockBajo(v => !v)}
        >
          <Text style={[styles.catBtnTxt, soloStockBajo && { color: '#fff' }]}>
            ⚠️ Stock bajo
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        <Text style={styles.titulo}>📦 Inventario</Text>

        {/* Resumen */}
        <View style={styles.resumenRow}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValor}>{totalProductos}</Text>
            <Text style={styles.resumenLabel}>Productos</Text>
          </View>
          <View style={styles.resumenDivider} />
          <View style={styles.resumenItem}>
            <Text style={[styles.resumenValor, conStockBajo > 0 && { color: colors.red }]}>
              {conStockBajo}
            </Text>
            <Text style={styles.resumenLabel}>Stock bajo</Text>
          </View>
          <View style={styles.resumenDivider} />
          <View style={styles.resumenItem}>
            <Text style={[styles.resumenValor, { fontSize: 14 }]}>{formatCOP(valorInventario)}</Text>
            <Text style={styles.resumenLabel}>Valor inventario</Text>
          </View>
        </View>

        {/* Lista productos */}
        {filtrados.length === 0 ? (
          <View style={styles.vacioCont}>
            <Text style={styles.vacioEmoji}>📭</Text>
            <Text style={styles.vacioTxt}>No hay productos que coincidan</Text>
          </View>
        ) : (
          filtrados.map(p => {
            const stockBajo = p.inventario_activo && p.stock <= p.stock_minimo
            const stockCero = p.inventario_activo && p.stock === 0
            return (
              <View key={p.id} style={[styles.item, stockBajo && styles.itemStockBajo]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNombre} numberOfLines={1}>{p.nombre}</Text>
                  {stockCero && (
                    <View style={[styles.badge, { backgroundColor: colors.red }]}>
                      <Text style={styles.badgeTxt}>Sin stock</Text>
                    </View>
                  )}
                  {stockBajo && !stockCero && (
                    <View style={[styles.badge, { backgroundColor: colors.yellow }]}>
                      <Text style={[styles.badgeTxt, { color: '#000' }]}>Stock bajo</Text>
                    </View>
                  )}
                  {!stockBajo && p.inventario_activo && (
                    <View style={[styles.badge, { backgroundColor: colors.green }]}>
                      <Text style={styles.badgeTxt}>OK</Text>
                    </View>
                  )}
                  {!p.inventario_activo && (
                    <View style={[styles.badge, { backgroundColor: colors.border }]}>
                      <Text style={styles.badgeTxt}>Sin control</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.itemCategoria}>{p.categoria || 'Sin categoría'}</Text>

                <View style={styles.itemDatos}>
                  <View style={styles.itemDato}>
                    <Text style={styles.itemDatoLabel}>Precio venta</Text>
                    <Text style={styles.itemDatoValor}>{formatCOP(p.precio_sugerido)}</Text>
                  </View>
                  <View style={styles.itemDato}>
                    <Text style={styles.itemDatoLabel}>Costo</Text>
                    <Text style={styles.itemDatoValor}>{formatCOP(p.costo_compra)}</Text>
                  </View>
                  {p.inventario_activo && (
                    <>
                      <View style={styles.itemDato}>
                        <Text style={styles.itemDatoLabel}>Stock</Text>
                        <Text style={[
                          styles.itemDatoValor,
                          stockCero ? { color: colors.red } :
                          stockBajo ? { color: colors.yellow } :
                          { color: colors.green }
                        ]}>
                          {p.stock}
                        </Text>
                      </View>
                      <View style={styles.itemDato}>
                        <Text style={styles.itemDatoLabel}>Mínimo</Text>
                        <Text style={styles.itemDatoValor}>{p.stock_minimo}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  buscadorWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  buscador: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 14,
  },
categoriasScroll: {
  backgroundColor: colors.card,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  maxHeight: 56,
},
categoriasContent: {
  paddingHorizontal: 12,
  paddingVertical: 10,
  gap: 8,
  flexDirection: 'row',
  alignItems: 'center',
},
catBtn: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: 'transparent',
  minHeight: 40,
  justifyContent: 'center',
  alignItems: 'center',
},
  catBtnActivo: { backgroundColor: colors.blue, borderColor: colors.blue },
  catBtnTxt: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  catBtnTxtActivo: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 32 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 },
  resumenRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resumenItem: { flex: 1, alignItems: 'center' },
  resumenValor: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  resumenLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  resumenDivider: { width: 1, height: 36, backgroundColor: colors.border },
  vacioCont: { alignItems: 'center', marginTop: 60 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioTxt: { color: colors.textSecondary, fontSize: 16 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemStockBajo: { borderColor: colors.yellow },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemNombre: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },
  itemCategoria: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  itemDatos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemDato: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 8,
    minWidth: '22%',
    flex: 1,
  },
  itemDatoLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
  itemDatoValor: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
})