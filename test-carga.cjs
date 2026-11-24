const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,name),'utf8');
const html = read('index.html');
const data = JSON.parse(read('torneo.json'));
assert.match(html, /<head>[\s\S]*?<link rel="preload" href="\.\/torneo.json" as="fetch" crossorigin>/);
assert.match(html, /<head>[\s\S]*?<script src="\.\/propuesta.js" defer><\/script>[\s\S]*?<\/head>/);
assert.equal((html.match(/src="\.\/propuesta.js"/g)||[]).length,1);
const elements = {}, calls = [];
const context = vm.createContext({Intl,console,location:{protocol:'https:'},document:{
  getElementById(id) {
    assert(html.includes(`id="${id}"`),`Falta ${id}`);
    return elements[id] ||= {innerHTML:'',textContent:'',classList:{toggle(){}}};
  },querySelectorAll:()=>[]
},fetch:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>data};
}});
vm.runInContext(read('propuesta.js'),context);
setImmediate(()=>{
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'./torneo.json');
  assert.equal(calls[0].options,undefined);
  assert.equal(elements['data-status'].textContent,'');
  assert.equal(elements['summary-players'].textContent,data.jugadores.length);
  assert(elements.matches.innerHTML.includes('Finalizado'));
  console.log('OK: precarga temprana, JavaScript en paralelo, una petición JSON y render con los datos actuales.');
});
