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
3. Si es la primera apertura del día lógico (corte a las 4am), ve UN SOLO
   botón gigante: "YA ME LEVANTÉ". Nada más en pantalla — ni horas, ni texto.
4. Al tocarlo, se toma la hora de ESE TOQUE (no la de cuando cargó la página)
   como "hora de despertar", redondeada a la media hora más cercana. El botón
   desaparece y no vuelve a aparecer en el resto del día.
5. Calcula las 3 tomas EMPEZANDO 4 horas DESPUÉS del despertar (no en el
   despertar mismo): despertar+4h, +8h, +12h. La primera pastilla del día se
   la toma ella sola en el momento de tocar el botón — ya está con el
   teléfono en la mano, no necesita que le suene nada para esa. Las 3 alarmas
   son para las tomas siguientes.
6. Dispara un Atajo de iOS (`shortcuts://run-shortcut?name=Pastilla`) que crea
   esas 3 alarmas en el Reloj del iPhone, de una sola vez.
7. La pantalla muestra la próxima toma destacada arriba, y las 3 horas del
   día debajo, una por una. El resto del día la app solo MUESTRA el estado
   — si vuelve a abrirla, ve directo estas horas, nunca el botón de nuevo.
8. Al día siguiente (después de las 4am), primera apertura → vuelve a
   aparecer el botón y todo se reinicia.

El botón es la ÚNICA excepción a "cero botones": es el único punto de
interacción de toda la app, y desaparece apenas cumple su función. Que el
toque sea explícito (en vez de disparar todo automáticamente al abrir) es
a propósito: evita que una apertura accidental de la PWA (precarga de Safari,
etc.) cree alarmas sin que ella realmente se haya levantado.

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
- **Cero botones que no sean absolutamente necesarios.** El único permitido es
  "YA ME LEVANTÉ" (ver flujo arriba) — y desaparece apenas se usa.
- **Ningún campo de texto. Ningún teclado. Nunca.**
- Texto enorme: mínimo 28px para info secundaria, 48px+ para lo importante
  (24px solo se tolera en la línea de diagnóstico al pie, que es la de menor
  importancia de toda la pantalla).
- Alto contraste. Fondo claro, letras oscuras. Dentro de esa base, paleta
  cubana con personalidad — coral, turquesa y mostaza, como fachadas de
  La Habana Vieja (ver `style.css`, variables `:root`).
- Una sola pantalla. Sin menús, sin pestañas, sin navegación. Sin scroll si
  se puede evitar — solo se tolera scroll vertical (nunca horizontal) como
  último recurso, si un teléfono muy chico no alcanza a mostrar todo a la vez
  (p. ej. las 3 horas junto con un aviso de error del Atajo).
- Sin animaciones ni transiciones que confundan.
- Si un toque accidental puede romper algo, ese toque no debe existir.

## Qué muestra la pantalla principal
Antes de tocar el botón (primera apertura del día): SOLO el botón
"YA ME LEVANTÉ". Nada más.

Después de tocarlo (o en cualquier apertura posterior el mismo día), en
letras grandes:
- Destacada arriba: PRÓXIMA — 12:30 pm (o "Ya terminaste por hoy" si ya
  pasaron las 3 tomas)
- Debajo, las 3 horas del día, una por una: 10:30 am · 2:30 pm · 6:30 pm
  (ejemplo con despertar 6:30 am: las tomas son despertar+4h/+8h/+12h)
- Al pie, en letra chica, esas mismas 3 horas en 24h tal cual se le mandan
  al Atajo (línea de diagnóstico, ver skill ciclo-dosis)

## Stack
- HTML/CSS/JS puro. Sin framework, sin build step, sin dependencias.
  Este proyecto es chiquito y tiene que seguir funcionando en 2 años sin mantenimiento.
- 3 archivos: `index.html` (estructura), `style.css` (estilos), `app.js`
  (lógica del ciclo + interfaz). Nada de TypeScript ni bundlers: cualquier
  archivo `.ts` acá exigiría un paso de compilación que nadie va a mantener.
- Estado en localStorage.
- Se sirve como sitio estático (Vercel).

## Detalles de lógica
- "Primera apertura del día" = la fecha guardada en localStorage es distinta a hoy
  → se muestra el botón. La hora de despertar se toma cuando ELLA LO TOCA, no
  cuando cargó la página (pueden pasar minutos entre abrir la app y tocar).
- Corte de día a las 4:00 am, no a medianoche: si ella abre a las 2 am no debe
  contar como día nuevo.
- 3 alarmas, espaciadas 4 horas, EMPEZANDO 4h después del despertar (no en el
  despertar mismo). La toma del momento de despertar no lleva alarma: se
  asume que la toma ahí mismo, al tocar el botón.
- Si toca el botón a media tarde por primera vez en el día, igual arranca desde
  ahí — no intentar adivinar ni corregir.
- Nada vuelve a mostrar el botón el mismo día lógico. Esa comparación de fecha
  es la única protección contra alarmas duplicadas — no tiene que haber forma
  de deshacerla desde la pantalla que ella usa (ver nota de debug abajo).

## Debug (solo para Daniel, nunca para ella)
Abrir `index.html?reset=1` borra el estado guardado antes de pintar la
pantalla, para poder volver a probar el botón sin abrir devtools. No hay
ningún botón visible para esto — a propósito, para no reabrir el riesgo de
alarmas duplicadas en la pantalla real.

## Seguridad
Esto es un recordatorio, NO el registro oficial del tratamiento. La pantalla
siempre debe mostrar el estado completo para que ella o quien la cuide puedan
verificar de un vistazo, sin depender de que las notificaciones hayan llegado.

## Pendiente de confirmar
Confirmar con quien lleva su tratamiento que "cada 4 horas, empezando 4h
después de despertar (no en el despertar mismo), solo en horas de vigilia"
es correcto, y si la pastilla se toma con comida. Con esto, contando la toma
del despertar (sin alarma) más las 3 alarmadas, son 4 tomas repartidas en un
día de vigilia normal — confirmar que ese conteo total es el que corresponde
al tratamiento real. Ajustar aquí antes de que ella dependa de la app.
