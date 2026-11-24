const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const html = read('index.html');
const elements = {};
const document = {
  getElementById(id) {
    assert(html.includes(`id="${id}"`), `Falta el elemento HTML ${id}`);
    return elements[id] ||= {innerHTML:'', textContent:'', classList:{toggle(){}}, showModal(){}, close(){}};
  },
  querySelectorAll: () => []
};
const context = vm.createContext({document, Intl, console, assert, location:{protocol:'http:'}, fetch:async()=>{throw new Error('Archivo local');}});
vm.runInContext(read('propuesta.js'), context);
context.fixture = JSON.parse(read('torneo.json'));
vm.runInContext(`
  cargar(structuredClone(fixture));
  let calculation = calcular(datos);
  assert.equal(calculation.totales.campo, 19200000);
  assert.equal(calculation.totales.caddie, 6400000);
  assert.equal(calculation.cuentas.adrian.campo.saldo, 11200000);
  assert.equal(calculation.cuentas.adrian.campo.saldoAsignado, 4800000);
  assert.equal(calculation.cuentas.adrian.caddie.saldo, 2000000);
  assert.equal(calculation.cuentas.pipe.caddie.saldo, -400000);
  assert(document.getElementById('payment-history').innerHTML.includes('128') === false);
  for(const c of conceptos) {
    const balances = Object.values(calculation.cuentas).reduce((s,a)=>s+a[c].saldoAsignado,0);
    assert.equal(balances,0);
    const transfers = transferencias(calculation.cuentas,c);
    const remaining = Object.fromEntries(Object.entries(calculation.cuentas).map(([id,a])=>[id,a[c].saldoAsignado]));
    for(const t of transfers){remaining[t.de]+=t.valor;remaining[t.para]-=t.valor;}
    assert(Object.values(remaining).every(n=>n===0));
  }
  datos.reservas[1].participantes=['juan-s','danilo'];
  datos.reservas[2].participantes=['adrian','pipe'];
  render(); calculation=calcular(datos);
  assert.equal(calculation.cuentas.adrian.campo.saldo,9600000);
  assert.equal(calculation.cuentas['juan-s'].campo.saldo,-3200000);
  datos.reembolsos.push({fecha:'2026-11-26',de:'juan-s',para:'adrian',concepto:'campo',valor:16000});
  validar(datos);calculation=calcular(datos);
  assert.equal(calculation.cuentas['juan-s'].campo.saldo,-1600000);
  assert.equal(calculation.cuentas.adrian.campo.saldo,8000000);
  assert.equal(calculation.cuentas.adrian.caddie.saldo,2000000);
  datos.reservas.push({id:'reserva-extra',fecha:'2026-11-28',canchas:1,horas:1,participantes:['johan','william'],gastos:{campo:{valor:32000,pagos:[{jugador:'adrian',valor:32000}]}}});
  validar(datos); render(); calculation=calcular(datos);
  assert.equal(calculation.totales.campo,22400000);
  assert.equal(calculation.cuentas.adrian.campo.saldo,11200000);
  assert.equal(calculation.cuentas.johan.campo.saldo,-3200000);
  const bad=structuredClone(datos);bad.reservas[0].gastos.campo.pagos[0].jugador='nadie';
  assert.throws(()=>validar(bad), /Pago inválido/);
  const badTotal=structuredClone(datos);badTotal.reservas[0].gastos.campo.valor=1;
  assert.throws(()=>validar(badTotal), /deben sumar/);
  const badDate=structuredClone(datos);badDate.partidos[0].fecha='2026-02-30';
  assert.throws(()=>validar(badDate), /fecha inválidos/);
  const fractional=structuredClone(fixture);fractional.reservas[1].participantes=['juan-s','danilo','pipe'];
  validar(fractional);
  assert.equal(Object.values(calcular(fractional).cuentas).reduce((s,a)=>s+a.campo.saldoAsignado,0),0);
`, Object.assign(context, {structuredClone}));
console.log('OK: carga JSON, referencias HTML, saldos, reservas, pagos adicionales, reembolsos, conservación de totales y validación.');
