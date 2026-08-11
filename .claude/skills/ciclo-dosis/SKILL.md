---
name: ciclo-dosis
description: Usar al trabajar en la lógica del ciclo de dosis, el cálculo de horarios, el estado en localStorage, o la integración con Atajos de iOS para crear las alarmas.
---

# Lógica del ciclo de dosis

## Modelo mental
El día tiene un único evento que importa: **el primer toque del botón
"YA ME LEVANTÉ"** (no la apertura de la app — la app puede abrirse sin que
eso dispare nada; ver skill ui-abuela / CLAUDE.md para el flujo del botón).
Todo lo demás se deriva de ese toque. No hay más interacción en el día.

## Zona horaria — CRÍTICO
Todo el manejo de tiempo es en hora local de Guatemala (America/Guatemala,
UTC-6, sin horario de verano).

- Usar SIEMPRE hora local: `new Date()`, `.getHours()`, `.getMinutes()`, `.getDate()`.
- NUNCA usar métodos UTC: `.getUTCHours()`, `.toISOString()`, `.toUTCString()`.
- Para guardar la fecha del día lógico, construir "YYYY-MM-DD" a mano desde
  `getFullYear()`, `getMonth()+1`, `getDate()`. NO usar
  `toISOString().split('T')[0]` — ese es el bug típico: a las 8 pm del 7 de
  agosto en Guatemala ya es 8 de agosto en UTC, y la app pensaría que empezó
  un día nuevo.
- Internamente (estado, cálculos, día lógico) todo se guarda y compara en
  hora local, formato 24h ("14:30"). Lo que se manda AL ATAJO es distinto:
  ver "Disparo desde la web" más abajo — el texto que recibe el Atajo lleva
  am/pm explícito, no 24h crudo.
- No hay horario de verano, no hay saltos de hora que manejar.

## Estado en localStorage
{
  "fechaInicio": "2026-08-07",
  "horaDespertar": "6:30",
  "tomas": ["10:30", "14:30", "18:30"]
}

`tomas` NO incluye la hora de despertar — empieza 4h después (ver más abajo).

Nada más. Si el estado se corrompe o no existe, tratar como día nuevo.

## Redondeo de la hora de despertar
La hora de despertar SIEMPRE se redondea a la media hora más cercana antes
de calcular las tomas:
- minutos 0–15  → :00 de esa hora
- minutos 16–45 → :30 de esa hora
- minutos 46–59 → :00 de la hora siguiente

Ejemplos: 6:10 → 6:00 | 6:15 → 6:00 | 6:16 → 6:30 | 6:25 → 6:30 | 6:50 → 7:00

Las 3 tomas se calculan a partir de la hora redondeada, así que también caen
siempre en :00 o :30.

## Offset de las 3 tomas: +4h, +8h, +12h (NO +0h)
Las tomas empiezan 4 horas DESPUÉS del despertar, no en el despertar mismo.
La primera pastilla del día se la toma ella sola en el momento de tocar el
botón — ya está con el teléfono en la mano en ese instante, una alarma que
suena casi al instante no sirve de recordatorio. Las 3 alarmas son para las
tomas siguientes, cada 4 horas: despertar+4h, +8h, +12h.

Ejemplo: despertar 6:30 am → tomas 10:30 am, 2:30 pm, 6:30 pm.

## Cálculo del día lógico
diaLogico(fecha):
  si fecha.hora < 4:  devolver fecha_de_ayer
  si no:              devolver fecha_de_hoy

Evita que abrir a las 2 am cuente como día nuevo.

## Al abrir la app
1. Calcular día lógico de ahora
2. ¿Es distinto al `fechaInicio` guardado?
   - **Sí** → día nuevo: mostrar SOLO el botón "YA ME LEVANTÉ" (nada se
     calcula ni se dispara todavía)
   - **No** → mismo día: mostrar directo el estado guardado, no recalcular
     nada, no volver a disparar el Atajo, no mostrar el botón

## Al tocar el botón "YA ME LEVANTÉ"
Se usa la hora de ESE TOQUE (no la de cuando cargó la página — pueden pasar
minutos entre abrir la app y tocar):
1. Redondear la hora actual a la media hora más cercana → hora de despertar
2. Calcular las 3 tomas: despertar+4h, +8h, +12h
3. Guardar el estado, disparar el Atajo, pintar la pantalla de resultado
4. El botón desaparece y no vuelve a aparecer hasta el día lógico siguiente

## Regla crítica
**Nunca recalcular ni redisparar el Atajo dos veces en el mismo día lógico.**
Esta es la ÚNICA protección real contra alarmas duplicadas (ver abajo).

## Integración con Atajos de iOS

### Acciones de Reloj disponibles (verificado en el iPhone real, ago 2026)
Shortcuts en este iPhone SÍ ofrece, además de Add Alarm / Set Timer / Stopwatch:
**Find Alarms, Delete Alarms, Toggle Alarm, Toggle Sleep Alarm.**

(Nota histórica: una versión anterior de esta skill decía que estas acciones
no existían. Era incorrecto — o el iPhone las agregó en una actualización de
iOS. No asumir limitaciones de Shortcuts sin volver a verificar en el
dispositivo real, las capacidades cambian entre versiones de iOS.)

- No se usa Set Timer para las dosis (solo uno a la vez, obligaría a
  encadenar, y una cadena rota = dosis perdida). Descartado por seguridad.
- Set Timer sigue descartado por la razón de arriba, pero el resto de la
  limitación original ya no aplica.

