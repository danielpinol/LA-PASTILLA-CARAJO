// Tests de la lógica del ciclo de dosis. Sin dependencias externas: node:test + node:assert.
// app.js es JS plano sin build step: se requiere tal cual se sirve al navegador,
// así se prueba el código real y no una copia separada que se puede desincronizar.
// (La parte de interfaz de app.js no corre acá: está guardada detrás de
// `if (typeof document === 'undefined') return;`, y Node no tiene document.)
// Se fija la zona horaria a America/Guatemala ANTES de crear cualquier Date,
// para que el caso de zona horaria sea real y no dependa de la máquina.
process.env.TZ = 'America/Guatemala';

const test = require('node:test');
const assert = require('node:assert');

require('./app.js');
const P = global.Pastilla;
if (!P) {
  throw new Error('app.js no definió globalThis.Pastilla');
}

test('redondeo a la media hora más cercana', () => {
  assert.deepStrictEqual(P.redondearMediaHora(6, 10), { h: 6, m: 0 });
  assert.deepStrictEqual(P.redondearMediaHora(6, 15), { h: 6, m: 0 });
  assert.deepStrictEqual(P.redondearMediaHora(6, 16), { h: 6, m: 30 });
  assert.deepStrictEqual(P.redondearMediaHora(6, 25), { h: 6, m: 30 });
  assert.deepStrictEqual(P.redondearMediaHora(6, 50), { h: 7, m: 0 });
  // 23:50 cruza a la hora siguiente con wrap a medianoche.
  assert.deepStrictEqual(P.redondearMediaHora(23, 50), { h: 0, m: 0 });
});

test('formato 24h que espera el Atajo (sin cero a la izquierda)', () => {
  assert.strictEqual(P.fmt24({ h: 6, m: 0 }), '6:00');
  assert.strictEqual(P.fmt24({ h: 6, m: 30 }), '6:30');
  assert.strictEqual(P.fmt24({ h: 14, m: 30 }), '14:30');
  assert.strictEqual(P.fmt24({ h: 0, m: 0 }), '0:00');
});

test('zona horaria: 8pm en Guatemala NO adelanta el día lógico', () => {
  // 8:00 pm del 7 de agosto en Guatemala = 02:00 UTC del 8 de agosto.
  // El bug clásico (toISOString) daría "2026-08-08"; la hora local da "2026-08-07".
  const instante = new Date(Date.UTC(2026, 7, 8, 2, 0, 0));
  assert.strictEqual(instante.getHours(), 20, 'sanity: debe ser 8pm local en Guatemala');
  assert.strictEqual(instante.getDate(), 7);
  assert.strictEqual(P.diaLogico(instante), '2026-08-07');
});

test('abrir a las 2am NO cuenta como día nuevo', () => {
  // Estado creado el 7 de agosto por la mañana.
  const estado = { fechaInicio: '2026-08-07', horaDespertar: '6:30', tomas: ['6:30', '10:30', '14:30'] };
  // Ella abre a las 2:00 am del 8 de agosto: antes del corte (4am) => día lógico = 7.
  const madrugada = new Date(2026, 7, 8, 2, 0, 0);
  assert.strictEqual(P.diaLogico(madrugada), '2026-08-07');
  const r = P.procesarApertura(estado, madrugada);
  assert.strictEqual(r.esNuevoDia, false);
  assert.strictEqual(r.disparar, false);
  assert.deepStrictEqual(r.estado, estado);
});

test('tocar el botón dos veces el mismo día NO recalcula ni redispara', () => {
  // Primer toque: 6:35 am del 7 de agosto -> día nuevo, dispara.
  const primerToque = new Date(2026, 7, 7, 6, 35, 0);
  const r1 = P.procesarApertura(null, primerToque);
  assert.strictEqual(r1.disparar, true);
  assert.strictEqual(r1.esNuevoDia, true);
  assert.deepStrictEqual(r1.estado.tomas, ['6:30', '10:30', '14:30']);

  // Ella vuelve a abrir esa tarde: la app NO ofrece botón, así que esto simula
  // que procesarApertura se llama con el estado ya guardado (nunca con null).
  const reapertura = new Date(2026, 7, 7, 15, 12, 0);
  const r2 = P.procesarApertura(r1.estado, reapertura);
  assert.strictEqual(r2.disparar, false);
  assert.strictEqual(r2.esNuevoDia, false);
  assert.deepStrictEqual(r2.estado, r1.estado);
});

test('cruce de medianoche: despertar 22:00 -> tomas 22:00, 2:00, 6:00', () => {
  const tomas = P.calcularTomas({ h: 22, m: 0 }).map(P.fmt24);
  assert.deepStrictEqual(tomas, ['22:00', '2:00', '6:00']);
});

test('localStorage vacío o corrupto: arranca limpio sin crashear', () => {
  const ahora = new Date(2026, 7, 7, 8, 5, 0); // 8:05 am -> redondea a 8:00
  const esperado = ['8:00', '12:00', '16:00'];

  const casos = [null, undefined, {}, { fechaInicio: 'basura' }, { tomas: [] }, 'texto suelto', 42];
  for (const c of casos) {
    const r = P.procesarApertura(c, ahora);
    assert.strictEqual(r.esNuevoDia, true, 'estado inválido debe tratarse como día nuevo: ' + JSON.stringify(c));
    assert.strictEqual(r.disparar, true);
    assert.strictEqual(r.estado.fechaInicio, '2026-08-07');
    assert.deepStrictEqual(r.estado.tomas, esperado);
  }
});

test('nuevo día real: cambia de fecha y recalcula', () => {
  const ayer = { fechaInicio: '2026-08-06', horaDespertar: '6:30', tomas: ['6:30', '10:30', '14:30'] };
  const hoy = new Date(2026, 7, 7, 7, 20, 0); // 7:20 am -> redondea a 7:30
  const r = P.procesarApertura(ayer, hoy);
  assert.strictEqual(r.esNuevoDia, true);
  assert.strictEqual(r.disparar, true);
  assert.strictEqual(r.estado.fechaInicio, '2026-08-07');
  assert.deepStrictEqual(r.estado.tomas, ['7:30', '11:30', '15:30']);
});

test('estado de pantalla: próxima / terminado', () => {
  const estado = { fechaInicio: '2026-08-07', horaDespertar: '6:30', tomas: ['6:30', '10:30', '14:30'] };

  // Entre la 1ª y la 2ª toma (8:00 am): próxima 10:30.
  let s = P.estadoPantalla(estado, new Date(2026, 7, 7, 8, 0, 0));
  assert.strictEqual(s.terminado, false);
  assert.strictEqual(P.fmt12(s.ultima), '6:30 am');
  assert.strictEqual(P.fmt12(s.proxima), '10:30 am');

  // Después de la 3ª toma (3:00 pm): terminado.
  s = P.estadoPantalla(estado, new Date(2026, 7, 7, 15, 0, 0));
  assert.strictEqual(s.terminado, true);
  assert.strictEqual(P.fmt12(s.ultima), '2:30 pm');
});
