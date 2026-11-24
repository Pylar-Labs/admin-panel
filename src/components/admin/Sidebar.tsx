'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Image,
  Wrench,
  ShoppingBag,
  Star,
  Share2,
  User,
  X,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin/negocio', label: 'Mi negocio', icon: Building2 },
  { href: '/admin/imagenes', label: 'Imágenes', icon: Image },
  { href: '/admin/servicios', label: 'Servicios', icon: Wrench },
  { href: '/admin/catalogo', label: 'Catálogo', icon: ShoppingBag },
  { href: '/admin/testimonios', label: 'Testimonios', icon: Star },
  { href: '/admin/redes', label: 'Redes sociales', icon: Share2 },
  { href: '/admin/cuenta', label: 'Mi cuenta', icon: User },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      <div className="mb-3 flex items-center justify-between px-2 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Panel
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Icon size={17} />
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
      aria-label="Abrir menú"
    >
      <Menu size={20} />
    </button>
  )
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar">
        <div className="flex h-14 items-center px-5 border-b border-sidebar-border">
          <span className="font-bold text-sm tracking-tight text-foreground">Pylar Labs</span>
          <span className="ml-1.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">admin</span>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar shadow-2xl border-r border-sidebar-border">
            <div className="flex h-14 items-center px-5 border-b border-sidebar-border">
              <span className="font-bold text-sm tracking-tight text-foreground">Pylar Labs</span>
              <span className="ml-1.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">admin</span>
            </div>
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
