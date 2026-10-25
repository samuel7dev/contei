
(function(){
  var CHAVE = "gastos_v1", CHAVE_ENT = "entradas_v1";
  var gastos = [], entradas = [];
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
    // Ordenar por soma decrescente, categorias com 0 no final
    var ordenadas = nomesCats().slice().sort(function(a, b){
      var sa = somas[a] || 0, sb = somas[b] || 0;
      if(sa !== sb) return sb - sa;
      return a.localeCompare(b);
    });
    ordenadas.forEach(function(n){ if(somas[n] || catFiltro === n) chip(n, somas[n]||0, catFiltro === n, n); });
  }

  function carregar(){
    try { var s = localStorage.getItem(CHAVE); gastos = s ? JSON.parse(s) : []; }
    catch(e){ gastos = []; }
    if(!Array.isArray(gastos)) gastos = [];
    try { var s2 = localStorage.getItem(CHAVE_ENT); entradas = s2 ? JSON.parse(s2) : []; }
    catch(e){ entradas = []; }
    if(!Array.isArray(entradas)) entradas = [];
  }
  function salvarTudo(){
    try {
      localStorage.setItem(CHAVE, JSON.stringify(gastos));
      localStorage.setItem(CHAVE_ENT, JSON.stringify(entradas));
      return true;
    }
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

  var RE_ENTRADA = /^\s*\+|\b(recebi|ganhei|salario|receita|freela|freelance)\b/;

  function diaClamp(ano, mes, dia){
    var ult = new Date(ano, mes + 1, 0).getDate();
    return new Date(ano, mes, Math.min(dia, ult));
  }
  // acha uma data escrita no texto: ontem, anteontem, hoje, dia 12, 12/10, 12/10/2025
  function lerData(p){
    var hoje = inicioDoDia(new Date()), d = null, m;
    if((m = p.match(/\b(anteontem|ontem|hoje)\b/i))){
      var k = m[1].toLowerCase();
      d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (k === "ontem" ? 1 : k === "anteontem" ? 2 : 0));
      p = p.replace(m[0], " ");
    } else if((m = p.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/))){
      var dia = +m[1], mes = +m[2] - 1, ano = m[3] ? +m[3] : hoje.getFullYear();
      if(ano < 100) ano += 2000;
      var t = new Date(ano, mes, dia);
      if(t.getMonth() === mes && t.getDate() === dia){
        if(!m[3] && t > hoje) t = new Date(ano - 1, mes, dia);
        if(t <= hoje){ d = t; p = p.replace(m[0], " "); }
      }
    } else if((m = p.match(/\bdia\s+(\d{1,2})\b/i)) && +m[1] >= 1 && +m[1] <= 31){
      var t2 = diaClamp(hoje.getFullYear(), hoje.getMonth(), +m[1]);
      if(t2 > hoje) t2 = diaClamp(hoje.getFullYear(), hoje.getMonth() - 1, +m[1]);
      d = t2; p = p.replace(m[0], " ");
    }
    return {data:d, resto:p};
  }

  function interpretar(texto){
    var ok = [], falhas = [];
    texto.split(/[,;\n]+/).forEach(function(pedaco){
      var p = pedaco.trim();
      if(!p) return;
      var ent = RE_ENTRADA.test(semAcento(p));
      var ld = lerData(p); p = ld.resto;
      if(ent) p = p.replace(/\+/g, " ").replace(/\b(recebi|ganhei)\b/gi, " ");
      var m = p.match(NUM);
      if(!m){ falhas.push(pedaco.trim()); return; }
      var valor = paraNumero(m[1]);
      if(!isFinite(valor) || valor <= 0){ falhas.push(pedaco.trim()); return; }
      var desc = p.replace(m[0], " ").replace(MOEDA, " ").replace(/\s+/g," ").trim();
      desc = desc.replace(/^(de|com|em|no|na|pra|para)\s+/i,"");
      if(!desc) desc = ent ? "entrada" : "sem descrição";
      ok.push({valor:valor, desc:cfg.corrigir ? corrigirTexto(desc) : desc, cat:ent ? undefined : categorizar(desc), ent:ent, data:ld.data});
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

  function dataBonita(g){
    var d = new Date(g.data), h = new Date();
    if(g.semHora){
      var ontem = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1);
      if(chaveDia(d) === chaveDia(h)) return "hoje";
      if(chaveDia(d) === chaveDia(ontem)) return "ontem";
      return d.toLocaleDateString("pt-BR", d.getFullYear() === h.getFullYear() ? {day:"2-digit",month:"2-digit"} : {day:"2-digit",month:"2-digit",year:"numeric"});
    }
    var hora = d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    if(chaveDia(d) === chaveDia(h)) return "hoje, "+hora;
    return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+", "+hora;
  }

  function el(id){ return document.getElementById(id); }
  var ROTULOS = {hoje:"Total de hoje", semana:"Total dos últimos 7 dias", mes:"Total deste mês", tudo:"Total geral"};

  function naTelaInicio(){ return el("tela-inicio").classList.contains("ativa"); }
  // Helper: parse filtro de valor (valor:50, valor:>100, valor:<200, valor:50-200)
  function parseValorFiltro(termo){
    var m = termo.match(/^valor\s*:\s*([<>]?\s*\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?$/i);
    if(!m) return null;
    var op = "", v1 = m[1].trim(), v2 = m[2];
    var matchOp = v1.match(/^([<>])\s*(.+)$/);
    if(matchOp){ op = matchOp[1]; v1 = matchOp[2]; }
    var min = v2 ? paraNumero(v1.replace(",", ".")) : (op === ">" ? paraNumero(v1.replace(",", ".")) + 0.001 : 0);
    var max = v2 ? paraNumero(v2.replace(",", ".")) : (op === "<" ? paraNumero(v1.replace(",", ".")) - 0.001 : (op === ">" ? Infinity : paraNumero(v1.replace(",", "."))));
    return {min: min, max: max};
  }

  function somasPorCat(){
    var somas = {};
    gastos.forEach(function(g){ if(dentro(g, "mes")){ var c = catDe(g); somas[c] = (somas[c] || 0) + g.valor; } });
    return somas;
  }

  function desenhar(){
    if(!naTelaInicio()) return;
    animarValor(el("rHoje"), soma(gastos.filter(function(g){return dentro(g,"hoje");})));
    animarValor(el("rSemana"), soma(gastos.filter(function(g){return dentro(g,"semana");})));
    animarValor(el("rMes"), soma(gastos.filter(function(g){return dentro(g,"mes");})));
    renderMeta(); renderLembrete(); renderResumoRapido();

    var buscaInput = el("busca").value.trim();
    var termo = semAcento(buscaInput);
    var valorFiltro = parseValorFiltro(termo);
    var termoTexto = valorFiltro ? "" : termo; // se tem filtro de valor, não filtra por texto
    function passa(g){
      if(valorFiltro) return g.valor >= valorFiltro.min && g.valor <= valorFiltro.max;
      return !termoTexto || semAcento(g.desc).indexOf(termoTexto) !== -1;
    }
    var base = gastos.filter(function(g){ return dentro(g, periodo); }).filter(passa);
    desenharCats(base);
    var lista = catFiltro ? base.filter(function(g){ return catDe(g) === catFiltro; }) : base;
    var baseEnt = catFiltro ? [] : entradas.filter(function(g){ return dentro(g, periodo); }).filter(passa);

    var labelExtra = "";
    if(catFiltro) labelExtra += " em " + catFiltro;
    if(valorFiltro){
      var min = valorFiltro.min === 0 ? "" : (valorFiltro.min > 1e9 ? "" : " ≥ " + brlCurto(valorFiltro.min));
      var max = valorFiltro.max === Infinity ? "" : " ≤ " + brlCurto(valorFiltro.max);
      labelExtra += " (valor" + min + max + ")";
    } else if(termoTexto){
      labelExtra += ' com "' + buscaInput + '"';
    }
    el("totalRot").textContent = ROTULOS[periodo] + labelExtra;
    animarValor(el("total"), soma(lista));

    var linhas = lista.map(function(g){ return {g:g, ent:false}; })
      .concat(baseEnt.map(function(g){ return {g:g, ent:true}; }))
      .sort(function(a,b){ return new Date(b.g.data) - new Date(a.g.data); });

    var ul = el("lista");
    ul.innerHTML = "";
    if(!linhas.length){
      var v = document.createElement("div");
      v.className = "vazio";
      v.textContent = (gastos.length || entradas.length) ? "Nada encontrado nesse filtro." : "Nenhum gasto ainda. Escreva acima e toque em Salvar gastos.";
      ul.appendChild(v);
      return;
    }
    linhas.forEach(function(x){
      var g = x.g;
      var li = document.createElement("li");
      li.setAttribute("data-id", g.id);
      if(x.ent) li.classList.add("ent");
      if(novos[g.id] || animarLista){
        li.classList.add("entra");
        li.style.animationDelay = (Math.min(nEntrada++, 8) * (animarLista ? 40 : 70)) + "ms";
        delete novos[g.id];
      }
      var d = document.createElement("div"); d.className = "desc";
      d.textContent = g.desc;
      var s = document.createElement("small"); s.textContent = dataBonita(g) + (x.ent ? " · entrada" : ""); d.appendChild(s);
      var val = document.createElement("span"); val.className = "val num" + (x.ent ? " pos" : "");
      val.textContent = (x.ent ? "+ " : "") + brl(g.valor);

      var ac = document.createElement("div"); ac.className = "acoes";
      if(x.ent){
        var esp = document.createElement("span"); esp.className = "esp"; ac.appendChild(esp);
      } else {
        var sel = document.createElement("select");
        sel.setAttribute("aria-label","Categoria de "+g.desc);
        nomesCats().forEach(function(n){
          var o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o);
        });
        sel.value = catDe(g);
        sel.addEventListener("change", function(){ g.cat = sel.value; salvarTudo(); desenhar(); oferecerRegra(g.desc, g.cat); });
        ac.appendChild(sel);
      }
      var bEd = document.createElement("button"); bEd.textContent = "Editar"; bEd.setAttribute("aria-label","Editar "+g.desc);
      bEd.addEventListener("click", function(){ editarItem(li, g, x.ent); });
      var bDup = document.createElement("button"); bDup.textContent = "Duplicar"; bDup.setAttribute("aria-label","Duplicar "+g.desc);
      bDup.addEventListener("click", function(){ duplicarGasto(g, x.ent); });
      var b = document.createElement("button"); b.textContent = "Apagar"; b.setAttribute("aria-label","Apagar "+g.desc);
      b.addEventListener("click", function(){
        if(b.getAttribute("data-conf") === "1"){ apagar(g.id); return; }
        b.setAttribute("data-conf", "1"); b.textContent = "Certeza?"; b.classList.add("perigo");
        setTimeout(function(){
          if(b.isConnected){ b.removeAttribute("data-conf"); b.textContent = "Apagar"; b.classList.remove("perigo"); }
        }, 4000);
      });
      ac.appendChild(bEd); ac.appendChild(bDup); ac.appendChild(b);
      li.appendChild(d); li.appendChild(val); li.appendChild(ac);
      ul.appendChild(li);
    });
  }

  // gasto do ciclo atual até hoje, comparado com o mesmo trecho do ciclo anterior
  function compararMesPassado(){
    var agora = new Date(), ini = inicioDoCiclo(agora);
    var ant = new Date(ini.getFullYear(), ini.getMonth() - 1, ini.getDate());
    var dias = Math.round((inicioDoDia(agora) - ini) / 86400000) + 1;
    var lim = new Date(ant.getFullYear(), ant.getMonth(), ant.getDate() + dias);
    if(lim > ini) lim = ini;
    var a = 0, b = 0;
    gastos.forEach(function(g){
      var d = new Date(g.data);
      if(d >= ini) b += g.valor;
      else if(d >= ant && d < lim) a += g.valor;
    });
    return a > 0 ? {pct: (b - a) / a * 100} : null;
  }

  // Resumo rápido: comparação, recorrentes, entradas/saldo, metas e semanas
  function renderResumoRapido(){
    var box = el("resumoRapido");
    if(!box) return;
    var itens = [];

    var cmp = compararMesPassado();
    if(cmp) itens.push({label:"vs mês passado", valor:(cmp.pct >= 0 ? "↑ " : "↓ ") + Math.abs(Math.round(cmp.pct)) + "%", cls: cmp.pct > 0 ? "ruim" : "bom"});

    var totalRec = soma(gastos.filter(function(g){ return g.recorrente && dentro(g, periodo); }));
    if(totalRec > 0) itens.push({label:"Recorrentes", valor:brl(totalRec)});

    var entP = soma(entradas.filter(function(g){ return dentro(g, periodo); }));
    if(entP > 0){
      var saldo = entP - soma(gastos.filter(function(g){ return dentro(g, periodo); }));
      itens.push({label:"Entradas", valor:brl(entP)});
      itens.push({label:"Saldo", valor:brl(saldo), cls: saldo < 0 ? "ruim" : "bom"});
    }

    // Meta do mês
    if(cfg.meta){
      var gastoMes = soma(gastos.filter(function(g){ return dentro(g, "mes"); }));
      var pct = gastoMes / cfg.meta * 100;
      if(pct >= 80){ itens.push({label:"Meta", valor:Math.round(pct) + "%", cls: pct >= 100 ? "ruim" : ""}); }
    }
    // Metas por categoria
    var sc = somasPorCat(), nomes = nomesCats();
    Object.keys(cfg.metasCat).forEach(function(c){
      if(nomes.indexOf(c) === -1) return;
      var pc = (sc[c] || 0) / cfg.metasCat[c] * 100;
      if(pc >= 80) itens.push({label:c, valor:Math.round(pc) + "%", cls: pc >= 100 ? "ruim" : ""});
    });

    // Semanas do mês atual (segunda a domingo)
    var mesGastos = gastos.filter(function(g){ return dentro(g, "mes"); });
    if(mesGastos.length){
      var inicioCiclo = inicioDoCiclo(new Date());
      var fimCiclo = new Date(inicioCiclo.getFullYear(), inicioCiclo.getMonth() + 1, inicioCiclo.getDate());

      var porSemana = {};
      mesGastos.forEach(function(g){
        var d = new Date(g.data);
        if(d < inicioCiclo || d >= fimCiclo) return;
        var diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
        var seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff).getTime();
        porSemana[seg] = (porSemana[seg] || 0) + g.valor;
      });

      Object.keys(porSemana).map(Number).sort(function(a, b){ return a - b; }).slice(-5).forEach(function(ts){
        var label = "Sem " + new Date(ts).toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit"});
        itens.push({label: label, valor: brl(porSemana[ts])});
      });
    }

    box.innerHTML = "";
    itens.forEach(function(item){
      var chip = document.createElement("div"); chip.className = "chip" + (item.cls ? " " + item.cls : "");
      var a = document.createElement("span"); a.textContent = item.label;
      var b = document.createElement("strong"); b.textContent = item.valor;
      chip.appendChild(a); chip.appendChild(b);
      box.appendChild(chip);
    });
    if(!itens.length){
      var vazio = document.createElement("div"); vazio.className = "chip"; vazio.textContent = "Sem destaques";
      box.appendChild(vazio);
    }
  }

  function aviso(msg, tipo){
    var a = el("aviso"); a.textContent = msg; a.className = "aviso " + (tipo||"");
    void a.offsetWidth; a.classList.add("surge");
    clearTimeout(a._t);
    a._t = setTimeout(function(){ a.classList.add("some"); }, 4500);
  }

  function alertaMetasCat(antes){
    var depois = somasPorCat(), msgs = [], nomes = nomesCats();
    Object.keys(cfg.metasCat).forEach(function(c){
      if(nomes.indexOf(c) === -1) return;
      var m = cfg.metasCat[c], a = antes[c] || 0, d = depois[c] || 0;
      if(a < m && d >= m) msgs.push(c + " passou da meta (" + brl(m) + ").");
      else if(a < m * 0.8 && d >= m * 0.8 && d < m) msgs.push(c + " já usou 80% da meta.");
    });
    return msgs.join(" ");
  }

  function adicionar(){
    var r = interpretar(el("texto").value);
    if(!r.ok.length){
      aviso(r.falhas.length ? 'Não achei valor em: "'+r.falhas.join('", "')+'". Escreva o número, ex: 5 chiclete.' : "Escreva pelo menos um gasto.", "erro");
      return;
    }
    var agora = new Date();
    nEntrada = 0;
    var mesAntes = soma(gastos.filter(function(g){ return dentro(g, "mes"); }));
    var catsAntes = somasPorCat();
    r.ok.forEach(function(x,i){
      var novoId = Date.now()+"-"+i;
      novos[novoId] = true;
      var reg = {id: novoId, valor:x.valor, desc:x.desc, data:agora.toISOString()};
      if(x.data && chaveDia(x.data) !== chaveDia(agora)){
        reg.data = new Date(x.data.getFullYear(), x.data.getMonth(), x.data.getDate(), 12).toISOString();
        reg.semHora = true;
      }
      if(x.ent) entradas.push(reg);
      else { reg.cat = x.cat; gastos.push(reg); }
    });
    var gravou = salvarTudo();
    var sai = r.ok.filter(function(x){ return !x.ent; }), ent = r.ok.filter(function(x){ return x.ent; });
    var partes = [];
    if(sai.length) partes.push(sai.length+" gasto"+(sai.length>1?"s":"")+" salvo"+(sai.length>1?"s":"")+": "+brl(soma(sai))+".");
    if(ent.length) partes.push(ent.length+" entrada"+(ent.length>1?"s":"")+" salva"+(ent.length>1?"s":"")+": +"+brl(soma(ent))+".");
    var msg = partes.join(" ");
    if(r.falhas.length) msg += ' Não entendi: "'+r.falhas.join('", "')+'".';
    var extraMeta = sai.length ? [alertaMeta(mesAntes), alertaMetasCat(catsAntes)].filter(Boolean).join(" ") : "";
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
    var ent = false, i = gastos.findIndex(function(g){ return g.id === id; });
    if(i < 0){ i = entradas.findIndex(function(g){ return g.id === id; }); ent = true; }
    if(i < 0) return;
    apagado = {g:(ent ? entradas : gastos).splice(i,1)[0], ent:ent};
    salvarTudo(); desenhar();
    mostrarToast(ent ? "Entrada apagada." : "Gasto apagado.");
  }

  function duplicarGasto(g, ent){
    var texto = (ent ? "+" : "") + String(g.valor).replace(".", ",") + " " + g.desc;
    el("texto").value = texto;
    el("texto").focus();
    window.scrollTo(0, 0);
    aviso("Duplicado — edite e salve", "ok");
  }

  function dataParaInput(iso){
    var d = new Date(iso);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  // edição no próprio item da lista: descrição, valor e data
  function editarItem(li, g, ent){
    li.innerHTML = ""; li.className = "editando";
    function campo(tipo, valor, rotulo){
      var i = document.createElement("input"); i.type = tipo; i.value = valor; i.setAttribute("aria-label", rotulo);
      return i;
    }
    var campos = document.createElement("div"); campos.className = "edit-campos";
    var iDesc = campo("text", g.desc, "Descrição"); iDesc.maxLength = 120;
    var iVal = campo("text", String(g.valor).replace(".", ","), "Valor"); iVal.setAttribute("inputmode", "decimal");
    var iData = campo("date", dataParaInput(g.data), "Data"); iData.max = dataParaInput(new Date().toISOString());
    campos.appendChild(iDesc); campos.appendChild(iVal); campos.appendChild(iData);
    var bots = document.createElement("div"); bots.className = "edit-botoes";
    var bOk = document.createElement("button"); bOk.textContent = "Salvar"; bOk.className = "salvar";
    var bNo = document.createElement("button"); bNo.textContent = "Cancelar";
    bots.appendChild(bOk); bots.appendChild(bNo);
    li.appendChild(campos); li.appendChild(bots);

    function salvar(){
      var v = paraNumero(iVal.value.replace(/[^0-9.,]/g, ""));
      if(!isFinite(v) || v <= 0){ iVal.classList.add("erro"); iVal.focus(); return; }
      var desc = iDesc.value.replace(/\s+/g, " ").trim();
      if(!desc) desc = ent ? "entrada" : "sem descrição";
      if(desc !== g.desc && cfg.corrigir) desc = corrigirTexto(desc);
      g.valor = v; g.desc = desc.slice(0, 120);
      if(iData.value && iData.value !== dataParaInput(g.data)){
        var p = iData.value.split("-"), nd = new Date(+p[0], +p[1] - 1, +p[2], 12);
        if(!isNaN(nd.getTime()) && nd <= new Date()){
          if(chaveDia(nd) === chaveDia(new Date())){ g.data = new Date().toISOString(); delete g.semHora; }
          else { g.data = nd.toISOString(); g.semHora = true; }
        }
      }
      salvarTudo(); desenhar();
    }
    bOk.addEventListener("click", salvar);
    bNo.addEventListener("click", desenhar);
    [iDesc, iVal, iData].forEach(function(i){
      i.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); salvar(); }
        else if(e.key === "Escape"){ desenhar(); }
      });
    });
    iDesc.focus(); iDesc.select();
  }

  function exportarCSV(){
    if(!gastos.length && !entradas.length){
      avisoConfig("Não há lançamentos para exportar.");
      return;
    }
    function esc(s){
      return '"' + String(s).replace(/"/g, '""') + '"';
    }
    var todos = gastos.map(function(g){ return {g:g, t:"gasto"}; })
      .concat(entradas.map(function(g){ return {g:g, t:"entrada"}; }))
      .sort(function(a, b){ return new Date(a.g.data) - new Date(b.g.data); });
    var linhas = ["data,valor,descricao,categoria,tipo"];
    todos.forEach(function(x){
      var g = x.g;
      linhas.push(esc(g.data) + "," + String(g.valor).replace(",", ".") + "," + esc(g.desc) + "," + esc(x.t === "gasto" ? (g.cat || catDe(g)) : "") + "," + x.t);
    });
    var csv = "﻿" + linhas.join("\r\n"); // BOM pro Excel ler os acentos
    var blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var hoje = new Date().toISOString().slice(0, 10);
    a.download = "contei-gastos-" + hoje + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    avisoConfig("CSV exportado: " + a.download);
  }

  el("desfazer").addEventListener("click", function(){
    if(apagado){
      novos[apagado.g.id] = true; nEntrada = 0;
      (apagado.ent ? entradas : gastos).push(apagado.g);
      apagado = null; salvarTudo(); desenhar();
    }
    el("toast").classList.remove("on");
  });

  // ---------- aprender palavras: ao trocar a categoria, oferece lembrar ----------
  var STOP = ["para","com","uma","uns","por","dos","das","que","sem","mais","pra","the"];
  var regraPendente = null, aprenderTimer = null;
  function palavraChave(desc){
    var ws = normPalavra(desc).split(" ").filter(function(w){ return w.length >= 3 && !/^\d+$/.test(w) && STOP.indexOf(w) === -1; });
    ws.sort(function(a, b){ return b.length - a.length; });
    return ws[0] || "";
  }
  function esconderAprender(){
    el("toastAprender").classList.remove("on"); regraPendente = null; clearTimeout(aprenderTimer);
  }
  function oferecerRegra(desc, cat){
    var p = palavraChave(desc);
    if(!p || cfg.regras.length >= 60) return;
    if(cfg.regras.some(function(r){ return r.palavra === p && r.cat === cat; })) return;
    if(categorizar(p) === cat) return; // essa palavra já cai nessa categoria
    regraPendente = {palavra:p, cat:cat};
    el("toastAprenderMsg").textContent = 'Sempre que aparecer "' + p + '", mandar pra ' + cat + '?';
    el("toastAprender").classList.add("on");
    clearTimeout(aprenderTimer);
    aprenderTimer = setTimeout(esconderAprender, 8000);
  }
  function ensinar(palavra, cat){
    cfg.regras = cfg.regras.filter(function(r){ return r.palavra !== palavra; });
    cfg.regras.push({palavra:palavra, cat:cat});
    var re = new RegExp("(^| )" + palavra + "(s|es)?( |$)"), qtd = 0;
    gastos.forEach(function(g){
      if(re.test(normPalavra(g.desc)) && g.cat !== cat){ g.cat = cat; qtd++; }
    });
    salvarCfg(); salvarTudo();
    return qtd;
  }
  el("aprenderSim").addEventListener("click", function(){
    var r = regraPendente; esconderAprender();
    if(!r) return;
    var qtd = ensinar(r.palavra, r.cat);
    aviso('Pronto: "' + r.palavra + '" agora vai pra ' + r.cat + (qtd ? ". " + qtd + (qtd === 1 ? " gasto antigo foi atualizado." : " gastos antigos foram atualizados.") : "."), "ok");
    desenhar();
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
  var cfg = {corrigir:true, modo:"escuro", tema:null, nome:"", catsExtra:[], regras:[], meta:0, diaMes:1, ultimoBackup:"", lembreteAte:0, fixos:[], metasCat:{}}; // tema null = padrão (segue claro/escuro do celular)
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
      cfg.fixos = Array.isArray(c.fixos) ? c.fixos.filter(function(f){
        return f && typeof f.id === "string" && typeof f.desc === "string" && typeof f.valor === "number" && f.valor > 0 &&
          typeof f.dia === "number" && f.dia >= 1 && f.dia <= 28 && typeof f.ult === "number";
      }).slice(0,20) : [];
      cfg.metasCat = {};
      if(c.metasCat && typeof c.metasCat === "object") Object.keys(c.metasCat).slice(0,20).forEach(function(k){
        var v = c.metasCat[k]; if(typeof v === "number" && v > 0) cfg.metasCat[k] = v;
      });
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
    saude:"saúde",salario:"salário",farmacia:"farmácia",remedio:"remédio",medico:"médico",veterinario:"veterinário",racao:"ração",
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
    } else {
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

    renderMetasCat(somas);
    renderGrafico();
  }

  // ---------- gráfico do perfil: se adapta à quantidade de meses com dados ----------
  // 1 mês de dados -> dia a dia | 2 meses -> acumulado lado a lado | 3+ -> todos os meses
  function idxCiclo(d){
    var D = cfg.diaMes || 1, m = d.getFullYear() * 12 + d.getMonth();
    return d.getDate() >= D ? m : m - 1;
  }
  function iniCiclo(i){ return new Date(Math.floor(i / 12), i % 12, cfg.diaMes || 1); }
  function nomeCiclo(i, comAno){
    var d = iniCiclo(i);
    var s = d.toLocaleDateString("pt-BR", {month:"short"}).replace(".", "");
    return comAno ? s + "/" + String(d.getFullYear()).slice(2) : s;
  }
  function diasDoCiclo(i){ return Math.round((iniCiclo(i + 1) - iniCiclo(i)) / 86400000); }
  function somasPorCiclo(){
    var r = {};
    gastos.forEach(function(g){ var i = idxCiclo(new Date(g.data)); r[i] = (r[i] || 0) + g.valor; });
    return r;
  }
  function porDiaDoCiclo(i){
    var n = diasDoCiclo(i), arr = new Array(n).fill(0), ini = iniCiclo(i);
    gastos.forEach(function(g){
      var d = new Date(g.data);
      if(idxCiclo(d) !== i) return;
      var k = Math.round((inicioDoDia(d) - ini) / 86400000);
      if(k >= 0 && k < n) arr[k] += g.valor;
    });
    return arr;
  }
  function acumular(arr){ var s = 0; return arr.map(function(v){ s += v; return s; }); }

  function renderGrafico(){
    var canvas = el("graficoLinha");
    if(!canvas) return;
    var somas = somasPorCiclo();
    var idxs = Object.keys(somas).map(Number).sort(function(a, b){ return a - b; });
    var atual = idxCiclo(new Date());
    var modo = idxs.length <= 1 ? "dia" : (idxs.length === 2 ? "comp" : "meses");
    var anoTb = idxs.length === 2 && idxs[1] - idxs[0] > 11;
    var nomeA = modo === "comp" ? nomeCiclo(idxs[0], anoTb) : "", nomeB = modo === "comp" ? nomeCiclo(idxs[1], anoTb) : "";
    el("tituloGrafico").textContent = modo === "dia" ? "Gasto por dia do mês" : (modo === "comp" ? "Acumulado: " + nomeA + " × " + nomeB : "Gasto por mês");

    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.getBoundingClientRect().width, height = 170;
    if(!width) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var cs = getComputedStyle(document.documentElement);
    var accent = cs.getPropertyValue("--accent").trim() || "#f2b632";
    var corMuted = cs.getPropertyValue("--muted").trim() || "#9aa7c4";
    var corInk = cs.getPropertyValue("--ink").trim() || "#eef1f8";
    var corLinha = cs.getPropertyValue("--line").trim() || "#2a3858";
    var rgbA = hexParaRgb(accent);
    var areaCor = "rgba(" + rgbA.r + "," + rgbA.g + "," + rgbA.b + ",0.15)";
    var L = 44, R = width - 14, T = 24, B = height - 26, W = R - L, H = B - T;

    function eixoY(max){
      ctx.font = "11px system-ui"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
      for(var t = 0; t <= 2; t++){
        var y = B - H * t / 2;
        ctx.strokeStyle = corLinha; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
        ctx.fillStyle = corMuted; ctx.fillText(brlCurto(max * t / 2), L - 8, y);
      }
    }
    function curva(pts, jaNoCaminho){
      if(jaNoCaminho) ctx.lineTo(pts[0][0], pts[0][1]); else ctx.moveTo(pts[0][0], pts[0][1]);
      for(var i = 1; i < pts.length; i++){
        var cx = (pts[i - 1][0] + pts[i][0]) / 2;
        ctx.bezierCurveTo(cx, pts[i - 1][1], cx, pts[i][1], pts[i][0], pts[i][1]);
      }
    }
    function rotulosX(n, texto){
      var passo = n <= 15 ? 1 : (n <= 25 ? 2 : 3);
      ctx.font = "11px system-ui"; ctx.fillStyle = corMuted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for(var i = 0; i < n; i += passo) ctx.fillText(String(texto(i)), L + W * i / Math.max(1, n - 1), B + 6);
    }
    function clampK(x, n){ return Math.max(0, Math.min(n - 1, Math.round((x - L) / W * (n - 1)))); }

    if(modo === "dia"){
      var arr = porDiaDoCiclo(atual), n = arr.length, ini = iniCiclo(atual);
      var max = Math.max.apply(null, arr) || 1;
      var xAt = function(k){ return L + W * k / (n - 1); }, yAt = function(v){ return B - H * v / max; };
      var rot = function(k){ return new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + k).getDate(); };
      eixoY(max);
      var pts = arr.map(function(v, k){ return [xAt(k), yAt(v)]; });
      ctx.beginPath(); ctx.moveTo(L, B); curva(pts, true); ctx.lineTo(R, B); ctx.closePath();
      ctx.fillStyle = areaCor; ctx.fill();
      ctx.beginPath(); curva(pts, false);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      ctx.fillStyle = accent;
      arr.forEach(function(v, k){ if(v > 0){ ctx.beginPath(); ctx.arc(xAt(k), yAt(v), 3, 0, Math.PI * 2); ctx.fill(); } });
      rotulosX(n, rot);
      canvas._hit = function(x, y){
        if(x < L || x > R || y < T || y > B) return null;
        var k = clampK(x, n);
        if(!arr[k]) return null;
        return {texto:"Dia " + rot(k) + " · " + brl(arr[k]), x:xAt(k), y:yAt(arr[k])};
      };
    } else if(modo === "comp"){
      var a = idxs[0], b = idxs[1];
      var cumA = acumular(porDiaDoCiclo(a)), cumB = acumular(porDiaDoCiclo(b));
      if(b === atual) cumB = cumB.slice(0, Math.round((inicioDoDia(new Date()) - iniCiclo(b)) / 86400000) + 1);
      var nn = Math.max(cumA.length, diasDoCiclo(b));
      var mx = Math.max(cumA[cumA.length - 1], cumB[cumB.length - 1]) || 1;
      var xA = function(k){ return L + W * k / (nn - 1); }, yA = function(v){ return B - H * v / mx; };
      eixoY(mx);
      var serie = function(cum, cor, tracejado){
        if(!cum.length) return;
        var p = cum.map(function(v, k){ return [xA(k), yA(v)]; });
        if(!tracejado){
          ctx.beginPath(); ctx.moveTo(p[0][0], B); curva(p, true); ctx.lineTo(p[p.length - 1][0], B); ctx.closePath();
          ctx.fillStyle = areaCor; ctx.fill();
        }
        ctx.beginPath(); curva(p, false);
        ctx.strokeStyle = cor; ctx.lineWidth = tracejado ? 1.5 : 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.setLineDash(tracejado ? [5, 4] : []); ctx.stroke(); ctx.setLineDash([]);
        if(!tracejado){
          ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(p[p.length - 1][0], p[p.length - 1][1], 3.5, 0, Math.PI * 2); ctx.fill();
        }
      };
      serie(cumA, corMuted, true);
      serie(cumB, accent, false);
      // legenda
      ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.strokeStyle = corMuted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(L, 10); ctx.lineTo(L + 18, 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = corMuted; ctx.fillText(nomeA, L + 24, 10);
      var lx = L + 24 + ctx.measureText(nomeA).width + 16;
      ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx + 18, 10); ctx.stroke();
      ctx.fillStyle = corInk; ctx.fillText(nomeB, lx + 24, 10);
      rotulosX(nn, function(k){ return k + 1; });
      canvas._hit = function(x, y){
        if(x < L || x > R || y < T || y > B) return null;
        var k = clampK(x, nn);
        var ta = cumA[k] !== undefined ? brl(cumA[k]) : "–", tb = cumB[k] !== undefined ? brl(cumB[k]) : "–";
        return {texto:"Dia " + (k + 1) + " · " + nomeA + " " + ta + " · " + nomeB + " " + tb, x:xA(k), y:yA(Math.max(cumA[k] || 0, cumB[k] || 0))};
      };
    } else {
      var first = idxs[0], last = Math.max(atual, idxs[idxs.length - 1]), nm = last - first + 1;
      var vals = []; for(var i = 0; i < nm; i++) vals.push(somas[first + i] || 0);
      var mm = Math.max.apply(null, vals) || 1;
      var slot = W / nm, bw = Math.max(3, Math.min(34, slot * 0.62));
      eixoY(mm);
      vals.forEach(function(v, k){
        var h = H * v / mm, x = L + slot * k + (slot - bw) / 2;
        ctx.fillStyle = first + k === atual ? accent : "rgba(" + rgbA.r + "," + rgbA.g + "," + rgbA.b + ",0.55)";
        ctx.fillRect(x, B - h, bw, v > 0 ? Math.max(h, 1) : 0);
      });
      var passo = Math.max(1, Math.ceil(40 / slot));
      ctx.font = "11px system-ui"; ctx.fillStyle = corMuted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for(var k = nm - 1; k >= 0; k -= passo) ctx.fillText(nomeCiclo(first + k, nm > 12), L + slot * k + slot / 2, B + 6);
      canvas._hit = function(x, y){
        if(x < L || x > R || y < T || y > B) return null;
        var k = Math.floor((x - L) / slot);
        if(k < 0 || k >= nm) return null;
        return {texto:nomeCiclo(first + k, true) + " · " + brl(vals[k]), x:L + slot * k + slot / 2, y:B - H * vals[k] / mm};
      };
    }
  }
  var resizeT = null;
  window.addEventListener("resize", function(){
    clearTimeout(resizeT);
    resizeT = setTimeout(function(){
      if(el("tela-perfil").classList.contains("ativa")) renderGrafico();
    }, 150);
  });

  // barras de progresso das metas por categoria (Perfil)
  function renderMetasCat(somas){
    var bloco = el("blocoMetasCat"), box = el("barrasMetas"); box.innerHTML = "";
    var nomes = Object.keys(cfg.metasCat).filter(function(c){ return nomesCats().indexOf(c) !== -1; });
    bloco.hidden = !nomes.length;
    if(!nomes.length) return;
    nomes.sort(function(a, b){ return (somas[b] || 0) / cfg.metasCat[b] - (somas[a] || 0) / cfg.metasCat[a]; });
    nomes.forEach(function(n){
      var gasto = somas[n] || 0, meta = cfg.metasCat[n], pct = gasto / meta * 100;
      var linha = document.createElement("div"); linha.className = "b cmeta" + (pct >= 100 ? " estourou" : (pct >= 80 ? " perto" : ""));
      var t = document.createElement("div"); t.className = "t";
      var a = document.createElement("span"); a.textContent = n;
      var v = document.createElement("span"); v.textContent = brl(gasto) + " de " + brl(meta) + " · " + Math.round(pct) + "%";
      t.appendChild(a); t.appendChild(v);
      var f = document.createElement("div"); f.className = "f";
      var barra = document.createElement("i"); f.appendChild(barra);
      linha.appendChild(t); linha.appendChild(f); box.appendChild(linha);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ barra.style.width = Math.min(100, pct) + "%"; }); });
    });
  }

  // Render gráfico de comparação de gastos por mês

  function hexParaRgb(hex){
    var h = hex.replace("#", "");
    if(h.length === 3) h = h.split("").map(function(c){ return c + c; }).join("");
    var r = parseInt(h.slice(0,2), 16);
    var g = parseInt(h.slice(2,4), 16);
    var b = parseInt(h.slice(4,6), 16);
    return {r: r, g: g, b: b};
  }

  function brlCurto(n){
    if(n >= 1000) return (n/1000).toFixed(1).replace(".", ",") + "k";
    return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL", minimumFractionDigits: 0, maximumFractionDigits: 0});
  }

  el("nomeUsuario").addEventListener("input", function(){
    cfg.nome = el("nomeUsuario").value.slice(0, 30);
    salvarCfg();
    el("avatar").textContent = inicialDoNome();
  });
  el("btnExportar").addEventListener("click", function(){
    var dados = {app:"contei", versao:2, exportadoEm:new Date().toISOString(), nome:cfg.nome || "", categorias:cfg.catsExtra, regras:cfg.regras,
      config:{meta:cfg.meta, diaMes:cfg.diaMes, modo:cfg.modo, tema:cfg.tema, corrigir:cfg.corrigir, metasCat:cfg.metasCat},
      fixos:cfg.fixos, entradas:entradas, gastos:gastos};
    var blob = new Blob([JSON.stringify(dados, null, 2)], {type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "contei-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    cfg.ultimoBackup = new Date().toISOString(); salvarCfg(); renderConfig();
    avisoConfig("Backup gerado. Guarde o arquivo num lugar seguro.");
  });
  el("btnExportarCSV").addEventListener("click", exportarCSV);
  el("btnImportar").addEventListener("click", function(){ el("arqImportar").click(); });
  el("arqImportar").addEventListener("change", function(){
    var arq = el("arqImportar").files[0]; if(!arq) return;
    var leitor = new FileReader();
    leitor.onload = function(){
      try{
        var d = JSON.parse(leitor.result);
        var lista = Array.isArray(d) ? d : d.gastos;
        if(!Array.isArray(lista)) throw new Error("formato");
        var ids = {}; gastos.concat(entradas).forEach(function(g){ ids[g.id] = true; });
        var qtd = 0;
        function importar(itens, destino, ent){
          itens.forEach(function(g){
            if(!g || typeof g.valor !== "number" || !isFinite(g.valor) || g.valor <= 0) return;
            if(typeof g.desc !== "string" || !g.data || isNaN(new Date(g.data).getTime())) return;
            var id = String(g.id || (Date.now() + "-" + qtd + (ent ? "e" : "")));
            if(ids[id]) return;
            ids[id] = true;
            var reg = {id:id, valor:g.valor, desc:g.desc.slice(0, 120), data:g.data};
            if(!ent){
              var catImp = typeof g.cat === "string" ? g.cat : undefined;
              if(catImp){ garantirCategoria(catImp); if(nomesCats().indexOf(catImp) === -1) catImp = undefined; }
              reg.cat = catImp;
            }
            if(g.semHora === true) reg.semHora = true;
            if(g.recorrente === true) reg.recorrente = true;
            destino.push(reg);
            qtd++;
          });
        }
        importar(lista, gastos, false);
        if(Array.isArray(d.entradas)) importar(d.entradas, entradas, true);
        if(Array.isArray(d.categorias)) d.categorias.forEach(garantirCategoria);
        if(Array.isArray(d.regras)) d.regras.forEach(function(r){
          if(!r || typeof r.palavra !== "string" || typeof r.cat !== "string") return;
          var pal = normPalavra(r.palavra);
          if(!pal || cfg.regras.length >= 60 || nomesCats().indexOf(r.cat) === -1) return;
          if(cfg.regras.some(function(x){ return x.palavra === pal; })) return;
          cfg.regras.push({palavra:pal, cat:r.cat});
        });
        if(Array.isArray(d.fixos)) d.fixos.forEach(function(f){
          if(!f || typeof f.desc !== "string" || typeof f.valor !== "number" || !(f.valor > 0)) return;
          if(typeof f.dia !== "number" || f.dia < 1 || f.dia > 28 || typeof f.ult !== "number") return;
          var fid = String(f.id || novoIdFixo());
          if(cfg.fixos.length >= 20 || cfg.fixos.some(function(x){ return x.id === fid; })) return;
          cfg.fixos.push({id:fid, desc:f.desc.slice(0, 40), valor:f.valor, dia:Math.floor(f.dia), ult:Math.floor(f.ult)});
        });
        var c = d.config;
        if(c && typeof c === "object"){
          if(typeof c.meta === "number" && c.meta > 0) cfg.meta = c.meta;
          if(typeof c.diaMes === "number" && c.diaMes >= 1 && c.diaMes <= 28) cfg.diaMes = Math.floor(c.diaMes);
          if(typeof c.corrigir === "boolean"){ cfg.corrigir = c.corrigir; el("optCorrigir").checked = c.corrigir; }
          var t = c.tema;
          if(t && HEX.test(t.pri) && HEX.test(t.sec) && HEX.test(t.ter)) cfg.tema = {pri:t.pri, sec:t.sec, ter:t.ter};
          if(c.modo === "claro" || c.modo === "escuro" || (c.modo === "personalizado" && cfg.tema)) cfg.modo = c.modo;
          if(c.metasCat && typeof c.metasCat === "object") Object.keys(c.metasCat).forEach(function(k){
            if(typeof c.metasCat[k] === "number" && c.metasCat[k] > 0 && nomesCats().indexOf(k) !== -1 && (cfg.metasCat[k] || Object.keys(cfg.metasCat).length < 20)) cfg.metasCat[k] = c.metasCat[k];
          });
          aplicarTema(); desenharModos(); desenharPredef(); sincronizarCores();
        }
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
    var f = el("fixoDia"); f.innerHTML = "";
    for(var j = 1; j <= 28; j++){ var o2 = document.createElement("option"); o2.value = String(j); o2.textContent = "Dia " + j; f.appendChild(o2); }
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
    // metas por categoria
    var ms = el("metaCatSel"), atualM = ms.value; ms.innerHTML = "";
    nomesCats().forEach(function(n){ var o = document.createElement("option"); o.value = n; o.textContent = n; ms.appendChild(o); });
    if(atualM) ms.value = atualM;
    if(!ms.value) ms.selectedIndex = 0;
    var lm = el("listaMetasCat"); lm.innerHTML = "";
    var chavesM = Object.keys(cfg.metasCat);
    if(!chavesM.length){ var pm = document.createElement("p"); pm.textContent = "Nenhuma meta por categoria ainda."; lm.appendChild(pm); }
    chavesM.forEach(function(c){
      lm.appendChild(itemCfg(c + ": " + brl(cfg.metasCat[c]) + " por mês", "Remover", function(){
        delete cfg.metasCat[c]; salvarCfg(); renderConfig();
      }, "Remover meta de " + c));
    });
    // gastos fixos
    var lf = el("listaFixos"); lf.innerHTML = "";
    if(!cfg.fixos.length){ var pf = document.createElement("p"); pf.textContent = "Nenhum gasto fixo ainda."; lf.appendChild(pf); }
    cfg.fixos.forEach(function(f){
      lf.appendChild(itemCfg(f.desc + " · " + brl(f.valor) + " · dia " + f.dia, "Remover", function(){
        cfg.fixos = cfg.fixos.filter(function(x){ return x !== f; });
        salvarCfg(); renderConfig();
        avisoConfig('Fixo "' + f.desc + '" removido. Os lançamentos que já foram feitos continuam.');
      }, "Remover gasto fixo " + f.desc));
    });
    el("ultimoBackup").textContent = cfg.ultimoBackup ? "Último backup: " + new Date(cfg.ultimoBackup).toLocaleDateString("pt-BR") + "." : "Você ainda não fez backup.";
  }
  function removerCategoria(nome){
    cfg.catsExtra = cfg.catsExtra.filter(function(n){ return n !== nome; });
    cfg.regras = cfg.regras.filter(function(r){ return r.cat !== nome; });
    delete cfg.metasCat[nome];
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
    var qtd = ensinar(palavra, cat);
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
    function normal(){ b.removeAttribute("data-conf"); b.textContent = "Apagar todos os lançamentos"; b.classList.remove("perigo"); }
    if(b.getAttribute("data-conf") === "1"){
      gastos = []; entradas = []; apagado = null; salvarTudo(); normal();
      avisoConfig("Todos os lançamentos foram apagados.");
      return;
    }
    b.setAttribute("data-conf", "1"); b.textContent = "Certeza? Toque de novo"; b.classList.add("perigo");
    setTimeout(function(){ if(b.getAttribute("data-conf") === "1") normal(); }, 4000);
  });
  el("btnMetaCat").addEventListener("click", function(){
    var c = el("metaCatSel").value, txt = el("metaCatVal").value.trim();
    if(!c){ avisoConfig("Escolha a categoria."); return; }
    if(!txt){
      if(cfg.metasCat[c]){ delete cfg.metasCat[c]; salvarCfg(); renderConfig(); avisoConfig("Meta de " + c + " removida."); }
      else avisoConfig("Escreva o valor da meta, ex: 400.");
      return;
    }
    var v = paraNumero(txt.replace(/[^0-9.,]/g, ""));
    if(!isFinite(v) || v <= 0){ avisoConfig("Escreva um valor válido, ex: 400."); return; }
    if(!cfg.metasCat[c] && Object.keys(cfg.metasCat).length >= 20){ avisoConfig("Limite de 20 metas por categoria."); return; }
    cfg.metasCat[c] = v; salvarCfg();
    el("metaCatVal").value = ""; renderConfig();
    avisoConfig("Meta de " + c + ": " + brl(v) + " por mês.");
  });

  // ---------- gastos fixos (lançam sozinhos todo mês) ----------
  function novoIdFixo(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function lancarFixos(){
    var agora = new Date(), hojeIdx = agora.getFullYear() * 12 + agora.getMonth(), mudou = false;
    cfg.fixos.forEach(function(f){
      for(var i = f.ult + 1, n = 0; i <= hojeIdx && n < 24; i++, n++){
        var y = Math.floor(i / 12), m = i % 12;
        var dt = new Date(y, m, Math.min(f.dia, new Date(y, m + 1, 0).getDate()), 12);
        if(inicioDoDia(dt) > inicioDoDia(agora)) break;
        var id = "fx-" + f.id + "-" + i;
        if(!gastos.some(function(g){ return g.id === id; })){
          gastos.push({id:id, valor:f.valor, desc:f.desc, cat:categorizar(f.desc), data:dt.toISOString(), semHora:true, recorrente:true});
        }
        f.ult = i; mudou = true;
      }
    });
    if(mudou){ salvarTudo(); salvarCfg(); }
    return mudou;
  }
  el("btnAddFixo").addEventListener("click", function(){
    var desc = el("fixoDesc").value.trim().replace(/\s+/g, " ");
    var v = paraNumero(el("fixoValor").value.replace(/[^0-9.,]/g, ""));
    var dia = parseInt(el("fixoDia").value, 10) || 1;
    if(!desc){ avisoConfig("Escreva a descrição, ex: Aluguel."); return; }
    if(!isFinite(v) || v <= 0){ avisoConfig("Escreva um valor válido, ex: 1200."); return; }
    if(cfg.fixos.length >= 20){ avisoConfig("Limite de 20 gastos fixos."); return; }
    if(cfg.corrigir) desc = corrigirTexto(desc);
    var agora = new Date();
    cfg.fixos.push({id:novoIdFixo(), desc:desc.slice(0, 40), valor:v, dia:dia, ult:agora.getFullYear() * 12 + agora.getMonth() - 1});
    var lancou = lancarFixos();
    salvarCfg();
    el("fixoDesc").value = ""; el("fixoValor").value = ""; renderConfig();
    avisoConfig("Fixo criado: " + desc + ", " + brl(v) + " todo dia " + dia + "." + (lancou ? " Já lancei o deste mês." : ""));
  });
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden && lancarFixos()) desenhar();
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
  lancarFixos();
  aplicarTema();
  el("optCorrigir").checked = cfg.corrigir;
  montarDias(); renderConfig();
  desenharModos();
  desenharPredef();
  sincronizarCores();
  desenhar();

  // Tooltip do gráfico (funciona nos 3 modos via canvas._hit)
  (function(){
    var canvas = el("graficoLinha");
    if(!canvas) return;
    var tooltip = document.createElement("div");
    tooltip.style.cssText = "position:absolute;pointer-events:none;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:.8rem;color:var(--ink);box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:50;opacity:0;transition:opacity .15s ease;transform:translate(-50%,-100%);margin-top:-6px;white-space:nowrap";
    document.body.appendChild(tooltip);

    function mostrarTooltip(e){
      if(!canvas._hit) return;
      var rect = canvas.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var h = canvas._hit(clientX - rect.left, clientY - rect.top);
      if(!h){ tooltip.style.opacity = "0"; return; }
      tooltip.textContent = h.texto;
      var meia = tooltip.offsetWidth / 2 + 8;
      var x = Math.max(meia, Math.min(document.documentElement.clientWidth - meia, rect.left + h.x));
      tooltip.style.left = (x + window.scrollX) + "px";
      tooltip.style.top = (rect.top + h.y + window.scrollY) + "px";
      tooltip.style.opacity = "1";
    }
    function esconderTooltip(){ tooltip.style.opacity = "0"; }

    canvas.addEventListener("mousemove", mostrarTooltip);
    canvas.addEventListener("mouseleave", esconderTooltip);
    canvas.addEventListener("touchstart", mostrarTooltip, {passive: true});
    canvas.addEventListener("touchmove", mostrarTooltip, {passive: true});
    canvas.addEventListener("touchend", esconderTooltip);
    canvas.addEventListener("touchcancel", esconderTooltip);
  })();
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
