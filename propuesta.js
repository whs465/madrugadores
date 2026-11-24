'use strict';
let datos;
let grupoSeleccionado = 0;
let jugadorFiltrado = '';
const conceptos = ['campo', 'caddie'];
const el = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nombre = id => datos.jugadores.find(p => p.id === id).nombre;
const money = value => new Intl.NumberFormat('es-CO', {style:'currency', currency:datos.moneda, maximumFractionDigits:0}).format(value);
const fecha = value => new Intl.DateTimeFormat('es-CO', {day:'numeric', month:'short', timeZone:'UTC'}).format(new Date(value + 'T12:00:00Z'));

function validar(d) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(d && typeof d.nombre === 'string' && typeof d.temporada === 'string', 'Faltan nombre o temporada.');
  check(d.moneda === 'COP', 'Esta propuesta usa pesos colombianos (COP).');
  for (const key of ['jugadores','grupos','partidos','reservas','reembolsos']) check(Array.isArray(d[key]), `Falta la lista ${key}.`);
  const ids = new Set(d.jugadores.map(p => p.id));
  check(ids.size === d.jugadores.length && ids.size > 0, 'Los jugadores deben tener identificadores únicos.');
  d.jugadores.forEach(p => check(typeof p.id === 'string' && p.id && typeof p.nombre === 'string' && p.nombre, 'Jugador sin id o nombre.'));
  check(ids.has(d.jugadorDestacado), 'El jugador destacado no existe.');
  const refs = list => Array.isArray(list) && list.every(id => ids.has(id)) && new Set(list).size === list.length;
  const dateOK = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  const amount = n => Number.isSafeInteger(n) && n >= 0;
  const grouped = d.grupos.flatMap(g => g.jugadores || []);
  check(new Set(grouped).size === grouped.length, 'Un jugador está repetido entre grupos.');
  d.grupos.forEach(g => check(typeof g.nombre === 'string' && refs(g.jugadores), 'Grupo inválido o jugador desconocido.'));
  const pairs = new Set();
  d.partidos.forEach(p => {
    check(refs(p.jugadores) && p.jugadores.length === 2 && dateOK(p.fecha), 'Partido con jugadores o fecha inválidos.');
    check(p.marcador === null || (Array.isArray(p.marcador) && p.marcador.length === 2 && p.marcador.every(amount) && p.marcador[0] !== p.marcador[1]), 'Marcador inválido: usa dos números diferentes o null.');
    const pair = [...p.jugadores].sort().join('|');
    check(!pairs.has(pair), 'Este torneo admite un partido por pareja de jugadores.'); pairs.add(pair);
  });
  const reserveIds = new Set();
  d.reservas.forEach(r => {
    check(typeof r.id === 'string' && r.id && !reserveIds.has(r.id), 'Las reservas deben tener id único.'); reserveIds.add(r.id);
    check(dateOK(r.fecha) && refs(r.participantes), 'Reserva con fecha o participantes inválidos.');
    check(Number.isInteger(r.canchas) && r.canchas > 0 && Number.isFinite(r.horas) && r.horas > 0, 'Indica canchas y horas positivas.');
    check(r.gastos && Object.keys(r.gastos).every(c => conceptos.includes(c)), 'Los conceptos válidos son campo y caddie.');
    Object.values(r.gastos).forEach(g => {
      check(amount(g.valor) && Array.isArray(g.pagos), 'Gasto inválido.');
      g.pagos.forEach(p => check(ids.has(p.jugador) && amount(p.valor), 'Pago inválido.'));
      check(g.pagos.reduce((s,p) => s+p.valor,0) === g.valor, 'Los pagos de cada gasto deben sumar su valor. Registra solo gastos ya pagados.');
    });
  });
  d.reembolsos.forEach(r => check(dateOK(r.fecha) && ids.has(r.de) && ids.has(r.para) && r.de !== r.para && conceptos.includes(r.concepto) && amount(r.valor) && r.valor > 0, 'Reembolso inválido.'));
}

