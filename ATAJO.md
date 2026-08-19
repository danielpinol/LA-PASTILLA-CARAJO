# El Atajo "Pastilla" (armado a mano en el iPhone)

La web NO crea ni borra alarmas. Solo abre este Atajo y le pasa un texto con
las horas del día, en formato `10:30 AM,2:30 PM,6:30 PM` (am/pm explícito —
ver skill `ciclo-dosis` para el porqué).

## Lo que ya funciona (no tocar)
El bloque de creación de alarmas está probado en el iPhone real y funciona:

    Split Shortcut Input by Custom ","
    Repeat with each item in Split Text
        Get dates from Repeat Item
        Create an Alarm for Dates called "Pastilla"
    End Repeat

Lo único que se le agregó fue el nombre `Pastilla` en el campo `called` (antes
quedaba vacío). No cambia nada de la creación — misma hora, misma acción — pero
es lo único que después permite distinguir nuestras 3 alarmas de cualquier otra
que ella se haya puesto.

## Lo que se agrega alrededor: borrar las de ayer
Sin esto, cada día quedan 3 alarmas más en el Reloj hasta llenarlo.

**Antes del Split**, arriba de todo:

1. `Find Alarms` → filtro `Label` `is` `Pastilla`
2. `Set Variable` `Viejas` = `Find Alarms`

**Después del End Repeat**, abajo de todo:

3. `Delete Alarms` → `Viejas`

**El borrado va AL FINAL, no al principio.** Si algo interrumpe el Atajo a la
mitad, en el peor caso quedan alarmas de más — nunca cero alarmas. En una app
de medicación, alarmas de sobra es un problema; ninguna alarma es EL problema.

## Dos cosas que hay que revisar sí o sí
- **Delete Alarms pregunta antes de borrar por defecto.** Mantener presionada
  la acción → apagar la confirmación (`Ask Before Deleting` / `Show When Run`).
  Si queda encendida, la abuela ve un diálogo que no va a entender y las
  alarmas viejas no se borran.
- **El campo `called` tiene que decir `Pastilla`**, no quedar en gris (gris =
  vacío = alarma sin nombre = alarma que el Atajo nunca va a poder borrar).

## Limpieza única, a mano
Las alarmas acumuladas hasta ahora se crearon sin label, así que `Find Alarms`
no las encuentra. Hay que borrarlas desde el Reloj una sola vez, antes de la
primera corrida con el Atajo nuevo.

## Si Add Alarm da error por hora repetida
Si un día la hora nueva coincide exacto con una vieja y iOS se queja, invertir
el orden: `Delete Alarms` primero, el Repeat después. Se pierde la garantía de
"nunca cero alarmas" a mitad del Atajo, así que solo hacerlo si el error
aparece de verdad.

## Cómo probar
1. Correr el Atajo a mano con input `10:30 AM,2:30 PM,6:30 PM`
2. Reloj → 3 alarmas "Pastilla"
3. Correrlo otra vez con `11:00 AM,3:00 PM,7:00 PM`
4. Reloj → deben quedar **3**, las nuevas. Si quedan 6, el filtro por Label o
   el Set Variable está mal.
