
(function(){
  var CHAVE = "gastos_v1";
  var gastos = [];
  var periodo = "mes";
  var apagado = null, toastTimer = null;
  var catFiltro = "";

  // ordem importa: a primeira categoria que combinar vence
  var CATEGORIAS = [
    {nome:"Mercado", p:["mercado","supermercado","atacadao","atacarejo","feira","hortifruti","acougue","arroz","feijao","macarrao","carne","frango","leite","ovo","fruta","verdura","legume","sabao","detergente","amaciante","papel higienico","shampoo","desodorante"]},
    {nome:"Contas", p:["aluguel","luz","energia","internet","condominio","iptu","boleto","fatura","telefone","cartao","parcela","gas","conta de agua"]},
    {nome:"Transporte", p:["gasolina","combustivel","etanol","alcool","diesel","uber","99","onibus","passagem","metro","estacionamento","pedagio","oleo","mecanico","pneu","moto","taxi","lavagem"]},
    {nome:"Saúde", p:["farmacia","remedio","medico","consulta","dentista","exame","vacina","hospital","dipirona"]},
    {nome:"Lazer", p:["cinema","jogo","game","steam","netflix","spotify","show","bar","viagem","festa","ingresso","balada"]},
    {nome:"Alimentação", p:["pao","paes","pao de queijo","salgado","chiclete","bala","lanche","cafe","refri","refrigerante","pizza","hamburguer","hamburger","almoco","janta","jantar","restaurante","doce","sorvete","agua","suco","ifood","padaria","comida","marmita","coxinha","pastel","bolo","chocolate","cerveja","biscoito","bolacha","salada","acai","esfiha","sanduiche","hot dog","batata"]}
  ];
  var OUTROS = "Outros";
  var NOMES = CATEGORIAS.map(function(c){ return c.nome; }).concat([OUTROS]);
  CATEGORIAS.forEach(function(c){ c.re = new RegExp("(^| )(" + c.p.join("|") + ")(s|es)?( |$)"); });

  function categorizar(desc){
    var t = semAcento(desc).replace(/[^a-z0-9]+/g," ").trim();
    var regras = cfg.regras || [], nomes = nomesCats();
    for(var k=0;k<regras.length;k++){
      if(nomes.indexOf(regras[k].cat) !== -1 && new RegExp("(^| )" + regras[k].palavra + "(s|es)?( |$)").test(t)) return regras[k].cat;
    }
    for(var i=0;i<CATEGORIAS.length;i++){ if(CATEGORIAS[i].re.test(t)) return CATEGORIAS[i].nome; }
    return OUTROS;
  }
  function catDe(g){ return g.cat || categorizar(g.desc); }

  function desenharCats(base){
    var somas = {};
    base.forEach(function(g){ var c = catDe(g); somas[c] = (somas[c]||0) + g.valor; });
    var box = el("cats"); box.innerHTML = "";
    function chip(nome, valor, ativo, c){
      var b = document.createElement("button");
      b.setAttribute("data-c", c);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
      var n = document.createElement("span"); n.textContent = nome;
      var v = document.createElement("b"); v.className = "num"; v.textContent = brl(valor);
      b.appendChild(n); b.appendChild(v); box.appendChild(b);
    }
    chip("Todas", soma(base), !catFiltro, "");
    nomesCats().forEach(function(n){ if(somas[n] || catFiltro === n) chip(n, somas[n]||0, catFiltro === n, n); });
  }

  function carregar(){
    try { var s = localStorage.getItem(CHAVE); gastos = s ? JSON.parse(s) : []; }
    catch(e){ gastos = []; }
    if(!Array.isArray(gastos)) gastos = [];
  }
  function salvarTudo(){
    try { localStorage.setItem(CHAVE, JSON.stringify(gastos)); return true; }
    catch(e){ return false; }
  }

  function brl(n){ return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
  function semAcento(s){ return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }

  // converte "1.500,50", "12,5", "3.5" em número
  function paraNumero(t){
    if(/,/.test(t)){ t = t.replace(/\./g,"").replace(",","."); }
    else if(/^\d{1,3}(\.\d{3})+$/.test(t)){ t = t.replace(/\./g,""); }
    return parseFloat(t);
  }

  var NUM = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/;
  var MOEDA = /(r\$|reais|real|conto|contos)/gi;

  function interpretar(texto){
    var ok = [], falhas = [];
    texto.split(/[,;\n]+/).forEach(function(pedaco){
      var p = pedaco.trim();
      if(!p) return;
      var m = p.match(NUM);
      if(!m){ falhas.push(p); return; }
      var valor = paraNumero(m[1]);
      if(!isFinite(valor) || valor <= 0){ falhas.push(p); return; }
      var desc = p.replace(m[0], " ").replace(MOEDA, " ").replace(/\s+/g," ").trim();
      desc = desc.replace(/^(de|com|em|no|na|pra|para)\s+/i,"");
      if(!desc) desc = "sem descrição";
      ok.push({valor:valor, desc:cfg.corrigir ? corrigirTexto(desc) : desc, cat:categorizar(desc)});
    });
    return {ok:ok, falhas:falhas};
  }

  function chaveDia(d){ return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  function inicioDoDia(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function inicioDoCiclo(ref){
    var dia = (cfg && cfg.diaMes) || 1;
    var ini = new Date(ref.getFullYear(), ref.getMonth(), dia);
    if(ref < ini) ini = new Date(ref.getFullYear(), ref.getMonth() - 1, dia);
    return ini;
  }

  function dentro(g, p){
    var d = new Date(g.data), agora = new Date();
    if(p === "tudo") return true;
    if(p === "hoje") return chaveDia(d) === chaveDia(agora);
    if(p === "semana"){
      var ini = inicioDoDia(agora); ini.setDate(ini.getDate()-6);
      return d >= ini;
    }
    if(p === "mes") return d >= inicioDoCiclo(agora);
    return true;
  }
  function soma(arr){ return arr.reduce(function(a,g){ return a+g.valor; },0); }

  function dataBonita(iso){
    var d = new Date(iso), h = new Date();
    var hora = d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    if(chaveDia(d) === chaveDia(h)) return "hoje, "+hora;
    return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+", "+hora;
  }

  function el(id){ return document.getElementById(id); }
  var ROTULOS = {hoje:"Total de hoje", semana:"Total dos últimos 7 dias", mes:"Total deste mês", tudo:"Total geral"};

  function naTelaInicio(){ return el("tela-inicio").classList.contains("ativa"); }
  function desenhar(){
    if(!naTelaInicio()) return;
    animarValor(el("rHoje"), soma(gastos.filter(function(g){return dentro(g,"hoje");})));
    animarValor(el("rSemana"), soma(gastos.filter(function(g){return dentro(g,"semana");})));
    animarValor(el("rMes"), soma(gastos.filter(function(g){return dentro(g,"mes");})));
    renderMeta(); renderLembrete();

    var termo = semAcento(el("busca").value.trim());
    var base = gastos
      .filter(function(g){ return dentro(g, periodo); })
      .filter(function(g){ return !termo || semAcento(g.desc).indexOf(termo) !== -1; })
      .sort(function(a,b){ return new Date(b.data) - new Date(a.data); });
    desenharCats(base);
    var lista = catFiltro ? base.filter(function(g){ return catDe(g) === catFiltro; }) : base;

    el("totalRot").textContent = ROTULOS[periodo] + (catFiltro ? " em " + catFiltro : "") + (termo ? ' com "'+el("busca").value.trim()+'"' : "");
    animarValor(el("total"), soma(lista));

    var ul = el("lista");
    ul.innerHTML = "";
    if(!lista.length){
      var v = document.createElement("div");
      v.className = "vazio";
      v.textContent = gastos.length ? "Nenhum gasto encontrado nesse filtro." : "Nenhum gasto ainda. Escreva acima e toque em Salvar gastos.";
      ul.appendChild(v);
      return;
    }
    lista.forEach(function(g){
      var li = document.createElement("li");
      li.setAttribute("data-id", g.id);
      if(novos[g.id] || animarLista){
        li.classList.add("entra");
        li.style.animationDelay = (Math.min(nEntrada++, 8) * (animarLista ? 40 : 70)) + "ms";
        delete novos[g.id];
      }
      var d = document.createElement("div"); d.className = "desc";
      d.textContent = g.desc;
      var s = document.createElement("small"); s.textContent = dataBonita(g.data); d.appendChild(s);
      var sel = document.createElement("select");
      sel.setAttribute("aria-label","Categoria de "+g.desc);
      nomesCats().forEach(function(n){
        var o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o);
      });
      sel.value = catDe(g);
      sel.addEventListener("change", function(){ g.cat = sel.value; salvarTudo(); desenhar(); });
      d.appendChild(sel);
      var val = document.createElement("span"); val.className = "val num"; val.textContent = brl(g.valor);
      var b = document.createElement("button"); b.textContent = "Apagar"; b.setAttribute("aria-label","Apagar "+g.desc);
      b.addEventListener("click", function(){
        if(b.getAttribute("data-conf") === "1"){ apagar(g.id); return; }
        b.setAttribute("data-conf", "1"); b.textContent = "Certeza?"; b.classList.add("perigo");
        setTimeout(function(){
          if(b.isConnected){ b.removeAttribute("data-conf"); b.textContent = "Apagar"; b.classList.remove("perigo"); }
        }, 4000);
      });
      li.appendChild(d); li.appendChild(val); li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function aviso(msg, tipo){
    var a = el("aviso"); a.textContent = msg; a.className = "aviso " + (tipo||"");
    void a.offsetWidth; a.classList.add("surge");
    clearTimeout(a._t);
    a._t = setTimeout(function(){ a.classList.add("some"); }, 4500);
  }

  function adicionar(){
    var r = interpretar(el("texto").value);
    if(!r.ok.length){
      aviso(r.falhas.length ? 'Não achei valor em: "'+r.falhas.join('", "')+'". Escreva o número, ex: 5 chiclete.' : "Escreva pelo menos um gasto.", "erro");
      return;
    }
    var agora = new Date().toISOString();
    nEntrada = 0;
    var mesAntes = soma(gastos.filter(function(g){ return dentro(g, "mes"); }));
    r.ok.forEach(function(x,i){
      var novoId = Date.now()+"-"+i;
      novos[novoId] = true;
      gastos.push({id: novoId, valor:x.valor, desc:x.desc, cat:x.cat, data:agora});
    });
    var gravou = salvarTudo();
    var total = soma(r.ok);
    var msg = r.ok.length+" gasto"+(r.ok.length>1?"s":"")+" salvo"+(r.ok.length>1?"s":"")+": "+brl(total)+".";
    if(r.falhas.length) msg += ' Não entendi: "'+r.falhas.join('", "')+'".';
    var extraMeta = alertaMeta(mesAntes);
    if(extraMeta) msg += " " + extraMeta;
    if(!gravou) msg += " Atenção: não consegui gravar no aparelho, os dados somem ao fechar.";
    aviso(msg, (r.falhas.length || !gravou || extraMeta) ? "erro" : "ok");
    el("texto").value = "";
    desenhar();
  }

  function mostrarToast(msg){
    el("toastMsg").textContent = msg;
    el("toast").classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el("toast").classList.remove("on"); apagado = null; }, 6000);
  }
  var novos = {}, nEntrada = 0, animarLista = false;
  function reduzMovimento(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function animarValor(alvo, novo){
    var antigo = parseFloat(alvo.dataset.v);
    alvo.dataset.v = novo;
    if(isNaN(antigo) || antigo === novo || reduzMovimento()){ alvo.textContent = brl(novo); return; }
    alvo.classList.remove("bump"); void alvo.offsetWidth; alvo.classList.add("bump");
    if(alvo._anim) cancelAnimationFrame(alvo._anim);
    var ini = null, dur = 450;
    function passo(t){
      if(ini === null) ini = t;
      var p = Math.min(1, (t - ini) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      alvo.textContent = brl(antigo + (novo - antigo) * e);
      if(p < 1){ alvo._anim = requestAnimationFrame(passo); }
      else { alvo.textContent = brl(novo); alvo._anim = null; }
    }
    alvo._anim = requestAnimationFrame(passo);
  }
  function apagar(id){
    var item = document.querySelector('li[data-id="' + id + '"]');
    if(item && !reduzMovimento()){
      item.classList.add("sai");
      setTimeout(function(){ removerGasto(id); }, 220);
    } else { removerGasto(id); }
  }
  function removerGasto(id){
    var i = gastos.findIndex(function(g){ return g.id === id; });
    if(i < 0) return;
    apagado = gastos.splice(i,1)[0];
    salvarTudo(); desenhar();
    mostrarToast("Gasto apagado.");
  }
  el("desfazer").addEventListener("click", function(){
    if(apagado){ novos[apagado.id] = true; nEntrada = 0; gastos.push(apagado); apagado = null; salvarTudo(); desenhar(); }
    el("toast").classList.remove("on");
  });

  el("salvar").addEventListener("click", adicionar);
  el("cats").addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    catFiltro = b.getAttribute("data-c");
    nEntrada = 0; animarLista = true; desenhar(); animarLista = false;
  });
  el("busca").addEventListener("input", desenhar);
  el("filtros").addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    periodo = b.getAttribute("data-p");
    Array.prototype.forEach.call(el("filtros").children, function(x){
      x.setAttribute("aria-pressed", x === b ? "true" : "false");
    });
    nEntrada = 0; animarLista = true; desenhar(); animarLista = false;
  });

  // ---------- configurações: correção de texto e tema ----------
  var CFG_CHAVE = "gastos_cfg_v1";
  var cfg = {corrigir:true, modo:"escuro", tema:null, nome:"", catsExtra:[], regras:[], meta:0, diaMes:1, ultimoBackup:"", lembreteAte:0}; // tema null = padrão (segue claro/escuro do celular)
  var HEX = /^#[0-9a-f]{6}$/i;

  function carregarCfg(){
    try{
      var s = localStorage.getItem(CFG_CHAVE);
      if(!s) return;
      var c = JSON.parse(s);
      if(!c || typeof c !== "object") return;
      cfg.corrigir = c.corrigir !== false;
      cfg.nome = typeof c.nome === "string" ? c.nome.slice(0,30) : "";
      cfg.catsExtra = Array.isArray(c.catsExtra) ? c.catsExtra.filter(function(x){ return typeof x === "string" && x.length > 0 && x.length <= 20; }).slice(0,12) : [];
      cfg.regras = Array.isArray(c.regras) ? c.regras.filter(function(r){ return r && typeof r.palavra === "string" && /^[a-z0-9 ]{1,30}$/.test(r.palavra) && typeof r.cat === "string"; }).slice(0,60) : [];
      cfg.meta = (typeof c.meta === "number" && c.meta > 0) ? c.meta : 0;
      cfg.diaMes = (typeof c.diaMes === "number" && c.diaMes >= 1 && c.diaMes <= 28) ? Math.floor(c.diaMes) : 1;
      cfg.ultimoBackup = typeof c.ultimoBackup === "string" ? c.ultimoBackup : "";
      cfg.lembreteAte = typeof c.lembreteAte === "number" ? c.lembreteAte : 0;
      cfg.modo = (c.modo === "claro" || c.modo === "personalizado") ? c.modo : (c.tema ? "personalizado" : "escuro");
      var t = c.tema;
      cfg.tema = (t && HEX.test(t.pri) && HEX.test(t.sec) && HEX.test(t.ter)) ? {pri:t.pri, sec:t.sec, ter:t.ter} : null;
    }catch(e){}
  }
  function salvarCfg(){ try{ localStorage.setItem(CFG_CHAVE, JSON.stringify(cfg)); }catch(e){} }

  var DICIONARIO = {
    pao:"pão",paes:"pães",acai:"açaí",agua:"água",cafe:"café",cha:"chá",feijao:"feijão",macarrao:"macarrão",
    acougue:"açougue",atacadao:"atacadão",hortifruti:"hortifrúti",acucar:"açúcar",linguica:"linguiça",salmao:"salmão",
    maca:"maçã",limao:"limão",mamao:"mamão",melao:"melão",pimentao:"pimentão",sabao:"sabão",carvao:"carvão",
    almoco:"almoço",refeicao:"refeição",hamburguer:"hambúrguer",hamburger:"hambúrguer",sanduiche:"sanduíche",manha:"manhã",
    saude:"saúde",farmacia:"farmácia",remedio:"remédio",medico:"médico",veterinario:"veterinário",racao:"ração",
    onibus:"ônibus",metro:"metrô",taxi:"táxi",pedagio:"pedágio",oleo:"óleo",mecanico:"mecânico",pecas:"peças",revisao:"revisão",
    gas:"gás",botijao:"botijão",alcool:"álcool",combustivel:"combustível",higienico:"higiênico",
    cartao:"cartão",condominio:"condomínio",credito:"crédito",debito:"débito",emprestimo:"empréstimo",
    inscricao:"inscrição",matricula:"matrícula",aniversario:"aniversário",serie:"série",musica:"música",lapis:"lápis",
    tenis:"tênis",calca:"calça",sandalia:"sandália",oculos:"óculos",relogio:"relógio",bone:"boné",
    voce:"você",nao:"não",mae:"mãe",
    ifood:"iFood",uber:"Uber",netflix:"Netflix",spotify:"Spotify",steam:"Steam",pix:"Pix",amazon:"Amazon",shopee:"Shopee",
    iptu:"IPTU",ipva:"IPVA"
  };

  function corrigirTexto(t){
    var out = t.replace(/[\p{L}\p{N}]+/gu, function(w){
      var k = semAcento(w);
      if(Object.prototype.hasOwnProperty.call(DICIONARIO, k)) return DICIONARIO[k];
      return (w.length > 1 && w === w.toUpperCase()) ? w.toLowerCase() : w;
    });
    out = out.replace(/\s+/g," ").trim();
    if(out && !/^iFood/.test(out)) out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }

  // ---------- tema ----------
  function rgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  function hex(a){ return "#" + a.map(function(v){ v = Math.max(0, Math.min(255, Math.round(v))); return (v<16 ? "0" : "") + v.toString(16); }).join(""); }
  function mistura(a, b, t){ var x = rgb(a), y = rgb(b); return hex([x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t]); }
  function lum(h){
    var c = rgb(h).map(function(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
  }
  function textoSobre(h){ return lum(h) > 0.179 ? "#14213a" : "#ffffff"; }

  var VARS = ["--bg","--card","--ink","--muted","--line","--pri","--on-pri","--accent","--accent-ink","--danger","--ok"];
  function aplicarTema(){
    var root = document.documentElement, r = root.style;
    VARS.forEach(function(v){ r.removeProperty(v); });
    var meta = document.querySelector('meta[name="theme-color"]');
    var t = cfg.tema;
    if(cfg.modo !== "personalizado"){
      root.setAttribute("data-modo", cfg.modo === "claro" ? "claro" : "escuro");
      if(meta) meta.setAttribute("content", cfg.modo === "claro" ? "#eef1f6" : "#0f1830");
      return;
    }
    root.setAttribute("data-modo", "personalizado");
    if(!t) t = {pri:"#0b5fa5", sec:"#37c6c0", ter:"#e8f3fb"};
    var claro = lum(t.ter) > 0.179;
    var ink = claro ? "#14213a" : "#eef1f8";
    r.setProperty("--bg", t.ter);
    r.setProperty("--card", claro ? mistura(t.ter, "#ffffff", 0.65) : mistura(t.ter, "#ffffff", 0.08));
    r.setProperty("--ink", ink);
    r.setProperty("--muted", mistura(ink, t.ter, 0.4));
    r.setProperty("--line", mistura(t.ter, ink, 0.18));
    r.setProperty("--pri", t.pri);
    r.setProperty("--on-pri", textoSobre(t.pri));
    r.setProperty("--accent", t.sec);
    r.setProperty("--accent-ink", textoSobre(t.sec));
    r.setProperty("--danger", claro ? "#b3261e" : "#ff8a80");
    r.setProperty("--ok", claro ? "#1f7a4d" : "#6fd3a0");
    if(meta) meta.setAttribute("content", t.pri);
  }

  var PREDEF = [
    
    {nome:"Oceano", tema:{pri:"#0b5fa5", sec:"#37c6c0", ter:"#e8f3fb"}},
    {nome:"Floresta", tema:{pri:"#1f6b45", sec:"#e0a526", ter:"#eaf4ec"}},
    {nome:"Pôr do sol", tema:{pri:"#b5391f", sec:"#f4a259", ter:"#fbefe6"}},
    {nome:"Uva", tema:{pri:"#5b2a9b", sec:"#f06fa8", ter:"#f2ecfa"}},
    {nome:"Noite", tema:{pri:"#7aa2ff", sec:"#ffcf5c", ter:"#10172b"}}
  ];

  function desenharPredef(){
    var box = el("predef"); box.innerHTML = "";
    PREDEF.forEach(function(p, i){
      var b = document.createElement("button");
      var ativo = p.tema ? (cfg.tema && cfg.tema.pri === p.tema.pri && cfg.tema.sec === p.tema.sec && cfg.tema.ter === p.tema.ter) : !cfg.tema;
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
      b.setAttribute("data-i", i);
      if(p.tema){
        var a = document.createElement("span"); a.className = "amostra";
        [p.tema.pri, p.tema.sec, p.tema.ter].forEach(function(c){
          var d = document.createElement("i"); d.style.background = c; a.appendChild(d);
        });
        b.appendChild(a);
      }
      var n = document.createElement("span"); n.textContent = p.nome; b.appendChild(n);
      box.appendChild(b);
    });
  }
  function sincronizarCores(){
    var t = cfg.tema || {pri:"#0b5fa5", sec:"#37c6c0", ter:"#e8f3fb"};
    el("corPri").value = t.pri; el("corSec").value = t.sec; el("corTer").value = t.ter;
  }

  el("predef").addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    var p = PREDEF[parseInt(b.getAttribute("data-i"), 10)];
    cfg.tema = p.tema ? {pri:p.tema.pri, sec:p.tema.sec, ter:p.tema.ter} : null;
    salvarCfg(); aplicarTema(); desenharPredef(); sincronizarCores();
  });
  ["corPri","corSec","corTer"].forEach(function(id){
    el(id).addEventListener("input", function(){
      cfg.tema = {pri:el("corPri").value, sec:el("corSec").value, ter:el("corTer").value};
      salvarCfg(); aplicarTema(); desenharPredef();
    });
  });
  function desenharModos(){
    var box = el("modos"); box.innerHTML = "";
    [["escuro","Padrão (escuro)"],["claro","Claro"],["personalizado","Personalizado"]].forEach(function(m){
      var b = document.createElement("button");
      b.setAttribute("data-m", m[0]);
      b.setAttribute("aria-pressed", cfg.modo === m[0] ? "true" : "false");
      b.textContent = m[1];
      box.appendChild(b);
    });
    el("personalizado").hidden = cfg.modo !== "personalizado";
  }
  el("modos").addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    cfg.modo = b.getAttribute("data-m");
    if(cfg.modo === "personalizado" && !cfg.tema) cfg.tema = {pri:"#0b5fa5", sec:"#37c6c0", ter:"#e8f3fb"};
    salvarCfg(); aplicarTema(); desenharModos(); desenharPredef(); sincronizarCores();
  });
  // Enter do teclado salva direto (Shift+Enter não)
  function enviarComEnter(e){
    e.preventDefault();
    if(el("texto").value.trim()) adicionar();
  }
  el("texto").addEventListener("keydown", function(e){
    if(e.key === "Enter" && !e.shiftKey && !e.isComposing) enviarComEnter(e);
  });
  el("texto").addEventListener("beforeinput", function(e){
    if(e.inputType === "insertLineBreak") enviarComEnter(e);
  });

  // troca de telas pela barra inferior
  function mostrarTela(nome){
    var ORDEM = ["inicio","perfil","config"];
    var jaAtiva = el("tela-"+nome).classList.contains("ativa");
    var antes = ORDEM.findIndex(function(n){ return el("tela-"+n).classList.contains("ativa"); });
    ORDEM.forEach(function(n){
      var t = el("tela-"+n), b = el("nav").querySelector('[data-tela="'+n+'"]');
      var ativo = n === nome;
      t.classList.toggle("ativa", ativo);
      if(b) b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
    if(nome === "inicio") desenhar(); else if(nome === "perfil") renderPerfil(); else renderConfig();
    if(!jaAtiva){
      var nova = el("tela-"+nome);
      nova.classList.remove("slide-dir", "slide-esq"); void nova.offsetWidth;
      nova.classList.add(ORDEM.indexOf(nome) > antes ? "slide-dir" : "slide-esq");
    }
    window.scrollTo(0,0);
  }
  el("nav").addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    if(!b.hasAttribute("data-tela")) return;
    mostrarTela(b.getAttribute("data-tela"));
  });
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ document.documentElement.classList.add("pronto"); }); });
  el("optCorrigir").addEventListener("change", function(){
    cfg.corrigir = el("optCorrigir").checked; salvarCfg();
  });
  el("btnCriarConta").addEventListener("click", function(){
    avisoPerfil("Em breve: criar conta para guardar seus gastos na nuvem.");
  });

  // ---------- perfil ----------
  function avisoPerfil(msg){
    var a = el("avisoPerfil"); a.textContent = msg;
    a.classList.remove("surge"); void a.offsetWidth; a.classList.add("surge");
  }
  function inicialDoNome(){ var n = (cfg.nome || "").trim(); return n ? n.charAt(0).toUpperCase() : "C"; }
  function renderPerfil(){
    el("nomeUsuario").value = cfg.nome || "";
    el("avatar").textContent = inicialDoNome();
    var total = soma(gastos);
    el("pTotal").textContent = brl(total);
    el("pQtd").textContent = String(gastos.length);
    var dias = 1;
    if(gastos.length){
      var primeiro = Math.min.apply(null, gastos.map(function(g){ return new Date(g.data).getTime(); }));
      dias = Math.max(1, Math.ceil((Date.now() - primeiro) / 86400000));
    }
    el("pMedia").textContent = brl(gastos.length ? total / dias : 0);
    var maior = gastos.reduce(function(m, g){ return (!m || g.valor > m.valor) ? g : m; }, null);
    el("pMaior").textContent = maior ? brl(maior.valor) + " · " + maior.desc : "–";

    var mes = gastos.filter(function(g){ return dentro(g, "mes"); });
    var somas = {};
    mes.forEach(function(g){ var c = catDe(g); somas[c] = (somas[c] || 0) + g.valor; });
    var totalMes = soma(mes);
    var box = el("barras"); box.innerHTML = "";
    var nomes = Object.keys(somas).sort(function(a, b){ return somas[b] - somas[a]; });
    if(!nomes.length){
      var vazio = document.createElement("p"); vazio.textContent = "Nenhum gasto este mês ainda."; box.appendChild(vazio);
      return;
    }
    nomes.forEach(function(n){
      var pct = somas[n] / totalMes * 100;
      var linha = document.createElement("div"); linha.className = "b";
      var t = document.createElement("div"); t.className = "t";
      var a = document.createElement("span"); a.textContent = n;
      var v = document.createElement("span"); v.textContent = brl(somas[n]) + " · " + Math.round(pct) + "%";
      t.appendChild(a); t.appendChild(v);
      var f = document.createElement("div"); f.className = "f";
      var barra = document.createElement("i"); f.appendChild(barra);
      linha.appendChild(t); linha.appendChild(f); box.appendChild(linha);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ barra.style.width = pct + "%"; }); });
    });
  }
  el("nomeUsuario").addEventListener("input", function(){
    cfg.nome = el("nomeUsuario").value.slice(0, 30);
    salvarCfg();
    el("avatar").textContent = inicialDoNome();
  });
  el("btnExportar").addEventListener("click", function(){
    var dados = {app:"contei", versao:1, exportadoEm:new Date().toISOString(), nome:cfg.nome || "", categorias:cfg.catsExtra, regras:cfg.regras, gastos:gastos};
    var blob = new Blob([JSON.stringify(dados, null, 2)], {type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "contei-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    cfg.ultimoBackup = new Date().toISOString(); salvarCfg(); renderConfig();
    avisoConfig("Backup gerado. Guarde o arquivo num lugar seguro.");
  });
  el("btnImportar").addEventListener("click", function(){ el("arqImportar").click(); });
  el("arqImportar").addEventListener("change", function(){
    var arq = el("arqImportar").files[0]; if(!arq) return;
    var leitor = new FileReader();
    leitor.onload = function(){
      try{
        var d = JSON.parse(leitor.result);
        var lista = Array.isArray(d) ? d : d.gastos;
        if(!Array.isArray(lista)) throw new Error("formato");
        var ids = {}; gastos.forEach(function(g){ ids[g.id] = true; });
        var qtd = 0;
        lista.forEach(function(g){
          if(!g || typeof g.valor !== "number" || !isFinite(g.valor) || g.valor <= 0) return;
          if(typeof g.desc !== "string" || !g.data || isNaN(new Date(g.data).getTime())) return;
          var id = String(g.id || (Date.now() + "-" + qtd));
          if(ids[id]) return;
          ids[id] = true;
          var catImp = typeof g.cat === "string" ? g.cat : undefined;
          if(catImp){ garantirCategoria(catImp); if(nomesCats().indexOf(catImp) === -1) catImp = undefined; }
          gastos.push({id:id, valor:g.valor, desc:g.desc.slice(0, 120), cat:catImp, data:g.data});
          qtd++;
        });
        if(Array.isArray(d.categorias)) d.categorias.forEach(garantirCategoria);
        if(Array.isArray(d.regras)) d.regras.forEach(function(r){
          if(!r || typeof r.palavra !== "string" || typeof r.cat !== "string") return;
          var pal = normPalavra(r.palavra);
          if(!pal || cfg.regras.length >= 60 || nomesCats().indexOf(r.cat) === -1) return;
          if(cfg.regras.some(function(x){ return x.palavra === pal; })) return;
          cfg.regras.push({palavra:pal, cat:r.cat});
        });
        salvarCfg(); salvarTudo(); renderConfig();
        avisoConfig(qtd + (qtd === 1 ? " gasto importado." : " gastos importados."));
      }catch(e){ avisoConfig("Não consegui ler esse arquivo. Use um backup gerado pelo Contei."); }
      el("arqImportar").value = "";
    };
    leitor.readAsText(arq);
  });

  // ---------- configurações (página) ----------
  function nomesCats(){ return CATEGORIAS.map(function(c){ return c.nome; }).concat(cfg.catsExtra, [OUTROS]); }
  function normPalavra(s){ return semAcento(s).replace(/[^a-z0-9]+/g, " ").trim(); }
  function avisoConfig(msg){
    var a = el("avisoConfig"); a.textContent = msg;
    a.classList.remove("surge"); void a.offsetWidth; a.classList.add("surge");
  }
  function garantirCategoria(n){
    if(typeof n !== "string") return;
    n = n.trim();
    if(!n || n.length > 20 || cfg.catsExtra.length >= 12) return;
    if(nomesCats().indexOf(n) !== -1) return;
    cfg.catsExtra.push(n);
  }
  function montarDias(){
    var s = el("diaMes"); s.innerHTML = "";
    for(var i = 1; i <= 28; i++){ var o = document.createElement("option"); o.value = String(i); o.textContent = "Dia " + i; s.appendChild(o); }
  }
  function itemCfg(texto, rotuloBotao, aoClicar, ariaBotao){
    var linha = document.createElement("div"); linha.className = "item-cfg";
    var s = document.createElement("span"); s.textContent = texto;
    var b = document.createElement("button"); b.textContent = rotuloBotao; b.setAttribute("aria-label", ariaBotao);
    b.addEventListener("click", aoClicar);
    linha.appendChild(s); linha.appendChild(b);
    return linha;
  }
  function renderConfig(){
    el("metaInput").value = cfg.meta ? String(cfg.meta).replace(".", ",") : "";
    el("diaMes").value = String(cfg.diaMes);
    var box = el("listaCats"); box.innerHTML = "";
    if(!cfg.catsExtra.length){ var p = document.createElement("p"); p.textContent = "Você ainda não criou categorias."; box.appendChild(p); }
    cfg.catsExtra.forEach(function(nome){
      box.appendChild(itemCfg(nome, "Remover", function(){ removerCategoria(nome); }, "Remover categoria " + nome));
    });
    var sel = el("regraCat"), atual = sel.value; sel.innerHTML = "";
    nomesCats().filter(function(n){ return n !== OUTROS; }).forEach(function(n){
      var o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o);
    });
    if(atual) sel.value = atual;
    if(!sel.value) sel.selectedIndex = 0;
    var rb = el("listaRegras"); rb.innerHTML = "";
    if(!cfg.regras.length){ var q = document.createElement("p"); q.textContent = "Nenhuma palavra ensinada ainda."; rb.appendChild(q); }
    cfg.regras.forEach(function(r){
      rb.appendChild(itemCfg(r.palavra + " → " + r.cat, "Remover", function(){
        cfg.regras = cfg.regras.filter(function(x){ return x !== r; });
        salvarCfg(); renderConfig();
      }, "Remover palavra " + r.palavra));
    });
    el("ultimoBackup").textContent = cfg.ultimoBackup ? "Último backup: " + new Date(cfg.ultimoBackup).toLocaleDateString("pt-BR") + "." : "Você ainda não fez backup.";
  }
  function removerCategoria(nome){
    cfg.catsExtra = cfg.catsExtra.filter(function(n){ return n !== nome; });
    cfg.regras = cfg.regras.filter(function(r){ return r.cat !== nome; });
    gastos.forEach(function(g){ if(g.cat === nome) g.cat = categorizar(g.desc); });
    salvarCfg(); salvarTudo(); renderConfig();
    avisoConfig('Categoria "' + nome + '" removida. Os gastos dela foram reclassificados.');
  }
  el("btnAddCat").addEventListener("click", function(){
    var nome = el("novaCat").value.trim().replace(/\s+/g, " ");
    if(!nome){ avisoConfig("Escreva o nome da categoria."); return; }
    if(nome.length > 20){ avisoConfig("Use até 20 letras no nome."); return; }
    var existe = nomesCats().some(function(n){ return semAcento(n) === semAcento(nome); });
    if(existe){ avisoConfig("Essa categoria já existe."); return; }
    if(cfg.catsExtra.length >= 12){ avisoConfig("Limite de 12 categorias próprias."); return; }
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    cfg.catsExtra.push(nome); salvarCfg();
    el("novaCat").value = ""; renderConfig();
    avisoConfig('Categoria "' + nome + '" criada. Agora ensine palavras pra ela.');
  });
  el("btnAddRegra").addEventListener("click", function(){
    var palavra = normPalavra(el("regraPalavra").value), cat = el("regraCat").value;
    if(!palavra){ avisoConfig("Escreva a palavra."); return; }
    if(!cat){ avisoConfig("Escolha a categoria."); return; }
    if(palavra.length > 30){ avisoConfig("Use até 30 letras na palavra."); return; }
    if(cfg.regras.length >= 60){ avisoConfig("Limite de palavras ensinadas atingido."); return; }
    cfg.regras = cfg.regras.filter(function(r){ return r.palavra !== palavra; });
    cfg.regras.push({palavra:palavra, cat:cat});
    var re = new RegExp("(^| )" + palavra + "(s|es)?( |$)"), qtd = 0;
    gastos.forEach(function(g){
      if(re.test(normPalavra(g.desc)) && g.cat !== cat){ g.cat = cat; qtd++; }
    });
    salvarCfg(); salvarTudo();
    el("regraPalavra").value = ""; renderConfig();
    avisoConfig('Pronto: "' + palavra + '" agora vai pra ' + cat + (qtd ? ". " + qtd + (qtd === 1 ? " gasto antigo foi atualizado." : " gastos antigos foram atualizados.") : "."));
  });
  el("btnSalvarMeta").addEventListener("click", function(){
    var txt = el("metaInput").value.trim();
    if(!txt){ cfg.meta = 0; salvarCfg(); renderMeta(); avisoConfig("Meta removida."); return; }
    var v = paraNumero(txt.replace(/[^0-9.,]/g, ""));
    if(!isFinite(v) || v <= 0){ avisoConfig("Escreva um valor válido, ex: 1500."); return; }
    cfg.meta = v; salvarCfg(); renderMeta();
    avisoConfig("Meta do mês salva: " + brl(v) + ".");
  });
  el("diaMes").addEventListener("change", function(){
    cfg.diaMes = parseInt(el("diaMes").value, 10) || 1;
    salvarCfg(); renderMeta();
    avisoConfig("Agora o mês começa no dia " + cfg.diaMes + ".");
  });
  el("btnApagarTudo").addEventListener("click", function(){
    var b = el("btnApagarTudo");
    function normal(){ b.removeAttribute("data-conf"); b.textContent = "Apagar todos os gastos"; b.classList.remove("perigo"); }
    if(b.getAttribute("data-conf") === "1"){
      gastos = []; apagado = null; salvarTudo(); normal();
      avisoConfig("Todos os gastos foram apagados.");
      return;
    }
    b.setAttribute("data-conf", "1"); b.textContent = "Certeza? Toque de novo"; b.classList.add("perigo");
    setTimeout(function(){ if(b.getAttribute("data-conf") === "1") normal(); }, 4000);
  });
  function renderMeta(){
    var box = el("metaBox");
    if(!cfg.meta){ box.hidden = true; return; }
    var gasto = soma(gastos.filter(function(g){ return dentro(g, "mes"); }));
    var pct = gasto / cfg.meta * 100;
    box.hidden = false;
    box.classList.toggle("perto", pct >= 80 && pct < 100);
    box.classList.toggle("estourou", pct >= 100);
    el("metaVal").textContent = brl(gasto) + " de " + brl(cfg.meta);
    el("metaRot").textContent = pct >= 100 ? "Meta estourada" : "Meta do mês · " + Math.round(pct) + "%";
    el("metaBarra").style.width = Math.min(100, pct) + "%";
  }
  function alertaMeta(antes){
    if(!cfg.meta) return "";
    var depois = soma(gastos.filter(function(g){ return dentro(g, "mes"); }));
    if(antes < cfg.meta && depois >= cfg.meta) return "Você passou da meta do mês.";
    if(antes >= cfg.meta && depois > antes) return "A meta do mês já tinha estourado.";
    if(antes < cfg.meta * 0.8 && depois >= cfg.meta * 0.8) return "Você já usou 80% da meta do mês.";
    return "";
  }
  function renderLembrete(){
    var mostrar = false, txt = "";
    if(gastos.length && Date.now() > cfg.lembreteAte){
      var ref = cfg.ultimoBackup ? new Date(cfg.ultimoBackup).getTime() : Math.min.apply(null, gastos.map(function(g){ return new Date(g.data).getTime(); }));
      var dias = Math.floor((Date.now() - ref) / 86400000);
      if(dias >= 14){ mostrar = true; txt = cfg.ultimoBackup ? "Faz " + dias + " dias que você não faz backup." : "Você ainda não fez backup dos seus gastos."; }
    }
    el("lembrete").hidden = !mostrar;
    if(mostrar) el("lembreteTxt").textContent = txt;
  }
  el("lembreteIr").addEventListener("click", function(){ mostrarTela("config"); });
  el("lembreteFechar").addEventListener("click", function(){
    cfg.lembreteAte = Date.now() + 3 * 86400000; salvarCfg(); renderLembrete();
  });

  carregar();
  carregarCfg();
  aplicarTema();
  el("optCorrigir").checked = cfg.corrigir;
  montarDias(); renderConfig();
  desenharModos();
  desenharPredef();
  sincronizarCores();
  desenhar();
})();