### Diseño: Add Alarm nuevas + Delete Alarms de las viejas (dentro del Atajo)
Cada vez que se toca "YA ME LEVANTÉ", el Atajo:
1. Busca (Find Alarms, filtro Label = "Pastilla") las alarmas que dejó el
   día anterior y las guarda en una variable.
2. Crea las 3 alarmas nuevas de hoy con Add Alarm, todas nombradas "Pastilla"
   (mismo Label, para poder encontrarlas después).
3. Recién AL FINAL, borra (Delete Alarms) las que encontró en el paso 1.

El orden importa: las alarmas nuevas se crean ANTES de borrar las viejas, así
nunca hay una ventana sin ninguna alarma activa si algo interrumpe el Atajo
a la mitad. Esto reemplaza la limpieza manual cada 1-2 semanas que se
proponía antes — el Atajo se limpia solo.

Mitigación adicional: el redondeo hace que siempre caigan en :00 o :30.

### Disparo desde la web
shortcuts://run-shortcut?name=Pastilla&input=text&text=10:30 AM,2:30 PM,6:30 PM

El Atajo (armado a mano en el iPhone, una sola vez) recibe el texto, lo parte
por comas, y por cada hora ejecuta "Get dates from text" + Add Alarm. El
texto son las 3 tomas (despertar+4h/+8h/+12h) — la hora de despertar en sí
NO se manda al Atajo, esa pastilla se la toma sin alarma.

Si el Atajo no existe o falla, la app debe seguir mostrando los horarios en
pantalla — el registro visual no depende del Atajo.

**Por qué am/pm explícito y no 24h crudo (bug real, ago 2026):** en una
prueba real apareció una alarma pegada a la hora exacta en que se tocó el
botón, algo que no debería pasar nunca (ver offset +4h/+8h/+12h arriba). Se
descartó el código web línea por línea — nunca manda "ahora" a ningún lado.
La causa más probable es la acción "Get dates from text" dentro del Atajo:
usa el parser de lenguaje natural de iOS (NSDataDetector), y un texto tipo
"3:00" (sin am/pm) es ambiguo para ese parser — en vez de leerlo como
notación militar estricta (3am), puede resolverlo como "la hora más cercana
a ahora", que en la prueba coincidió con la hora del toque. Coincide con el
caso real: despertar ~3:00pm, la 3ª toma (despertar+12h) cae en "3:00" (3am
del día siguiente), y si el parser la lee como "3:00pm de hoy" en vez de
"3:00am", queda pegada al momento de tocar el botón.

Fix: `Pastilla.paraAtajo(hhmm)` en `app.js` convierte cada toma de "H:MM" 24h
a "H:MM AM/PM" antes de mandarla al Atajo (y antes de pintarla en la línea
de diagnóstico — deben ser SIEMPRE el mismo texto, ver sección de abajo). Con
am/pm explícito no hay interpretación ambigua posible. No requiere tocar el
Atajo en el iPhone, solo lo que la web le manda como texto.

## Qué mostrar según el momento del día
- Antes de tocar el botón (día nuevo): SOLO el botón "YA ME LEVANTÉ".
- Después de tocarlo: destacada arriba "PRÓXIMA: 2:30 pm" + debajo las 3
  horas del día apiladas (10:30 am · 2:30 pm · 6:30 pm en el ejemplo).
- Después de la 3ª toma: "Ya terminaste por hoy" en el lugar de la destacada
  (las 3 horas se siguen mostrando abajo, como registro).

La "próxima" se infiere de la hora actual comparada con el arreglo de
horarios — no se registra que ella confirmó haber tomado cada pastilla,
porque eso requeriría más botones. Es un recordatorio, no un registro médico.

## Modo diagnóstico (obligatorio en v1)
El disparo del Atajo no se puede verificar con tests — solo probándolo en un
iPhone real. Para poder distinguir "falló el cálculo" de "falló el Atajo",
la pantalla debe mostrar SIEMPRE, en letra chica al pie:

  10:30 AM · 2:30 PM · 6:30 PM

Las 3 horas calculadas, tal cual se le mandan al Atajo — mismo formato
"H:MM AM/PM" que recibe el Atajo, no el 24h interno (ver "Disparo desde la
web" arriba para el porqué de am/pm explícito).

Esto permite que al probar en el iPhone se vea de inmediato:
- Si las horas están mal → el bug está en el cálculo (redondeo o timezone)
- Si las horas están bien pero no hay alarmas → el bug está en el Atajo o la URL

Además, si el disparo del Atajo falla o el navegador lo bloquea, la app debe
capturar el error y mostrarlo en pantalla en vez de fallar en silencio.

Esta línea de diagnóstico se puede quitar más adelante, cuando el flujo esté
probado y estable. No quitarla antes.

## Tests que deben existir
- Redondeo: 6:10→6:00, 6:15→6:00, 6:16→6:30, 6:25→6:30, 6:50→7:00, 23:50→00:00
- Zona horaria: simular 8:00 pm hora Guatemala → el día lógico debe ser el día
  correcto, NO el siguiente
- Abrir a las 2 am no cuenta como día nuevo
- Tocar el botón dos veces el mismo día no redispara el Atajo (crítico: única
  defensa contra duplicados)
- Cruce de medianoche: despertar 22:00 → tomas empiezan en +4h: 2:00, 6:00, 10:00
- localStorage vacío o corrupto → arranca limpio sin crashear
- paraAtajo: "0:00"→"12:00 AM", "3:00"→"3:00 AM", "12:00"→"12:00 PM",
  "14:30"→"2:30 PM", "23:00"→"11:00 PM" (cubre el cruce de mediodía/medianoche,
  donde estaba el bug real)
