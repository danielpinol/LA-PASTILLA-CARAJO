---
tags: [pastilla-carajo, abuela, ios, atajos, pwa]
creado: 2026-08-19
---

# Pastilla Carajo

Web app de un solo toque para que mi abuela no pierda la cuenta de su pastilla.
Se abre desde un ícono en la pantalla de inicio del iPhone (PWA, agregada con
"Añadir a pantalla de inicio" en Safari). No se publica en App Store — es de uso
personal, para una sola persona.

> [!important] La restricción del proyecto
> La usuaria es una persona mayor que tiende a tocar donde no debe y a escribir
> sin querer. Eso no es un detalle de diseño: es LA restricción. Si un toque
> accidental puede romper algo, ese toque no debe existir.

---

## 1. Cómo funciona

1. Ella se levanta a una hora distinta cada día — por eso una alarma fija no sirve.
2. Toca el ícono en la pantalla de inicio.
3. Si es la primera apertura del **día lógico** (corte a las 4am), ve UN SOLO
   botón gigante: **"YA ME LEVANTÉ"**. Nada más en pantalla.
4. Al tocarlo se toma la hora de ESE TOQUE (no la de cuando cargó la página),
   redondeada a la media hora más cercana. El botón desaparece y no vuelve en
   todo el día.
5. Calcula las 3 tomas **empezando 4 horas después** del despertar:
   `despertar+4h`, `+8h`, `+12h`.
6. Las que caigan en **horario de silencio (10:30pm–6:30am)** no reciben alarma.
7. Dispara un Atajo de iOS que **borra las alarmas de ayer y crea las de hoy**.
8. La pantalla muestra la próxima toma arriba y las 3 horas del día abajo.
9. Al día siguiente (después de las 4am) vuelve a aparecer el botón.

### Por qué la primera pastilla no lleva alarma

Se la toma ella sola en el momento de tocar el botón — ya está con el teléfono
en la mano. Una alarma que suena en ese mismo instante no recuerda nada. Las 3
alarmas son para las tomas siguientes.

### Por qué el toque es explícito

Que dispare al TOCAR y no al ABRIR evita que una apertura accidental de la PWA
(precarga de Safari, etc.) cree alarmas sin que ella se haya levantado.

---

## 2. Decisión clave de arquitectura

> [!warning] La app no suena. El Reloj de iOS suena.
> Una web en iOS no puede reproducir sonido en segundo plano ni contar tiempo
> mientras está cerrada. Por eso las 3 alarmas se crean TODAS de golpe.
> Si se creara una a la vez y ella apaga la alarma sin abrir la app, la cadena
> se rompe y no vuelve a sonar nunca. Inaceptable en una app de medicación.
>
> No proponer service workers, Web Audio ni push como sustituto. Ya se evaluó
> y no es confiable en iOS.

---

## 3. Reglas de interfaz (obligatorias)

- **Cero botones** que no sean absolutamente necesarios. El único permitido es
  "YA ME LEVANTÉ", y desaparece apenas se usa.
- **Ningún campo de texto. Ningún teclado. Nunca.**
- Texto enorme: mínimo 28px para info secundaria, 48px+ para lo importante.
  (24px solo se tolera en la línea de diagnóstico al pie.)
- Alto contraste, fondo claro, letras oscuras. Paleta cubana: coral, turquesa
  y mostaza, como fachadas de La Habana Vieja.
- Una sola pantalla. Sin menús, sin pestañas, sin navegación.
- Sin animaciones ni transiciones que confundan.

---

## 4. Stack

- HTML/CSS/JS puro. Sin framework, sin build step, sin dependencias.
  Tiene que seguir funcionando en 2 años sin mantenimiento.
- 3 archivos: `index.html`, `style.css`, `app.js`.
- `tests.js` corre con `node tests.js` (test runner de Node, sin dependencias).
  Prueba solo la lógica pura — el disparo del Atajo solo se prueba en un iPhone real.
- Estado en `localStorage`.
- Sitio estático en Vercel.

### Detalles de lógica

