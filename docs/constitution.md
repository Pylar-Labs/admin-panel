# Constitución — Admin panel — Pylar Labs
Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **Simplicidad primero**: el mínimo de dependencias y de capas; nada de funciones "por si acaso".
2. **La spec manda**: nada se implementa si no está en la spec activa. Si falta una decisión, se para y se pregunta.
3. **Aislamiento entre clientes**: un cliente solo ve y edita los datos de su `site_id`; lo garantiza el servidor (RLS), no solo la interfaz.
4. **Secretos fuera del cliente**: ninguna clave privada en código de navegador ni en git; datos personales tratados como privados.
5. **Lint y build como puerta**: `npm run lint` y `npm run build` sin errores antes de dar algo por hecho.
6. **Idioma**: código en inglés; documentación e interfaz en español. Lo que el panel guarda debe poder mapearse al contrato de `template-landing`.
