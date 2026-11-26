'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

// Cliente que el admin está editando en ESTA pestaña. Es solo comodidad de interfaz:
// el acceso real lo da la base (reglas por rol), así que cambiarlo a mano no abre nada.
const KEY = 'pylar.activeSite'
const EVENT = 'pylar:activeSite'

export type ActiveSite = { siteId: string; businessName: string }

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// El snapshot es el texto guardado (estable entre lecturas); se interpreta aparte.
function getSnapshot(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

function parse(raw: string | null): ActiveSite | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return typeof v?.siteId === 'string' && v.siteId && typeof v?.businessName === 'string' ? { siteId: v.siteId, businessName: v.businessName } : null
  } catch {
    return null
  }
}

function write(value: ActiveSite | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Sin almacenamiento de sesión: el admin tendrá que elegir cliente cada vez.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useActiveSite() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const active = useMemo(() => parse(raw), [raw])
  const setActive = useCallback((site: ActiveSite) => write(site), [])
  const clear = useCallback(() => write(null), [])
  return { active, setActive, clear }
}
