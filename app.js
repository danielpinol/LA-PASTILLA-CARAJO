// Lógica pura del ciclo de dosis. Sin DOM, sin efectos secundarios: se puede
// requerir igual en Node (ver tests.js) que cargar en el navegador.
// TODO el manejo de tiempo es en hora LOCAL. Nunca UTC, nunca toISOString.
(function (global) {
  'use strict';

  var DIA_CORTE_HORA = 4;      // Corte del día lógico: antes de las 4am cuenta como ayer.
  var DOSIS_COUNT = 3;         // 3 tomas al día.
  var DOSIS_INTERVALO_H = 4;   // Cada 4 horas.

  // Horario de silencio: nunca se crea una alarma real en este rango, aunque
  // el cálculo +4h/+8h/+12h haya puesto una toma ahí. Pensado para toques
  // accidentales del botón (p. ej. de tarde-noche, que empujan alguna toma a
  // la madrugada) — no queremos despertarla con una alarma a esa hora.
  // Ventana cruza medianoche: 10:30pm inclusive -> 6:30am exclusive.
  var SILENCIO_INICIO_MIN = 22 * 60 + 30; // 10:30 pm
  var SILENCIO_FIN_MIN = 6 * 60 + 30;     // 6:30 am

  // Redondea una hora (h, m) a la media hora más cercana.
  //   minutos 0-15  -> :00 de esa hora
  //   minutos 16-45 -> :30 de esa hora
  //   minutos 46-59 -> :00 de la hora siguiente (con wrap a 0)
  function redondearMediaHora(h, m) {
    var hh = h, mm;
    if (m <= 15) {
      mm = 0;
    } else if (m <= 45) {
      mm = 30;
    } else {
      mm = 0;
      hh = (h + 1) % 24;
    }
    return { h: hh, m: mm };
  }

  // Formatea { h, m } a "H:MM" 24h, sin cero a la izquierda en la hora.
  // Formato de almacenamiento interno (estado.tomas, diaLogico, etc).
  // NO es lo que recibe el Atajo — ver paraAtajo() para eso.
  function fmt24(t) {
    return t.h + ':' + String(t.m).padStart(2, '0');
  }

  // Convierte "H:MM" 24h a "H:MM AM/PM" — el formato que efectivamente se
  // manda al Atajo (ver paraAtajo más abajo, y dispararAtajo en el bloque
  // de interfaz). Un texto como "3:00" es ambiguo para el parser de
  // lenguaje natural de iOS (Get dates from text / NSDataDetector): puede
  // leerlo como la hora más cercana a "ahora" en vez de como notación
  // militar estricta, lo que en la práctica creaba una alarma pegada al
  // momento de tocar el botón. Con am/pm explícito no hay ambigüedad posible.
  function paraAtajo(hhmm) {
    var partes = hhmm.split(':').map(Number);
    var h = partes[0], m = partes[1];
    var ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }

  // ¿"H:MM" cae en el horario de silencio (10:30pm–6:30am)?
  function enSilencio(hhmm) {
    var partes = hhmm.split(':').map(Number);
    var min = partes[0] * 60 + partes[1];
    return min >= SILENCIO_INICIO_MIN || min < SILENCIO_FIN_MIN;
  }

  // De la lista de tomas ("H:MM"[]), devuelve solo las que SÍ deben llevar
  // alarma real — las que caen en horario de silencio se excluyen. Puede
  // devolver un arreglo vacío (p. ej. toque accidental de tarde-noche donde
  // las 3 tomas caen de madrugada): en ese caso no hay que disparar el
  // Atajo en absoluto, ver dispararAtajo en el bloque de interfaz.
  function tomasConAlarma(tomasHHMM) {
    return tomasHHMM.filter(function (t) { return !enSilencio(t); });
  }

  // Calcula las 3 tomas a partir de una hora de despertar ya redondeada { h, m }.
  // Empiezan 4 horas DESPUÉS del despertar, no en el despertar mismo: esa
  // primera pastilla se la toma ella sola en el momento de tocar el botón
  // (ya está con el teléfono en la mano, no necesita alarma). Las 3 alarmas
  // son para las siguientes tomas, cada 4 horas: +4h, +8h, +12h.
  function calcularTomas(despertar) {
    var tomas = [];
    for (var i = 0; i < DOSIS_COUNT; i++) {
      var h = (despertar.h + (i + 1) * DOSIS_INTERVALO_H) % 24;
      tomas.push({ h: h, m: despertar.m });
    }
    return tomas;
  }

  // Construye "YYYY-MM-DD" desde los componentes LOCALES de un Date.
  function fechaLocalYMD(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  // Día lógico de un Date: si la hora local es < 4am, cuenta como el día anterior.
  function diaLogico(d) {
    var base = new Date(
      d.getFullYear(), d.getMonth(), d.getDate(),
      d.getHours(), d.getMinutes(), 0, 0
    );
    if (base.getHours() < DIA_CORTE_HORA) {
      base.setDate(base.getDate() - 1);
    }
    return fechaLocalYMD(base);
  }

  // ¿El estado guardado tiene la forma esperada? Si no, se trata como día nuevo.
  function esEstadoValido(e) {
    return !!e &&
      typeof e.fechaInicio === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.fechaInicio) &&
      typeof e.horaDespertar === 'string' &&
      Array.isArray(e.tomas) &&
      e.tomas.length === DOSIS_COUNT;
  }

  // Decide qué hacer al abrir la app. SIN efectos secundarios.
  //   - Mismo día lógico -> devuelve el estado tal cual, disparar=false.
  //   - Día nuevo / estado inválido -> recalcula tomas, disparar=true.
  function procesarApertura(estadoGuardado, ahora) {
    var hoy = diaLogico(ahora);
    if (esEstadoValido(estadoGuardado) && estadoGuardado.fechaInicio === hoy) {
      return { estado: estadoGuardado, disparar: false, esNuevoDia: false };
    }
    var despertar = redondearMediaHora(ahora.getHours(), ahora.getMinutes());
    var tomas = calcularTomas(despertar);
    var estado = {
      fechaInicio: hoy,
      horaDespertar: fmt24(despertar),
      tomas: tomas.map(fmt24)
    };
    return { estado: estado, disparar: true, esNuevoDia: true };
  }

  // Reconstruye las 3 tomas como Dates ABSOLUTOS del día lógico guardado.
  // Mismo offset que calcularTomas: empiezan 4h después del despertar, no
  // en el despertar mismo (ver calcularTomas más arriba).
  function tomasAbsolutas(estado) {
    var pf = estado.fechaInicio.split('-').map(Number);
    var pw = estado.horaDespertar.split(':').map(Number);
    var base = new Date(pf[0], pf[1] - 1, pf[2], pw[0], pw[1], 0, 0);
    var arr = [];
    for (var i = 0; i < DOSIS_COUNT; i++) {
      var d = new Date(base.getTime());
      d.setHours(d.getHours() + (i + 1) * DOSIS_INTERVALO_H);
      arr.push(d);
    }
    return arr;
  }

  // Formatea un Date a 12h con am/pm en minúsculas. Ej: "6:30 am", "2:15 pm".
  function fmt12(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    var ap = h < 12 ? 'am' : 'pm';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }

  // Estado a mostrar en pantalla según la hora actual.
  function estadoPantalla(estado, ahora) {
    var tomas = tomasAbsolutas(estado);
    var ultima = null, proxima = null;
    for (var i = 0; i < tomas.length; i++) {
      if (tomas[i].getTime() <= ahora.getTime()) {
        ultima = tomas[i];
      } else if (proxima === null) {
        proxima = tomas[i];
      }
    }
    if (proxima === null && ultima !== null) {
      return { terminado: true, ultima: ultima, proxima: null };
    }
    return { terminado: false, ultima: ultima, proxima: proxima };
  }

  global.Pastilla = {
    DIA_CORTE_HORA: DIA_CORTE_HORA,
    DOSIS_COUNT: DOSIS_COUNT,
    DOSIS_INTERVALO_H: DOSIS_INTERVALO_H,
    redondearMediaHora: redondearMediaHora,
    fmt24: fmt24,
    paraAtajo: paraAtajo,
    enSilencio: enSilencio,
    tomasConAlarma: tomasConAlarma,
    fmt12: fmt12,
    calcularTomas: calcularTomas,
    fechaLocalYMD: fechaLocalYMD,
    diaLogico: diaLogico,
    esEstadoValido: esEstadoValido,
    procesarApertura: procesarApertura,
    tomasAbsolutas: tomasAbsolutas,
    estadoPantalla: estadoPantalla
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// Interfaz: botón, pantalla de resultado y disparo del Atajo.
// Solo corre en el navegador (Node no tiene document, así que tests.js
// nunca ejecuta este bloque — solo prueba la lógica pura de arriba).
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  var CLAVE = 'pastilla.estado';

  function $(id) { return document.getElementById(id); }

  function mostrarError(msg) {
    var el = $('error');
    el.textContent = msg;
    el.classList.remove('oculto');
  }

  // Lee el estado de localStorage; si algo falla, devuelve null (día nuevo).
  function leerEstado() {
    try {
      var raw = localStorage.getItem(CLAVE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function guardarEstado(estado) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      // Si no se puede persistir, la app sigue mostrando el estado del día.
      mostrarError('No se pudo guardar el estado, pero la pantalla es correcta.');
    }
  }

  // Dispara el Atajo de iOS. Si el navegador nunca pierde el foco (indicio
  // de que no se abrió Shortcuts), lo avisa en pantalla: nunca falla en silencio.
  function dispararAtajo(tomas) {
    var conAlarma = Pastilla.tomasConAlarma(tomas);
    if (conAlarma.length === 0) {
      // Las 3 tomas de hoy caen en horario de silencio (10:30pm-6:30am):
      // no hay nada que alarmar. No abrir el Atajo con texto vacío — un
      // toma vacía ahí reproduciría el mismo bug que paraAtajo() arregló
      // (el parser de iOS puede interpretar texto vacío como "ahora").
      return;
    }
    var text = conAlarma.map(Pastilla.paraAtajo).join(',');
    var url = 'shortcuts://run-shortcut?name=Pastilla&input=text&text=' +
              encodeURIComponent(text);

    var confirmado = false;
    function marcarConfirmado() { confirmado = true; }
    window.addEventListener('blur', marcarConfirmado, { once: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) marcarConfirmado();
    }, { once: true });

    try {
      window.location.href = url;
    } catch (e) {
      mostrarError('No se pudo abrir el Atajo "Pastilla": ' +
                   (e && e.message ? e.message : e));
      return;
    }

    setTimeout(function () {
      if (!confirmado) {
        mostrarError('No se abrió el Atajo "Pastilla". Las horas de abajo son correctas, ' +
                     'pero las alarmas quizá no se crearon.');
      }
    }, 1500);
  }

  function pintarResultado(estado, ahora) {
    var conAlarma = Pastilla.tomasConAlarma(estado.tomas);
    $('diagnostico').textContent = conAlarma.length > 0
      ? conAlarma.map(Pastilla.paraAtajo).join(' · ')
      : 'sin alarmas (horario de silencio 10:30pm-6:30am)';

    var s = Pastilla.estadoPantalla(estado, ahora);
    var destacada = $('destacada');
    if (s.terminado) {
      destacada.classList.add('terminado');
      $('destacadaEtiqueta').textContent = '';
      $('destacadaValor').textContent = 'Ya terminaste por hoy';
    } else {
      destacada.classList.remove('terminado');
      $('destacadaEtiqueta').textContent = 'PRÓXIMA';
      $('destacadaValor').textContent = Pastilla.fmt12(s.proxima);
    }

    var lista = $('listaTomas');
    lista.innerHTML = '';
    Pastilla.tomasAbsolutas(estado).forEach(function (d) {
      var div = document.createElement('div');
      div.className = 'hora';
      div.textContent = Pastilla.fmt12(d);
      lista.appendChild(div);
    });
  }

  function mostrarPantallaResultado() {
    $('btnLevante').classList.add('oculto');
    $('resultado').classList.remove('oculto');
  }

  function mostrarPantallaBoton() {
    $('resultado').classList.add('oculto');
    $('btnLevante').classList.remove('oculto');
  }

  // Se toma la hora EN ESTE MOMENTO (el del toque), no la de cuando cargó la página.
  function alTocarBoton() {
    $('btnLevante').disabled = true;
    var ahora = new Date();
    var r = Pastilla.procesarApertura(null, ahora); // null fuerza el cálculo de un día nuevo
    guardarEstado(r.estado);
    pintarResultado(r.estado, ahora);
    mostrarPantallaResultado();
    dispararAtajo(r.estado.tomas);
  }

  function iniciar() {
    var ahora = new Date();
    var r = Pastilla.procesarApertura(leerEstado(), ahora);

    if (r.esNuevoDia) {
      // Primera apertura del día: solo el botón. Nada se calcula ni se
      // dispara hasta que ella toque — así el toque siempre corresponde
      // al momento real en que se levantó.
      mostrarPantallaBoton();
    } else {
      // Ya tocó el botón hoy: mostrar directo lo ya calculado, sin
      // recalcular ni volver a disparar el Atajo.
      pintarResultado(r.estado, ahora);
      mostrarPantallaResultado();
    }

    $('btnLevante').addEventListener('click', alTocarBoton, { once: true });
  }

  // Cualquier error inesperado se muestra en pantalla, nunca en silencio.
  try {
    iniciar();
  } catch (e) {
    mostrarError('Error al iniciar: ' + (e && e.message ? e.message : e));
  }
})();
