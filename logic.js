// Lógica pura del ciclo de dosis de Pastilla.
// Sin dependencias, sin efectos secundarios: mismas funciones en el browser y en Node.
// TODO el manejo de tiempo es en hora LOCAL. Nunca UTC, nunca toISOString.
(function (global) {
  'use strict';

  var DIA_CORTE_HORA = 4;      // Corte del día lógico: antes de las 4am cuenta como ayer.
  var DOSIS_COUNT = 3;         // 3 tomas al día.
  var DOSIS_INTERVALO_H = 4;   // Cada 4 horas.

  // Redondea una hora (h, m) a la media hora más cercana.
  //   minutos 0-15  -> :00 de esa hora
  //   minutos 16-45 -> :30 de esa hora
  //   minutos 46-59 -> :00 de la hora siguiente (con wrap a 0)
  // Devuelve { h, m }.
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

  // Formatea { h, m } a "H:MM" 24h, sin cero a la izquierda en la hora,
  // minutos siempre con 2 dígitos. Ej: {6,0}->"6:00", {14,30}->"14:30", {0,0}->"0:00".
  // Este es el formato exacto que espera el Atajo (ver skill ciclo-dosis).
  function fmt24(t) {
    return t.h + ':' + String(t.m).padStart(2, '0');
  }

  // Calcula las 3 tomas DESDE una hora de despertar ya redondeada { h, m }.
  // Suma 4h por toma con wrap 24h; los minutos se conservan.
  // Devuelve un arreglo de { h, m }.
  function calcularTomas(despertar) {
    var tomas = [];
    for (var i = 0; i < DOSIS_COUNT; i++) {
      var h = (despertar.h + i * DOSIS_INTERVALO_H) % 24;
      tomas.push({ h: h, m: despertar.m });
    }
    return tomas;
  }

  // Construye "YYYY-MM-DD" desde los componentes LOCALES de un Date.
  // Nunca usa toISOString (que convertiría a UTC y cambiaría el día).
  function fechaLocalYMD(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  // Día lógico de un Date: si la hora local es < 4am, cuenta como el día anterior.
  // Devuelve "YYYY-MM-DD". Usa aritmética de Date local para cruzar meses/años bien.
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
  // Recibe el estado guardado (o null/corrupto) y la fecha/hora actual (Date).
  // Devuelve { estado, disparar, esNuevoDia }:
  //   - Mismo día lógico -> devuelve el estado tal cual, disparar=false (no redispara el Atajo).
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

  // Reconstruye las 3 tomas como Dates ABSOLUTOS del día lógico guardado,
  // para poder compararlas con "ahora" (maneja bien el cruce de medianoche).
  function tomasAbsolutas(estado) {
    var pf = estado.fechaInicio.split('-').map(Number);
    var pw = estado.horaDespertar.split(':').map(Number);
    var base = new Date(pf[0], pf[1] - 1, pf[2], pw[0], pw[1], 0, 0);
    var arr = [];
    for (var i = 0; i < DOSIS_COUNT; i++) {
      var d = new Date(base.getTime());
      d.setHours(d.getHours() + i * DOSIS_INTERVALO_H);
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
  // Devuelve { terminado, ultima, proxima } (ultima/proxima son Date o null).
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

  var API = {
    DIA_CORTE_HORA: DIA_CORTE_HORA,
    DOSIS_COUNT: DOSIS_COUNT,
    DOSIS_INTERVALO_H: DOSIS_INTERVALO_H,
    redondearMediaHora: redondearMediaHora,
    fmt24: fmt24,
    fmt12: fmt12,
    calcularTomas: calcularTomas,
    fechaLocalYMD: fechaLocalYMD,
    diaLogico: diaLogico,
    esEstadoValido: esEstadoValido,
    procesarApertura: procesarApertura,
    tomasAbsolutas: tomasAbsolutas,
    estadoPantalla: estadoPantalla
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Pastilla = API;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
