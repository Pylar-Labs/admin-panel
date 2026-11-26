import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Traduce el error de un guardado (texto de la base o de queries.ts) a una frase que el cliente entienda.
// Sin configuración del sitio, la base rechaza el alta con una regla de acceso o una clave foránea.
export function saveErrorMessage(error: string | null | undefined): string {
  if (error?.includes('todavía no tiene configuración')) return error
  if (error?.includes('row-level security') || error?.includes('foreign key')) {
    return 'Tu sitio todavía no está preparado para guardar. Pedile a la agencia que cree tu configuración.'
  }
  return 'No se pudo guardar. Intentá de nuevo.'
}