// Cálculo en centavos; el residuo se distribuye para conservar el total exacto.
function calcular(d) {
  const cuentas = Object.fromEntries(d.jugadores.map(p => [p.id, Object.fromEntries(conceptos.map(c => [c,{pagado:0,cuota:0,sinAsignar:0,reembolsado:0}]))]));
  const totales = {campo:0,caddie:0};
  for (const r of d.reservas) for (const c of conceptos) {
    const g = r.gastos[c]; if (!g) continue;
    totales[c] += g.valor*100;
    for (const p of g.pagos) { cuentas[p.jugador][c].pagado += p.valor*100; if (!r.participantes.length) cuentas[p.jugador][c].sinAsignar += p.valor*100; }
    if (r.participantes.length) {
      const base = Math.floor(g.valor*100/r.participantes.length), extra = g.valor*100 % r.participantes.length;
      r.participantes.forEach((id,i) => cuentas[id][c].cuota += base+(i<extra?1:0));
    }
  }
  for (const r of d.reembolsos) {
    cuentas[r.de][r.concepto].reembolsado += r.valor*100;
    cuentas[r.para][r.concepto].reembolsado -= r.valor*100;
  }
  for (const account of Object.values(cuentas)) for (const c of conceptos) {
    const a = account[c]; a.saldo = a.pagado-a.cuota+a.reembolsado; a.saldoAsignado = a.saldo-a.sinAsignar;
  }
  return {cuentas,totales};
}

function transferencias(cuentas, concepto) {
  const acreedores = datos.jugadores.map(p => ({id:p.id,valor:cuentas[p.id][concepto].saldoAsignado})).filter(x => x.valor>0);
  const deudores = datos.jugadores.map(p => ({id:p.id,valor:-cuentas[p.id][concepto].saldoAsignado})).filter(x => x.valor>0);
  const movimientos = [];
  for (const deudor of deudores) for (const acreedor of acreedores) {
    const valor = Math.min(deudor.valor,acreedor.valor);
    if (valor>0) { movimientos.push({de:deudor.id,para:acreedor.id,valor}); deudor.valor-=valor; acreedor.valor-=valor; }
  }
  return movimientos;
}

