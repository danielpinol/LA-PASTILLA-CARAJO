---
name: ciclo-dosis
description: Usar al trabajar en la lógica del ciclo de dosis, el cálculo de horarios, el estado en localStorage, o la integración con Atajos de iOS para crear las alarmas.
---

# Lógica del ciclo de dosis

## Modelo mental
El día tiene un único evento que importa: **la primera apertura de la app**.
Todo lo demás se deriva de ahí. No hay más interacción en el día.

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
- Las horas que se mandan al Atajo van en hora local, formato 24h ("14:30").
- No hay horario de verano, no hay saltos de hora que manejar.

## Estado en localStorage
{
  "fechaInicio": "2026-08-07",
  "horaDespertar": "6:30",
  "tomas": ["6:30", "10:30", "14:30"]
}

Nada más. Si el estado se corrompe o no existe, tratar como día nuevo.

## Redondeo de la hora de despertar
La hora de despertar SIEMPRE se redondea a la media hora más cercana antes
de calcular las tomas:
- minutos 0–15  → :00 de esa hora
- minutos 16–45 → :30 de esa hora
- minutos 46–59 → :00 de la hora siguiente

Ejemplos: 6:10 → 6:00 | 6:15 → 6:00 | 6:16 → 6:30 | 6:25 → 6:30 | 6:50 → 7:00

Las 3 tomas se calculan DESDE la hora redondeada, así que también caen
siempre en :00 o :30.

## Cálculo del día lógico
diaLogico(fecha):
  si fecha.hora < 4:  devolver fecha_de_ayer
  si no:              devolver fecha_de_hoy

Evita que abrir a las 2 am cuente como día nuevo.

## Al abrir la app
1. Calcular día lógico de ahora
2. ¿Es distinto al `fechaInicio` guardado?
   - **Sí** → día nuevo: redondear la hora actual, guardarla como despertar,
     calcular las 3 tomas (+0h, +4h, +8h), disparar el Atajo, mostrar pantalla
   - **No** → mismo día: solo mostrar el estado, no recalcular nada, no
     volver a disparar el Atajo

## Regla crítica
**Nunca recalcular ni redisparar el Atajo dos veces en el mismo día lógico.**
Esta es la ÚNICA protección real contra alarmas duplicadas (ver abajo).

## Integración con Atajos de iOS

### Limitación confirmada del dispositivo
Shortcuts en este iPhone solo ofrece 3 acciones de Reloj:
**Set Timer, Add Alarm, Stopwatch.**
NO existe "Edit Alarm", "Delete Alarm" ni "Toggle Alarm".

Consecuencias, ya decididas — no volver a proponer alternativas:
- No se pueden reusar 3 alarmas fijas cambiándoles la hora. Descartado.
- No se pueden borrar las alarmas viejas desde el Atajo. Descartado.
- No se usa Set Timer (solo uno a la vez, obligaría a encadenar, y una
  cadena rota = dosis perdida). Descartado por seguridad.

### Diseño elegido: Add Alarm, 3 de golpe
Cada mañana el Atajo crea 3 alarmas nuevas con Add Alarm. Se acumulan en la
lista del Reloj (quedan apagadas después de sonar). **Esto es aceptado a
propósito**: se prefiere basura visual sobre cualquier escenario donde una
dosis no suene. Se limpian a mano cada 1-2 semanas.

Mitigación: el redondeo hace que siempre caigan en :00 o :30, así la lista
queda repetitiva pero ordenada.

### Disparo desde la web
shortcuts://run-shortcut?name=Pastilla&input=text&text=6:30,10:30,14:30

El Atajo (armado a mano en el iPhone, una sola vez) recibe el texto, lo parte
por comas, y por cada hora ejecuta Add Alarm.

Si el Atajo no existe o falla, la app debe seguir mostrando los horarios en
pantalla — el registro visual no depende del Atajo.

## Qué mostrar según el momento del día
- Entre tomas: "ÚLTIMA TOMA: 6:30 am" / "PRÓXIMA: 10:30 am"
- Después de la 3ª: "Ya terminaste por hoy"

La "última toma" se infiere de la hora actual comparada con el arreglo de
horarios — no se registra que ella confirmó haber tomado la pastilla, porque
eso requeriría un botón. Es un recordatorio, no un registro médico.

## Modo diagnóstico (obligatorio en v1)
El disparo del Atajo no se puede verificar con tests — solo probándolo en un
iPhone real. Para poder distinguir "falló el cálculo" de "falló el Atajo",
la pantalla debe mostrar SIEMPRE, en letra chica al pie:

  6:30 · 10:30 · 14:30

Las 3 horas calculadas, en formato 24h, tal cual se le mandan al Atajo.

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
- Abrir dos veces el mismo día no redispara el Atajo (crítico: única defensa
  contra duplicados)
- Cruce de medianoche: despertar 22:00 → tomas 22:00, 2:00, 6:00
- localStorage vacío o corrupto → arranca limpio sin crashear