- Zona horaria: **siempre hora local**. Nunca `toISOString()` ni métodos UTC —
  a las 8pm en Guatemala ya es el día siguiente en UTC, y la app pensaría que
  empezó un día nuevo.
- Corte de día lógico a las **4:00 am**, no a medianoche.
- Redondeo del despertar: minutos 0–15 → `:00`, 16–45 → `:30`, 46–59 → `:00`
  de la hora siguiente.
- El texto que se le manda al Atajo va en **"H:MM AM/PM" explícito**, no 24h.
  Un texto como `3:00` es ambiguo para el parser de iOS y llegó a crear una
  alarma pegada al momento del toque.
- Nada vuelve a mostrar el botón el mismo día lógico. Esa comparación de fecha
  es la única protección real contra alarmas duplicadas.

### Debug (solo para mí, nunca para ella)

`index.html?reset=1` borra el estado guardado antes de pintar la pantalla.
No hay ningún botón visible para esto, a propósito. Hubo un botón temporal
"↺ reiniciar" durante el desarrollo; se quitó antes de instalar en su teléfono
y **no debe volver**.

---

## 5. El Atajo de iOS

Se arma a mano en el iPhone, una sola vez. La web solo lo abre y le pasa las
horas como texto:

```
shortcuts://run-shortcut?name=Pastilla&input=text&text=10:30 AM,2:30 PM,6:30 PM
```

### Estructura completa

```
Receive Apps and 18 more
Find Alarms  (Label is Pastilla)
Count  (Alarms)
If  Count  is greater than  0
    Delete Alarms  (Alarms)
End If
Split Shortcut Input by ","
Repeat with each item in Split Text
    Get dates from Repeat Item
    Create an Alarm  called Pastilla
End Repeat
```

### Lo que hace que funcione

| Pieza | Para qué sirve |
|---|---|
| `called Pastilla` en Create an Alarm | El label es lo ÚNICO que distingue nuestras alarmas de las personales de ella. Sin él, no hay forma de borrarlas después. |
| `Find Alarms` filtrado por Label | Encuentra solo las nuestras del día anterior. |
| `Count` + `If > 0` | El primer día no existe ninguna alarma "Pastilla". Sin el If, iOS pregunta "¿cuáles alarmas querés borrar?" y le muestra las personales de ella. |
| `Delete Alarms` adentro del If | Si queda bajo un `Otherwise` borra al revés: solo cuando NO encontró nada. |

### Ajuste del sistema obligatorio

`Ajustes › Apps › Atajos › Avanzado › Permitir eliminar sin confirmar` → **encendido**

Sin eso, iOS muestra cada mañana un cartel rojo: *"¿Permitir que Pastilla
elimine 1 alarma?"*. Ese ajuste NO está adentro del Atajo — por eso no aparece
por más que uno mantenga presionada la acción.

### Cómo probarlo

Pegar en Safari, dos veces con horas distintas:

```
shortcuts://run-shortcut?name=Pastilla&input=text&text=10:30 AM,2:30 PM,6:30 PM
shortcuts://run-shortcut?name=Pastilla&input=text&text=11:00 AM,3:00 PM,7:00 PM
```

Después de la segunda tienen que quedar **3 alarmas**, no 6.

---

# INSTALACIÓN EN EL TELÉFONO DE LA ABUELA

## Parte 1 — Antes de tocar su teléfono

- [ ] **Subir la versión sin el botón de pruebas** (`git push`). Si ese botón
      queda vivo y ella lo toca, se borra el estado del día, reaparece
      "YA ME LEVANTÉ" y se crean 3 alarmas duplicadas.
- [ ] Esperar a que Vercel termine y abrir la app en MI teléfono: confirmar que
      abajo de las horas ya no aparece el botón de reiniciar.
- [ ] Revisar su versión de iOS: `Ajustes › General › Información › Versión de
      software`. Tiene que ser **igual o más nueva que la mía**. Si es más
      vieja, actualizar primero: `Find Alarms` y `Delete Alarms` no existen en
      versiones viejas.
