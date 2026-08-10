---
name: ui-abuela
description: Usar siempre que se escriba HTML, CSS o cualquier cosa visual en este proyecto. Define las restricciones de interfaz para una usuaria adulta mayor que toca donde no debe.
---

# Interfaz para mi abuela

## La regla que manda sobre todas
Si un elemento puede recibir un toque accidental y causar un cambio, ese
elemento no debería existir. Preferir siempre mostrar información sobre
ofrecer una acción.

## Prohibido en este proyecto
- `<input>`, `<textarea>`, `<select>` — nada que abra el teclado
- Menús, pestañas, hamburguesas, modales, popups
- Scroll horizontal
- Gestos (swipe, long press, pinch)
- Iconos sin texto — un ícono solo no se entiende
- Colores como único indicador de significado
- Texto menor a 24px, sin excepción

## Tipografía y contraste
- Fuente del sistema, sin cargar webfonts (tienen que verse rápido y siempre)
- Dato principal: 48-64px, bold
- Etiquetas: 28-32px
- Contraste real: fondo casi blanco (#faf9f7), texto casi negro (#1a1a1a)
- `line-height` generoso (1.4+)

## Formato de horas en pantalla
- Siempre 12 horas con am/pm en minúsculas: "2:15 pm"
- Nunca formato 24h, nunca segundos, nunca fechas ISO
- Nunca tiempo relativo ("en 3 horas") — ella quiere la hora del reloj

## Layout
- Una pantalla, todo visible sin hacer scroll
- Centrado vertical
- Márgenes amplios — nada pegado al borde donde el pulgar toca sin querer
- `user-select: none` en todo, para que no le salga el menú de copiar/pegar
- Bloquear zoom accidental con el viewport meta, sin romper accesibilidad

## Al escribir código
Antes de agregar cualquier elemento interactivo, preguntarse: ¿qué pasa si
lo toca sin querer? Si la respuesta no es "nada", rediseñar.