function findResult(a,b) { return datos.partidos.find(p => p.jugadores.includes(a) && p.jugadores.includes(b)); }
function renderGroups() {
  el('group-switch').innerHTML = datos.grupos.map((g,i)=>`<button class="${i===grupoSeleccionado?'active':''}" data-group="${i}" aria-pressed="${i===grupoSeleccionado}">${escapeHTML(g.nombre)}</button>`).join('');
  el('groups').innerHTML = datos.grupos.map((g,gi) => `<div class="panel group-panel" data-current="${gi===grupoSeleccionado}" data-group-panel="${gi}"><div class="panel-head"><h2>${escapeHTML(g.nombre)}</h2><span>${g.jugadores.length} jugadores</span></div><div class="scroll"><table class="group-table"><thead><tr><th>#</th><th class="name">Jugador</th>${g.jugadores.map((id,i)=>`<th title="${escapeHTML(nombre(id))}">${i+1}</th>`).join('')}<th title="Partidos ganados">PG</th></tr></thead><tbody>${g.jugadores.map((id,i)=>`<tr><td>${i+1}</td><td class="name"><strong>${escapeHTML(nombre(id))}</strong></td>${g.jugadores.map(other=>{
    if(id===other) return '<td class="self"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor"/><path d="M5 5c8 1 13 6 14 14M5 19C6 11 11 6 19 5" stroke="currentColor"/></svg></td>';
    const p=findResult(id,other), s=p?.marcador ? (p.jugadores[0]===id?p.marcador:[...p.marcador].reverse()):null;
    return `<td class="${s?(s[0]>s[1]?'win':''):'pending'}"><button class="score" data-a="${escapeHTML(id)}" data-b="${escapeHTML(other)}" aria-label="Editar ${escapeHTML(nombre(id))} contra ${escapeHTML(nombre(other))}">${s?s.join('–'):'—'}</button></td>`;
  }).join('')}<td class="points">${datos.partidos.filter(p=>p.marcador && p.jugadores.includes(id) && p.marcador[p.jugadores.indexOf(id)]>p.marcador[1-p.jugadores.indexOf(id)]).length}</td></tr>`).join('')}</tbody></table></div></div>`).join('');
  document.querySelectorAll('.score').forEach(b=>b.onclick=()=>openScore(b.dataset.a,b.dataset.b));
  document.querySelectorAll('[data-group]').forEach(button=>button.onclick=()=>{
    grupoSeleccionado=Number(button.dataset.group);
    document.querySelectorAll('[data-group]').forEach(b=>{const active=Number(b.dataset.group)===grupoSeleccionado;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('[data-group-panel]').forEach(panel=>panel.dataset.current=String(Number(panel.dataset.groupPanel)===grupoSeleccionado));
  });
  const played=datos.partidos.filter(p=>p.marcador);
  el('match-count').textContent=played.length+' partidos';
  el('summary-played').textContent=played.length;
  el('matches').innerHTML=played.map(p=>`<div class="match"><div class="match-meta"><span>${escapeHTML(fecha(p.fecha))}</span><span class="finished">Finalizado</span></div>${p.jugadores.map((id,i)=>`<div class="match-player ${p.marcador[i]>p.marcador[1-i]?'winner':''}"><span class="match-name"><span class="initial" aria-hidden="true">${escapeHTML(nombre(id).split(' ').map(s=>s[0]).join(''))}</span>${escapeHTML(nombre(id))}</span><strong>${p.marcador[i]}</strong></div>`).join('')}</div>`).join('');
}

function renderReservations() {
  el('reservations').innerHTML=datos.reservas.map((r,i)=>`<div class="reserve"><div class="date"><strong>${escapeHTML(fecha(r.fecha))}</strong><small>${r.canchas} ${r.canchas===1?'cancha':'canchas'} · ${r.horas} ${r.horas===1?'hora':'horas'}</small>${conceptos.filter(c=>r.gastos[c]).map(c=>`<small>${c}: ${money(r.gastos[c].valor)} · Pagó ${r.gastos[c].pagos.map(p=>escapeHTML(nombre(p.jugador))).join(', ')}</small>`).join('')}</div>${r.participantes.length>2?`<span class="reserve-people">${r.participantes.map(id=>escapeHTML(nombre(id))).join(', ')}</span>`:[0,1].map(j=>`<select aria-label="Jugador ${j+1} del ${escapeHTML(fecha(r.fecha))}" data-index="${i}" data-slot="${j}"><option value="">Jugador ${j+1}</option>${datos.jugadores.map(p=>`<option value="${escapeHTML(p.id)}" ${r.participantes[j]===p.id?'selected':''}>${escapeHTML(p.nombre)}</option>`).join('')}</select>`).join('')}</div>`).join('');
  document.querySelectorAll('#reservations select').forEach(s=>s.onchange=()=>{
    const row=s.closest('.reserve'), selects=[...row.querySelectorAll('select')], ids=selects.map(input=>input.value);
    if(ids[0] && ids[0]===ids[1]) { el('reserve-error').textContent='Selecciona dos jugadores diferentes.'; return; }
    // Solo aplicar cuando ambos jugadores están definidos, o cuando se limpia la reserva.
    const r=datos.reservas[Number(s.dataset.index)];
    if(ids.every(Boolean)) r.participantes=ids;
    else r.participantes=[];
    el('reserve-error').textContent=ids.some(Boolean)&&!ids.every(Boolean)?'Falta seleccionar el segundo jugador; la reserva sigue sin repartir.':'';
    renderAccounts();
  });
}
function balanceText(n) {return n===0?'Al día':`${money(Math.abs(n)/100)}<span class="sub">${n>0?'a favor':'pendiente'}</span>`;}
function renderAccounts() {
  const jugadorVisible=jugadorFiltrado||datos.jugadorDestacado;
  const {cuentas,totales}=calcular(datos), destacado=cuentas[jugadorVisible].campo;
  const sinAsignar=Object.values(cuentas).reduce((s,a)=>s+a.campo.sinAsignar+a.caddie.sinAsignar,0);
  el('highlight-label').textContent=nombre(jugadorVisible)+' · saldo de campo';
  el('adrian-balance').textContent=money(Math.abs(destacado.saldo)/100)+(destacado.saldo>=0?' a favor':' pendiente');
  el('adrian-detail').textContent=destacado.sinAsignar?`Incluye ${money(destacado.sinAsignar/100)} de reservas sin asignar`:'Reservas de este jugador repartidas';
  el('field-total').textContent=money(totales.campo/100); el('caddie-total').textContent=money(totales.caddie/100);
  el('balances').innerHTML=datos.jugadores.map(p=>`<tr class="${jugadorFiltrado&&jugadorFiltrado!==p.id?'filtered-out':''}"><td class="name"><strong>${escapeHTML(p.nombre)}</strong></td>${conceptos.map(c=>{const a=cuentas[p.id][c];return `<td class="paid" data-label="Pagó ${c}">${money(a.pagado/100)}</td><td data-label="Saldo ${c}" class="${a.saldo>=0?'positive':'negative'}">${balanceText(a.saldo)}${a.sinAsignar?`<span class="sub unassigned">${money(a.sinAsignar/100)} aún sin repartir</span>`:''}</td>`}).join('')}</tr>`).join('');
  for(const c of conceptos) el(c==='campo'?'field-transfers':'caddie-transfers').innerHTML=transferencias(cuentas,c).filter(t=>!jugadorFiltrado||t.de===jugadorFiltrado||t.para===jugadorFiltrado).map(t=>`<div class="transfer"><span>${escapeHTML(nombre(t.de))} <small>→</small> <strong>${escapeHTML(nombre(t.para))}</strong></span><strong>${money(t.valor/100)}</strong></div>`).join('')||'<p class="note">Sin reembolsos sugeridos para los gastos asignados.</p>';
  el('settlement-note').textContent=(sinAsignar?`Cierre provisional · Hay ${money(sinAsignar/100)} en reservas sin pareja asignada. Estos anticipos aún no se incluyen aquí. `:'Todos los gastos registrados están repartidos. ')+ 'Estos son los pagos sugeridos para quedar al día.';
  el('payment-history').innerHTML=datos.reservas.flatMap(r=>conceptos.flatMap(c=>(r.gastos[c]?.pagos||[]).map(p=>`<tr><td class="name">${escapeHTML(fecha(r.fecha))} · ${escapeHTML(nombre(p.jugador))}</td><td>${c==='campo'?money(p.valor):'—'}</td><td>${c==='caddie'?money(p.valor):'—'}</td></tr>`))).join('');
}
function render() {
  document.title=datos.nombre+' · Torneo y cuentas';
  el('brand-name').textContent=datos.nombre; el('season').textContent='Tenis · '+datos.temporada;
  el('tournament-summary').textContent=`${datos.jugadores.length} jugadores · ${datos.grupos.length} grupos · Partidos a un set`;
  el('summary-players').textContent=datos.jugadores.length;
  const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const siguiente=[...datos.reservas].sort((a,b)=>a.fecha.localeCompare(b.fecha)).find(r=>r.fecha>=hoy);
  el('summary-next').textContent=siguiente?fecha(siguiente.fecha):'Por definir';
  el('player-filter').innerHTML='<option value="">Todos los jugadores</option>'+datos.jugadores.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}</option>`).join('');
  el('player-filter').value=jugadorFiltrado;
  renderGroups(); renderReservations(); renderAccounts();
}
function cargar(d) {validar(d); datos=d; render(); el('data-status').textContent='';}
el('player-filter').onchange=e=>{jugadorFiltrado=e.target.value;renderAccounts();};

document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  ['torneo','cuentas'].forEach(id=>el(id).classList.toggle('hidden',id!==button.dataset.tab));
});
let editing;
function openScore(a,b) {
  const p=findResult(a,b), scores=p?.marcador?(p.jugadores[0]===a?p.marcador:[...p.marcador].reverse()):['',''];
  editing={a,b}; el('player-a').textContent=nombre(a);el('player-b').textContent=nombre(b);
  el('score-a').value=scores[0];el('score-b').value=scores[1];el('match-date').value=p?.fecha||'';el('score-error').textContent='';el('score-dialog').showModal();
}
el('close-dialog').onclick=()=>el('score-dialog').close();
el('score-form').onsubmit=e=>{
  e.preventDefault(); const sa=Number(el('score-a').value),sb=Number(el('score-b').value);
  if(sa===sb){el('score-error').textContent='El set debe tener un ganador.';return;}
  const p=findResult(editing.a,editing.b);if(p)datos.partidos.splice(datos.partidos.indexOf(p),1);
  datos.partidos.push({fecha:el('match-date').value,jugadores:[editing.a,editing.b],marcador:[sa,sb]});
  el('score-dialog').close();renderGroups();
};
function descargarJSON() {
  if(!datos)return;
  // Evitar exportar cambios incompletos o inconsistentes.
  try{validar(datos);}catch(error){el('data-status').textContent=error.message;return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(datos,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='torneo.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('download-year').ondblclick=descargarJSON;
el('download-year').onkeydown=e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();descargarJSON();}
};
async function iniciar() {
  if(location.protocol==='file:') {
    location.replace('http://localhost:8765/propuesta.html');
    return;
  }
  // Reutiliza la precarga del HTML. El servidor controla la vigencia mediante ETag.
  try{const response=await fetch('./torneo.json');if(!response.ok)throw new Error('HTTP '+response.status);cargar(await response.json());}
  catch(error){el('data-status').textContent='No se pudo leer torneo.json: '+error.message;}
}
iniciar();