- [ ] Verificar que tenga la app **Atajos** instalada. Si no, bajarla gratis
      del App Store.

## Parte 2 — Ajustes de su iPhone

- [ ] **Fecha y hora automáticas.** `Ajustes › General › Fecha y hora` →
      "Ajustar automáticamente" encendido, zona de Guatemala.
      *Zona horaria mal = las 3 tomas salen corridas.*
- [ ] **Permitir eliminar sin confirmar.** `Ajustes › Apps › Atajos › Avanzado`.
      *(iOS viejo: `Ajustes › Atajos › Avanzado`.)*
      **Es el ajuste más importante de toda la instalación.**
- [ ] **Callar el aviso de "Atajo ejecutado".** `Ajustes › Notificaciones ›
      Atajos` → apagar. Un cartel menos.
- [ ] **Volumen del timbre arriba y trabado.** `Ajustes › Sonidos y
      vibraciones` → subir el timbre casi al máximo y **apagar "Cambiar con
      botones"**, para que un apretón sin querer no le deje la alarma muda.

> [!note] Las alarmas del Reloj suenan igual en silencio y en Modo Concentración.
> Lo que sí las afecta es el volumen del timbre.

## Parte 3 — Pasarle el Atajo

No armarlo de nuevo a mano: se copia del mío, que ya está probado.

- [ ] En MI teléfono: **Atajos** → mantener presionado **Pastilla** →
      **Compartir** → **Copiar enlace de iCloud**.
- [ ] Mandar ese enlace a SU teléfono (WhatsApp, Mensajes o AirDrop).
- [ ] En SU teléfono: abrir el enlace → bajar hasta abajo → **"Agregar atajo"**.
      Si sale advertencia de atajo no confiable, agregarlo igual.
- [ ] **Revisar que se llame exactamente `Pastilla`.** Si quedó "Pastilla 1",
      renombrarlo. *El nombre es la única conexión entre la web y el Atajo.*
- [ ] Abrirlo y comprobar que llegaron todas las acciones (ver estructura en la
      sección 5). Mirar sobre todo: `Delete Alarms` **adentro** del `If`, y
      `Create an Alarm` diciendo **`Pastilla`**, no la palabra gris `Alarm`.
- [ ] Correrlo una vez ahí mismo (botón ▶). iOS pide permiso para acceder a las
      alarmas → **Permitir**. Se pide una sola vez; mejor aceptarlo yo ahora y
      no ella mañana a las 6am.

## Parte 4 — La app en la pantalla de inicio

> [!warning] Tiene que ser con **Safari**. Chrome no puede agregar íconos a la
> pantalla de inicio.

- [ ] Abrir Safari y escribir la dirección de la app. Tiene que mostrar el botón
      "YA ME LEVANTÉ" — **no tocarlo todavía**.
- [ ] Tocar el botón de **compartir** (cuadradito con flecha, abajo al centro).
- [ ] Bajar y tocar **"Agregar a pantalla de inicio"**.
- [ ] Dejar el nombre (`Pastilla Carajo`) y tocar **Agregar**.
- [ ] Mover el ícono a la **primera pantalla**, arriba a la izquierda o al dock.
      Si alrededor hay íconos parecidos, moverlos a otra pantalla.
- [ ] Cerrar Safari del todo. De ahora en adelante ella entra solo por el ícono.

## Parte 5 — La prueba de verdad

- [ ] Tocar el ícono nuevo: se abre a pantalla completa, sin barra de Safari,
      mostrando **solo** el botón. *(Si veo horas en vez del botón, algo quedó
      guardado de antes.)*
- [ ] Tocar "YA ME LEVANTÉ" y **mirar bien qué pasa**. Anotar si sale algún
      cartel tipo "¿Abrir en Atajos?" — si sale, hay que enseñarle a tocar
      **Abrir**.
- [ ] Volver al ícono: tiene que decir **PRÓXIMA** con una hora arriba, las 3
      horas abajo, y una línea chiquita al pie tipo `10:30 AM · 2:30 PM · 6:30 PM`.
