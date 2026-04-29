import { useEffect, useRef } from 'react'

export function usePolling(fn, intervalo = 10000) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const interval = setInterval(() => fnRef.current(), intervalo)
    return () => clearInterval(interval)
  }, [intervalo])
}