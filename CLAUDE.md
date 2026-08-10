# CLAUDE.md — Pastilla

## Qué es esto
Web app de un solo toque para que mi abuela no pierda la cuenta de su pastilla.
Se abre desde un ícono en la pantalla de inicio del iPhone (PWA, agregada con
"Añadir a pantalla de inicio" en Safari). No se publica en App Store — es de
uso personal, para una sola persona.

## La usuaria
Mi abuela. Persona mayor. Tiende a tocar donde no debe y a escribir sin querer.
Esto no es un detalle de diseño: es LA restricción del proyecto.

## Cómo funciona (flujo completo)
1. Ella se levanta a una hora distinta cada día — por eso una alarma fija no sirve.
2. Toca el ícono en la pantalla de inicio.
3. La app detecta que es la primera apertura del día y toma esa hora como
   "hora de despertar", redondeada a la media hora más cercana.
4. Calcula las 3 tomas: hora redondeada, +4h, +8h.
5. Dispara un Atajo de iOS (`shortcuts://run-shortcut?name=Pastilla`) que crea
   esas 3 alarmas en el Reloj del iPhone, de una sola vez.
6. El resto del día la app solo MUESTRA el estado. No hay que volver a tocarla.
7. Al día siguiente, primera apertura → todo se reinicia.

## Decisión clave de arquitectura
**La app no suena. El Reloj de iOS suena.**
Una web en iOS no puede reproducir sonido en segundo plano ni contar tiempo
mientras está cerrada. Por eso las 3 alarmas se crean TODAS de golpe al inicio
del día, no una por una. Si se creara una a la vez, y ella apaga la alarma sin
abrir la app, la cadena se rompe y no vuelve a sonar nunca. Eso es inaceptable
en una app de medicación.

No proponer service workers, Web Audio, ni notificaciones push como sustituto
de esto. Ya se evaluó y no es confiable en iOS.

## Reglas de interfaz (obligatorias)
- **Cero botones que no sean absolutamente necesarios.** Idealmente la pantalla
  principal no tiene ninguno: solo información.
- **Ningún campo de texto. Ningún teclado. Nunca.**
- Texto enorme: mínimo 28px para info secundaria, 48px+ para lo importante.
- Alto contraste. Fondo claro, letras oscuras.
- Una sola pantalla. Sin menús, sin pestañas, sin navegación, sin scroll si se puede evitar.
- Sin animaciones ni transiciones que confundan.
- Si un toque accidental puede romper algo, ese toque no debe existir.

## Qué muestra la pantalla principal
En letras grandes, nada más:
- ÚLTIMA TOMA: 6:30 am
- PRÓXIMA: 10:30 am
- (si ya terminaron las 3 del día) "Ya terminaste por hoy"

## Stack
- HTML/CSS/JS puro. Sin framework, sin build step, sin dependencias.
  Este proyecto es chiquito y tiene que seguir funcionando en 2 años sin mantenimiento.
- Estado en localStorage.
- Se sirve como sitio estático (GitHub Pages sirve perfecto).

## Detalles de lógica
- "Primera apertura del día" = la fecha guardada en localStorage es distinta a hoy.
- Corte de día a las 4:00 am, no a medianoche: si ella abre a las 2 am no debe
  contar como día nuevo.
- 3 dosis, espaciadas 4 horas desde el despertar. No hay dosis de madrugada.
- Si abre la app a media tarde por primera vez en el día, igual arranca desde
  ahí — no intentar adivinar ni corregir.

## Seguridad
Esto es un recordatorio, NO el registro oficial del tratamiento. La pantalla
siempre debe mostrar el estado completo para que ella o quien la cuide puedan
verificar de un vistazo, sin depender de que las notificaciones hayan llegado.

## Pendiente de confirmar
Confirmar con quien lleva su tratamiento que "cada 4 horas, 3 veces al día,
solo en horas de vigilia" es correcto, y si la pastilla se toma con comida.
Ajustar aquí antes de que ella dependa de la app.