- [ ] Abrir el **Reloj**: las 3 alarmas llamadas **Pastilla**, a las horas de esa
      línea chiquita. Sus alarmas propias, intactas.
- [ ] Tocar el ícono otra vez: **el botón NO debe volver**.
- [ ] Escuchar una alarma real: crear una a 1 minuto en el Reloj y esperar que
      suene. Es la única forma de saber si el volumen le alcanza. Después borrarla.
- [ ] **Borrar las 3 alarmas "Pastilla" de la prueba.** Si no, le suenan hoy sin
      motivo.

> [!tip] La línea chiquita al pie es el tablero de control
> Es exactamente lo que la web le mandó al Atajo. Si las alarmas del Reloj
> coinciden con esa línea, todo funcionó. Si las horas están mal, el bug está
> en el cálculo; si están bien pero no hay alarmas, el bug está en el Atajo.

> [!note] No hace falta reiniciar nada
> Mañana después de las 4am cuenta como día nuevo solo y el botón le vuelve a
> aparecer.

> [!note] Si pruebo de tarde-noche pueden aparecer menos de 3 alarmas
> Es a propósito: las tomas entre 10:30pm y 6:30am no llevan alarma. La línea
> al pie lo aclara diciendo "sin alarmas (horario de silencio)".

## Parte 6 — Enseñarle a ella

Que lo haga **ella** una vez, conmigo al lado. Si no lo hace con sus propias
manos, no cuenta.

> **"Cuando te levantés, tocá el dibujo de la pastilla y después el botón
> grande. Nada más."**

- [ ] Explicarle que si sale un cartel, toque el botón azul (Abrir / Permitir).
- [ ] Explicarle que **la app no suena, el reloj sí**: las alarmas suenan como
      cualquier despertador aunque la app esté cerrada. No tiene que dejarla
      abierta ni cargando.
- [ ] Explicarle que **la primera pastilla es al tocar el botón**; las 3 alarmas
      son para las siguientes.
- [ ] Mañana: llamarla y preguntarle si tocó el botón. El primer día real es el
      que prueba todo.

---

## Si algo falla

| Lo que veo | Qué es | Qué hacer |
|---|---|---|
| Toca el botón y no pasa nada | El Atajo no se llama `Pastilla` exacto, o no está en ese teléfono | Revisar el nombre (Parte 3) |
| Cartel rojo pidiendo permiso para borrar | Falta "Permitir eliminar sin confirmar" | Parte 2 |
| Le pregunta **cuáles** alarmas borrar | El `Delete Alarms` quedó en "Ask Each Time" en vez de la variable | Conectarlo al resultado del `Find Alarms` |
| Las alarmas se acumulan día a día | Se crean sin el label `Pastilla`, o el `Delete` quedó afuera del `If` | Revisar la estructura (sección 5) |
| Las horas de la pantalla están corridas | Zona horaria mal en el teléfono | Parte 2 |
| Horas bien pero sin alarmas | El cálculo funcionó, falló el Atajo | Correr el Atajo a mano y ver el error |
| Aviso rojo en la app | No logró abrir el Atajo | Las horas en pantalla igual son correctas; crear las alarmas a mano ese día |
| Le vuelve a salir el botón el mismo día | Se perdió el estado guardado | **Grave**: duplica alarmas |

---

## Pendiente de confirmar

Confirmar con quien lleva su tratamiento que "cada 4 horas, empezando 4h después
de despertar (no en el despertar mismo), solo en horas de vigilia" es correcto,
y si la pastilla se toma con comida. Contando la toma del despertar (sin alarma)
más las 3 alarmadas, son **4 tomas** en un día de vigilia normal — confirmar que
ese conteo total es el que corresponde al tratamiento real.

También falta definir qué pasa con una toma que cae en horario de silencio:
hoy simplemente se pierde esa alarma, no se reprograma ni se corre a otra hora.

> [!caution] Esto es un recordatorio, NO el registro oficial del tratamiento.
> La pantalla siempre muestra las 3 horas del día, aunque las alarmas hayan
> fallado, para que ella o quien la cuide puedan verificar de un vistazo.
