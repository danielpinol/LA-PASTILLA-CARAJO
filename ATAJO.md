# El Atajo "Pastilla" (se arma a mano en el iPhone, una sola vez)

La web NO crea ni borra alarmas. Solo abre este Atajo y le pasa un texto con
las horas del día, en formato `10:30 AM,2:30 PM,6:30 PM` (am/pm explícito —
ver skill `ciclo-dosis` para el porqué).

Todo lo demás — crear las alarmas de hoy y **borrar las de ayer** — pasa acá
adentro. Sin este borrado, cada día quedan 3 alarmas más en el Reloj hasta
llenarlo.

## Idea
Las alarmas se crean SIEMPRE con el mismo nombre: **`Pastilla`**. Ese nombre
es lo único que permite después distinguirlas de las alarmas propias de ella
(despertador, etc.) y borrar solo las nuestras. Si una alarma se crea sin
label, queda huérfana y hay que borrarla a mano.

## Orden de las acciones (importante)

1. **Find Alarms** → filtro `Label` `is` `Pastilla`
   (las de ayer, las que hay que borrar después)
2. **Set Variable** `Viejas` = resultado de Find Alarms
3. **Split Text** → entrada: `Shortcut Input`, separador: `Custom` → `,`
4. **Repeat with Each** (sobre el resultado del Split):
   - **Get dates from input** → `Repeat Item`
   - **Add Alarm** → hora: `Date` (el resultado anterior), Label: `Pastilla`,
     Repeat: `Never`, Snooze: como prefieras
5. **Delete Alarms** → `Viejas`

**El borrado va AL FINAL, no al principio.** Si algo interrumpe el Atajo a la
mitad (ella toca fuera, se traba), en el peor caso quedan alarmas de más —
nunca cero alarmas. En una app de medicación, alarmas de sobra es un
problema; ninguna alarma es el problema.

## Dos cosas que hay que revisar sí o sí

- **Delete Alarms pregunta antes de borrar por defecto.** Mantener presionada
  la acción → apagar la confirmación (`Ask Before Deleting` / `Show When Run`).
  Si queda encendida, la abuela ve un diálogo que no va a entender y las
  alarmas viejas no se borran.
- **El Label tiene que quedar escrito en Add Alarm**, no vacío. Probar una vez
  y abrir el Reloj: las 3 alarmas nuevas deben decir "Pastilla".

## Si Add Alarm da error por hora repetida
Si un día la hora nueva coincide exacto con una vieja y iOS se queja, invertir
el orden: `Delete Alarms` primero, `Add Alarm` después. Se pierde la garantía
de "nunca cero alarmas" a mitad del Atajo, así que solo hacerlo si el error
aparece de verdad.

## Cómo probar
1. Correr el Atajo a mano con input de prueba: `10:30 AM,2:30 PM,6:30 PM`
2. Abrir Reloj → deben quedar 3 alarmas "Pastilla"
3. Correrlo otra vez con `11:00 AM,3:00 PM,7:00 PM`
4. Abrir Reloj → deben quedar **3**, las nuevas. Si quedan 6, el paso 1 o el 5
   está mal (el filtro por Label o el Set Variable).