// ---------- efeito glass de pressão (iPhone) ----------
(function(){
  var SELETORES = [
    "#nav button",                 // Início / Perfil
    "#filtros button",             // Hoje / 7 dias / Este mês / Tudo
    "#cats button",                // chips de categoria (gerados dinamicamente)
    ".linha-tema",                 // botões de configuração
    ".predef button"
  ];
  var ativo = null;

  function aplicar(botao, estado){
    if(!botao) return;
    botao.classList.toggle("glass-ativo", estado);
  }

  function ehAlvo(el){
    if(!el) return null;
    for(var i=0;i<SELETORES.length;i++){
      var mais = el.closest(SELETORES[i]);
      if(mais) return mais;
    }
    return null;
  }

  // delegação no document pra cobrir elementos criados depois (ex: chips de categoria)
  document.addEventListener("pointerdown", function(e){
    var b = ehAlvo(e.target);
    if(!b) return;
    if(e.button !== undefined && e.button !== 0) return;
    ativo = b;
    aplicar(b, true);
  });
  document.addEventListener("pointerup", function(){
    aplicar(ativo, false);
    ativo = null;
  });
  document.addEventListener("pointercancel", function(){
    aplicar(ativo, false);
    ativo = null;
  });
  document.addEventListener("pointerleave", function(e){
    if(ativo && ativo === ehAlvo(e.target)) aplicar(ativo, false);
  });
  document.addEventListener("keydown", function(e){
    if(!ativo) return;
    if(e.key === " " || e.key === "Enter"){
      e.preventDefault();
      aplicar(ativo, true);
    }
  });
  document.addEventListener("keyup", function(e){
    if(ativo && (e.key === " " || e.key === "Enter")) aplicar(ativo, false);
  });
})();

if("serviceWorker" in navigator){
  window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
}
