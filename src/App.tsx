import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { AppDB, COLLECTIONS, subscribeRealtime, supabase } from '@/lib/almox-db';
import { ensureNotificationPermission, notificationPermission, showAppNotification, wasNotified } from '@/lib/notifications';
const ArquivosBoderoView = lazy(() => import('./ArquivosBoderoView'));
const ObrasView = lazy(() => import('./ObrasView'));
import { Hop as Home, Package, Wrench, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Plus, X, Menu, User, Zap, Cpu, CreditCard as Edit, Trash2, Building2, FileDown, CloudUpload as UploadCloud, Database, CircleArrowDown as ArrowDownCircle, Printer, ListFilter as Filter, Layers, HardDrive, MapPin, Target, FileOutput, Save, ChartBar as BarChart2, Truck, ArrowRightLeft, FileText, LogOut, LogIn, Search, CircleAlert as AlertCircle, History, CalendarDays, Download, Upload, ChevronLeft, ChevronRight, Check, RefreshCcw, Clock, RefreshCcw as RefreshCw, ShieldAlert, Cloud, Lock, LayoutDashboard, CirclePlus as PlusCircle, Settings, Circle as XCircle, MessageSquare, Camera, Send, Copy, FileCheck, SquareCheck as CheckSquare, Square as XSquare, ChevronDown, ChevronUp, ListTodo, Image as ImageIcon, Loader as Loader2, Smartphone, Eye, FileDigit, ClipboardCheck, Tag, Printer as PrinterIcon, Key, MonitorSmartphone, FileCode, MapPin as LocationIcon, FileBarChart, AlertOctagon, Bell, Flag, CalendarClock, Folder } from 'lucide-react';


// ============================================================================
// REALTIME GUARD — impede que atualizações vindas de outros dispositivos
// recarreguem a tela enquanto há um formulário aberto (evita perda de dados).
// Quando o último formulário fecha, dispara um flush se houve mudanças pendentes.
// ============================================================================
const REALTIME_GUARD = { suspended: 0, pending: false };
const useSuspendRealtime = (active = true) => {
  useEffect(() => {
    if (!active) return undefined;
    REALTIME_GUARD.suspended++;
    return () => {
      REALTIME_GUARD.suspended = Math.max(0, REALTIME_GUARD.suspended - 1);
      if (REALTIME_GUARD.suspended === 0 && REALTIME_GUARD.pending) {
        REALTIME_GUARD.pending = false;
        try { window.dispatchEvent(new CustomEvent('almox-realtime-flush')); } catch {}
      }
    };
  }, [active]);
};

// ============================================================================
// 1. CONFIGURAÇÕES GERAIS
// ============================================================================

const LOGO_URL = "/yarin-almox-logo.png";
const LOGO_FALLBACK = "https://placehold.co/300x80/000/FFF?text=YARIN+ALMOX";
// Logo oficial Realmarka — usada APENAS em documentos impressos (requisições, relatórios, etiquetas).
// O branding YARIN ALMOX é exclusivo da interface do SaaS e do ícone PWA.
const REALMARKA_LOGO = "https://i.ibb.co/SDqxK8kF/logo-realmarka.png";
const ACCENT_COLOR = 'text-yellow-400';
const BG_DARK = 'bg-gray-900';
const TEXT_LIGHT = 'text-gray-100';
const LOCACAO_ESTOQUE_LOCAL = 'ESTOQUE LOCAL';
const SYSTEM_NAME = "YARIN ALMOX";
const PRINT_BRAND = "REALMARKA";

// Categorias compatíveis com PBQP-H / SiAC para obras de grande porte (construção civil)
const CATEGORIAS_PADRAO = [
  "Agregados (Areia/Brita/Pedrisco)",
  "Aglomerantes (Cimento/Cal/Gesso)",
  "Argamassas e Rejuntes",
  "Concreto e Aditivos",
  "Aço e Armaduras (Vergalhão/Tela/Estribo)",
  "Formas e Escoramentos",
  "Blocos e Tijolos (Cerâmico/Concreto)",
  "Impermeabilizantes",
  "Isolantes Térmicos e Acústicos",
  "Sistema de Drenagem",
  "Estruturas Metálicas",
  "Madeiras e Compensados",
  "Esquadrias (Portas/Janelas)",
  "Vidros e Espelhos",
  "Cobertura (Telhas/Mantas/Calhas)",
  "Forros (Gesso/PVC/Mineral)",
  "Revestimentos Cerâmicos e Porcelanatos",
  "Revestimentos de Pedra e Mármore",
  "Pisos Laminados/Vinílicos",
  "Pintura e Texturas",
  "Hidráulica - Tubos e Conexões",
  "Hidráulica - Louças e Metais Sanitários",
  "Elétrica - Cabos e Fios",
  "Elétrica - Eletrodutos e Quadros",
  "Elétrica - Iluminação e Tomadas",
  "Sistemas de Combate a Incêndio",
  "Sistemas de Climatização (HVAC)",
  "Automação Predial",
  "Ferragens e Fixadores (Parafusos/Buchas)",
  "Serralheria e Soldagem",
  "Acabamento (Molduras/Rodapés)",
  "Ferramentas Manuais",
  "Ferramentas Elétricas",
  "Máquinas e Equipamentos Pesados",
  "EPI - Proteção da Cabeça",
  "EPI - Proteção Auditiva e Visual",
  "EPI - Proteção Respiratória",
  "EPI - Proteção de Mãos e Pés",
  "EPI - Proteção contra Quedas",
  "EPC - Proteção Coletiva (Telas/Guarda-corpos)",
  "Sinalização de Obra",
  "Limpeza e Conservação",
  "Material de Escritório",
  "Outros"
];
const AREAS_ESTOCAGEM = ['Almoxarifado', 'Conteiner', 'Estoque A', 'Estoque B', 'Estoque C'];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().split('-')[0].toUpperCase();
  }
  return Math.random().toString(16).slice(2, 10).toUpperCase();
};

const getLocalISOString = () => {
    const date = new Date();
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, -1);
};

const formatBRDate = (dateStr) => {
  if (!dateStr) return '-';
  if (typeof dateStr === 'object') {
      try { dateStr = dateStr.toISOString(); } catch(e) { return '-'; }
  }
  const parts = String(dateStr).split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
};

const resizeImage = async (file, maxWidth = 800) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = String(event.target.result);
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                elem.width = width; elem.height = height;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(elem.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => reject(new Error("Erro ao renderizar imagem."));
        };
        reader.onerror = () => reject(new Error("Erro ao ler o ficheiro."));
    });
};

const DNA_TEMPLATES = {
  'Estruturais de Base e Concretagem': [
    { name: 'fck', label: 'Fck (Resistência)', placeholder: 'Ex: 25 MPa, 30 MPa' },
    { name: 'slump', label: 'Slump (Abatimento)', placeholder: 'Ex: 10 ± 2' },
    { name: 'lote_usina', label: 'Lote/Nota Fiscal da Usina', placeholder: 'Número de rastreio' },
    { name: 'hora_saida_chegada', label: 'Hora de Saída/Chegada', placeholder: 'Ex: 14:00 / 14:45' },
    { name: 'volume', label: 'Volume (m³)', type: 'number' }
  ],
  'Aço e Protensão': [
    { name: 'corrida_lote', label: 'Corrida / Lote', placeholder: 'Identificação da Usina' },
    { name: 'bitola', label: 'Bitola', placeholder: 'Ex: 16 DN, 10.0mm, 5.0mm' },
    { name: 'ca', label: 'CA (Categoria)', type: 'select', options: ['CA-50', 'CA-60'] },
    { name: 'certificado', label: 'Certificado de Qualidade', type: 'select', options: ['Sim', 'Não'] },
    { name: 'fabricante', label: 'Fabricante', placeholder: 'Ex: Gerdau, Arcelor' }
  ],
  'Cimentícios e Ensacados': [
    { name: 'lote_fabricacao', label: 'Lote de Fabricação' },
    { name: 'data_fabricacao', label: 'Data de Fabricação', type: 'date' },
    { name: 'validade_dna', label: 'Data de Validade', type: 'date' },
    { name: 'tipo_classe', label: 'Tipo/Classe', placeholder: 'Ex: CP-II, AC-III, Rejunte Flexível' }
  ],
  'Alvenaria e Revestimentos Cerâmicos': [
    { name: 'lote_referencia', label: 'Lote / Referência' },
    { name: 'tonalidade', label: 'Tonalidade' },
    { name: 'calibre_tamanho', label: 'Calibre/Tamanho', placeholder: 'Ex: 60x60, 20x20' },
    { name: 'resistencia', label: 'Resistência (PEI/Compressão)', placeholder: 'Ex: 7.0 MPa' }
  ],
  'Instalações (Elétrica, Gás, Hidráulica)': [
    { name: 'marca_modelo', label: 'Marca / Modelo' },
    { name: 'bitola_secao', label: 'Bitola / Seção', placeholder: 'Ex: 2,5mm², 25mm, 1/2"' },
    { name: 'norma', label: 'Selo INMETRO / Norma', placeholder: 'Ex: NBR 5410' },
    { name: 'tensao_pressao', label: 'Tensão / Pressão', placeholder: 'Ex: 750V, PN 10' }
  ],
  'Placas e Esquadrias': [
    { name: 'lote_producao', label: 'Lote de Produção' },
    { name: 'dimensoes', label: 'Dimensões', placeholder: 'L x A x Espessura' },
    { name: 'tipo_tratamento', label: 'Tipo de Tratamento', placeholder: 'Ex: Placa RU / Tratada' },
    { name: 'acabamento', label: 'Acabamento', placeholder: 'Ex: Alumínio Branco' }
  ],
  'Impermeabilização e Químicos': [
    { name: 'lote_quimico', label: 'Lote' },
    { name: 'validade_quimico', label: 'Data de Validade', type: 'date' },
    { name: 'cor', label: 'Cor / Código da Cor', placeholder: 'Ex: Branco Neve, R-105' },
    { name: 'demaos', label: 'Nº de Demãos Recomendadas', type: 'number' }
  ],
  'Reservatórios': [
    { name: 'capacidade', label: 'Capacidade (Litros)', type: 'number' },
    { name: 'material_reservatorio', label: 'Material', placeholder: 'Polietileno, Fibra, etc.' },
    { name: 'num_serie', label: 'Número de Série' }
  ]
};

// ============================================================================
// 2. CAMADA DE ACESSO AO BANCO DE DADOS (NUVEM - SUPABASE COM REALTIME)
// AppDB importado de @/lib/almox-db - API idêntica ao original IndexedDB.
// ============================================================================

// generatePDF helper (gerador genérico de relatórios imprimíveis)
const generatePDF = (title, columns, data, showMsg) => {
  if (!data || data.length === 0) {
    if (showMsg) showMsg("Aviso", "Não há dados para gerar relatório.");
    return;
  }
  const w = window.open('', '', 'height=800,width=1000');
  if (!w) { if (showMsg) showMsg("Atenção", "Permita popups para imprimir."); return; }
  let html = `<html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#000;background:#fff;}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px;}
    .header img{max-height:40px;filter:grayscale(100%) contrast(200%);}
    h1{text-align:center;font-size:18px;text-transform:uppercase;flex-grow:1;margin:0;}
    table{width:100%;border-collapse:collapse;margin-top:10px;}
    th,td{border:1px solid #000;padding:6px;text-align:left;font-size:11px;}
    th{background:#e0e0e0;font-weight:bold;text-align:center;text-transform:uppercase;}
    tr:nth-child(even){background:#f8f8f8;}
    .footer{margin-top:30px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:8px;text-align:center;}
  </style></head><body>
    <div class="header"><img src="${REALMARKA_LOGO}" alt="${SYSTEM_NAME}"/><h1>${title}</h1><div>Data:<br>${new Date().toLocaleDateString('pt-BR')}</div></div>
    <table><thead><tr>${columns.map(c => `<th>${c.header}</th>`).join('')}</tr></thead><tbody>`;
  data.forEach(row => {
    html += `<tr>${columns.map(c => `<td>${row[c.dataKey] ?? '-'}</td>`).join('')}</tr>`;
  });
  html += `</tbody></table><div class="footer">${PRINT_BRAND} - Relatório gerado em ${new Date().toLocaleString('pt-BR')} - Padrão ISO 9001</div></body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

// ============================================================================
// 3. UTILITÁRIOS E PDF
// ============================================================================

const printLowStockReport = (produtos, category = 'ALL', showMsg) => {
    let lowStock = (produtos || []).filter(i => (Number(i.saldo_atual) || 0) < (Number(i.estoque_minimo) || 5) && String(i.ativo) !== 'false');
    if (category !== 'ALL') lowStock = lowStock.filter(i => (i.categoria || 'Geral') === category);

    if (lowStock.length === 0) {
        if(showMsg) showMsg("Aviso", category === 'ALL' ? "Nenhum item com estoque abaixo do mínimo." : `Não há itens com estoque baixo em "${category}".`);
        return;
    }

    const grouped = lowStock.reduce((acc, item) => {
        const cat = item.categoria || 'Geral';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) {
        if(showMsg) showMsg("Atenção", "Permita popups para imprimir.");
        return;
    }

    const reportTitle = category === 'ALL' ? 'ITENS COM ESTOQUE BAIXO POR CATEGORIA' : `ESTOQUE BAIXO: ${category.toUpperCase()}`;

    let html = `<html><head><title>Relatório de Estoque Baixo</title>
    <style>
      body { font-family: Arial, sans-serif; }
      .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .header img { max-height: 40px; filter: grayscale(100%) contrast(200%); }
      h1 { text-align: center; font-size: 18px; text-transform: uppercase; flex-grow: 1;}
      h2 { border-bottom: 1px solid #ccc; font-size: 14px; background: #f0f0f0; padding: 6px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 12px; }
      th { background-color: #e0e0e0; font-weight: bold; text-align: center; }
      .center { text-align: center; }
      .danger { color: red; font-weight: bold; }
    </style></head><body>
    <div class="header"><img src="${REALMARKA_LOGO}" alt="${SYSTEM_NAME}"><h1>${reportTitle}</h1><div>Data:<br>${new Date().toLocaleDateString('pt-BR')}</div></div>`;

    Object.keys(grouped).sort().forEach(cat => {
        if (category === 'ALL') html += `<h2>Categoria: ${String(cat)}</h2>`;
        html += `<table><thead><tr><th style="width: 40%;">Descrição do Item</th><th style="width: 15%;">Empreiteira</th><th style="width: 15%;">Localização</th><th style="width: 15%;">Estoque Mínimo</th><th style="width: 15%;">Saldo Atual</th></tr></thead><tbody>`;
        grouped[cat].sort((a,b) => String(a.nome).localeCompare(String(b.nome))).forEach(item => {
            const localizacao = item.rua && item.prateleira ? `R${item.rua}-P${item.prateleira}` : (item.local_armazenamento || '-');
            html += `<tr><td>${String(item.nome)} <small>(${String(item.unidade)})</small></td><td class="center">${String(item.empreiteira || '-')}</td><td class="center">${localizacao}</td><td class="center">${item.estoque_minimo}</td><td class="center danger">${item.saldo_atual}</td></tr>`;
        });
        html += `</tbody></table>`;
    });
    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};


// Relatório Geral de Estoque — agrupado por Categoria (opcionalmente filtrado por empreiteira)
const printEstoqueGeralReport = (produtos, empreiteira = 'ALL', showMsg) => {
    let lista = (produtos || []).filter(p => String(p.ativo) !== 'false');
    if (empreiteira !== 'ALL') lista = lista.filter(p => (p.empreiteira || 'Sem Empreiteira') === empreiteira);

    if (lista.length === 0) {
        if (showMsg) showMsg("Aviso", empreiteira === 'ALL' ? "Nenhum item ativo no estoque." : `Sem itens para empreiteira "${empreiteira}".`);
        return;
    }

    const grouped = lista.reduce((acc, item) => {
        const cat = item.categoria || 'Geral';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const w = window.open('', '', 'height=800,width=1000');
    if (!w) { if (showMsg) showMsg("Atenção", "Permita popups para imprimir."); return; }

    const titulo = empreiteira === 'ALL' ? 'RELATÓRIO GERAL DE ESTOQUE' : `RELATÓRIO DE ESTOQUE - ${String(empreiteira).toUpperCase()}`;
    const totalItens = lista.length;
    const totalUnidades = lista.reduce((s, p) => s + (Number(p.saldo_atual) || 0), 0);
    const valorTotal = lista.reduce((s, p) => s + ((Number(p.saldo_atual) || 0) * (Number(p.preco_unitario) || 0)), 0);

    let html = `<html><head><title>${titulo}</title><style>
      body{font-family:Arial,sans-serif;padding:18px;color:#000;}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px;}
      .header img{max-height:42px;filter:grayscale(100%) contrast(200%);}
      h1{font-size:16px;text-transform:uppercase;flex-grow:1;text-align:center;margin:0;}
      .summary{display:flex;gap:10px;margin:10px 0 16px;}
      .summary .box{flex:1;border:1px solid #000;padding:6px 10px;text-align:center;}
      .summary .k{font-size:9px;text-transform:uppercase;color:#444;}
      .summary .v{font-size:16px;font-weight:900;}
      h2{font-size:12px;background:#e8e8e8;border:1px solid #000;padding:5px 8px;margin:14px 0 4px;text-transform:uppercase;}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #000;padding:4px 6px;font-size:10px;}
      th{background:#dcdcdc;text-transform:uppercase;font-size:9px;}
      .c{text-align:center;} .r{text-align:right;} .low{color:#b00;font-weight:900;}
      .footer{margin-top:20px;font-size:9px;color:#555;border-top:1px solid #ccc;padding-top:6px;text-align:center;}
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
      <div class="header"><img src="${REALMARKA_LOGO}" alt="${PRINT_BRAND}"/><h1>${titulo}</h1><div style="font-size:10px;text-align:right">Data:<br>${new Date().toLocaleDateString('pt-BR')}</div></div>
      <div class="summary">
        <div class="box"><div class="k">Itens (SKUs)</div><div class="v">${totalItens}</div></div>
        <div class="box"><div class="k">Unidades em Estoque</div><div class="v">${totalUnidades.toLocaleString('pt-BR')}</div></div>
        <div class="box"><div class="k">Valor Estimado (R$)</div><div class="v">${valorTotal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div class="box"><div class="k">Empreiteira</div><div class="v" style="font-size:12px">${empreiteira === 'ALL' ? 'Todas' : empreiteira}</div></div>
      </div>`;

    Object.keys(grouped).sort().forEach(cat => {
        const itens = grouped[cat].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
        const subtotalQtd = itens.reduce((s, p) => s + (Number(p.saldo_atual) || 0), 0);
        const subtotalValor = itens.reduce((s, p) => s + ((Number(p.saldo_atual) || 0) * (Number(p.preco_unitario) || 0)), 0);
        html += `<h2>${cat} &nbsp; — &nbsp; ${itens.length} item(ns) &nbsp; | &nbsp; ${subtotalQtd.toLocaleString('pt-BR')} un &nbsp; | &nbsp; R$ ${subtotalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</h2>`;
        html += `<table><thead><tr>
          <th style="width:6%">SKU</th>
          <th style="width:30%">Descrição</th>
          <th style="width:8%">Un</th>
          <th style="width:12%">Empreiteira</th>
          <th style="width:14%">Localização</th>
          <th style="width:8%">Mínimo</th>
          <th style="width:8%">Saldo</th>
          <th style="width:7%">R$ Un</th>
          <th style="width:7%">Total</th>
        </tr></thead><tbody>`;
        itens.forEach(p => {
            const localizacao = p.rua && p.prateleira ? `R${p.rua}-P${p.prateleira}${p.gaveta?'-G'+p.gaveta:''}` : (p.local_armazenamento || '-');
            const saldo = Number(p.saldo_atual) || 0;
            const min = Number(p.estoque_minimo) || 0;
            const preco = Number(p.preco_unitario) || 0;
            const baixo = saldo < min;
            html += `<tr>
              <td class="c" style="font-family:monospace">${String(p.sku || '-')}</td>
              <td>${String(p.nome || '-')}</td>
              <td class="c">${String(p.unidade || 'UN')}</td>
              <td class="c">${String(p.empreiteira || '-')}</td>
              <td class="c">${localizacao}</td>
              <td class="c">${min}</td>
              <td class="c ${baixo ? 'low' : ''}">${saldo}</td>
              <td class="r">${preco.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
              <td class="r">${(saldo*preco).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });

    html += `<div class="footer">${PRINT_BRAND} — Padrão PBQP-H/SiAC — Gerado em ${new Date().toLocaleString('pt-BR')}</div></body></html>`;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 500);
};

// Relatório Mensal de Trocas e Devoluções (equipamentos alugados)
const printTrocasReport = (locacoes, mesRef = null, showMsg) => {
    const now = new Date();
    const ref = mesRef ? new Date(mesRef + '-01T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

    const eventos = [];
    (locacoes || []).forEach(loc => {
        (loc.historico || []).forEach(h => {
            const d = new Date(h.data);
            if (d >= inicio && d < fim) {
                eventos.push({ ...h, loc });
            }
        });
    });
    eventos.sort((a, b) => new Date(a.data) - new Date(b.data));

    if (eventos.length === 0) {
        if (showMsg) showMsg("Aviso", `Sem trocas ou devoluções registradas em ${ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}.`);
        return;
    }

    const w = window.open('', '', 'height=800,width=1000');
    if (!w) { if (showMsg) showMsg("Atenção", "Permita popups para imprimir."); return; }

    const porLocadora = eventos.reduce((acc, e) => {
        const k = e.loc.lending_company || 'Sem Locadora';
        if (!acc[k]) acc[k] = [];
        acc[k].push(e);
        return acc;
    }, {});

    const trocas = eventos.filter(e => e.tipo === 'TROCA').length;
    const devolucoes = eventos.filter(e => e.tipo === 'DEVOLUCAO').length;
    const mesNome = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

    let html = `<html><head><title>Relatório Mensal de Trocas/Devoluções - ${mesNome}</title><style>
      body{font-family:Arial,sans-serif;padding:18px;color:#000;}
      .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px;}
      .header img{max-height:42px;filter:grayscale(100%) contrast(200%);}
      h1{font-size:15px;text-transform:uppercase;flex-grow:1;text-align:center;margin:0;}
      .summary{display:flex;gap:10px;margin:10px 0 16px;}
      .summary .box{flex:1;border:1px solid #000;padding:6px 10px;text-align:center;}
      .summary .k{font-size:9px;text-transform:uppercase;color:#444;}
      .summary .v{font-size:18px;font-weight:900;}
      h2{font-size:12px;background:#e8e8e8;border:1px solid #000;padding:5px 8px;margin:14px 0 4px;text-transform:uppercase;}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #000;padding:4px 6px;font-size:10px;vertical-align:top;}
      th{background:#dcdcdc;text-transform:uppercase;font-size:9px;}
      .c{text-align:center;}
      .tag{display:inline-block;padding:1px 5px;border:1px solid #000;font-size:9px;font-weight:900;text-transform:uppercase;}
      .tag-t{background:#fde2c8;} .tag-d{background:#cfe3ff;}
      .sign{margin-top:30px;display:flex;justify-content:space-between;gap:40px;}
      .sign .l{flex:1;border-top:1px solid #000;text-align:center;padding-top:4px;font-size:10px;}
      .footer{margin-top:24px;font-size:9px;color:#555;border-top:1px solid #ccc;padding-top:6px;text-align:center;}
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
      <div class="header"><img src="${REALMARKA_LOGO}" alt="${PRINT_BRAND}"/><h1>Relatório Mensal de Trocas e Devoluções<br/><span style="font-size:11px;font-weight:400">${mesNome}</span></h1><div style="font-size:10px;text-align:right">Emissão:<br>${new Date().toLocaleDateString('pt-BR')}</div></div>
      <div class="summary">
        <div class="box"><div class="k">Total de Eventos</div><div class="v">${eventos.length}</div></div>
        <div class="box"><div class="k">Trocas</div><div class="v">${trocas}</div></div>
        <div class="box"><div class="k">Devoluções</div><div class="v">${devolucoes}</div></div>
        <div class="box"><div class="k">Locadoras envolvidas</div><div class="v">${Object.keys(porLocadora).length}</div></div>
      </div>`;

    Object.keys(porLocadora).sort().forEach(loc => {
        html += `<h2>Locadora: ${loc}</h2>`;
        html += `<table><thead><tr>
          <th style="width:10%">Data</th>
          <th style="width:10%">Tipo</th>
          <th style="width:24%">Equipamento</th>
          <th style="width:12%">Patrimônio</th>
          <th style="width:14%">Substituído por</th>
          <th style="width:14%">Responsável</th>
          <th>Observação</th>
        </tr></thead><tbody>`;
        porLocadora[loc].forEach(e => {
            const tagCls = e.tipo === 'TROCA' ? 'tag-t' : 'tag-d';
            html += `<tr>
              <td class="c">${formatBRDate(e.data)}</td>
              <td class="c"><span class="tag ${tagCls}">${e.tipo}</span></td>
              <td>${String(e.loc.tool_name || '-')}</td>
              <td class="c" style="font-family:monospace">${String(e.loc.patrimonio || '-')}</td>
              <td>${String(e.substituido_por || (e.tipo === 'TROCA' ? '—' : '-'))}</td>
              <td>${String(e.loc.responsavel || '-')}</td>
              <td>${String(e.obs || '-')}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });

    html += `<div class="sign"><div class="l">Almoxarife</div><div class="l">Engenharia / Fiscal</div><div class="l">Locadora</div></div>`;
    html += `<div class="footer">${PRINT_BRAND} — Controle de Equipamentos Alugados — Padrão PBQP-H</div></body></html>`;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 500);
};



const printBulkLabels = (items, showMsg, options = {}) => {
    if(!items || items.length === 0) return;
    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) {
        if(showMsg) showMsg("Atenção", "Permita popups para imprimir etiquetas.");
        return;
    }

    const sizeMode = options.sizeMode || 'small'; // 'small' = 3/A4, 'full' = 1/A4
    const labels = options.labels || {};
    const L = {
      rua: labels.rua || 'Rua',
      prateleira: labels.prateleira || 'Prateleira',
      gaveta: labels.gaveta || 'Gaveta',
      unidade: labels.unidade || 'Unidade',
      empreiteira: labels.empreiteira || 'Empreiteira',
      lote: labels.lote || 'Lote',
      validade: labels.validade || 'Validade',
      aplicacao: labels.aplicacao || 'Aplicação',
      categoria: labels.categoria || 'Categoria',
      tonalidade: labels.tonalidade || 'Tonalidade',
      calibre: labels.calibre || 'Calibre',
      pei: labels.pei || 'PEI',
      fabricante: labels.fabricante || 'Fabricante',
      tipo_cp: labels.tipo_cp || 'Tipo CP',
      peso_saco: labels.peso_saco || 'Peso Saco',
    };

    // sizeMode 'small': 3 etiquetas por folha A4 retrato (198x90mm)
    // sizeMode 'full' : 1 etiqueta inteira por folha A4 (paisagem 277x190mm)
    const styleSmall = `
      @page { size: A4 portrait; margin: 8mm 6mm; }
      .label-box { width: 198mm; height: 90mm; padding: 4mm 6mm; }
      .label-box:nth-child(3n) { page-break-after: always; }
      .lbl-title { font-size: 16pt; }
      .prat-v { font-size: 110pt; }
      .side-cell .v { font-size: 18pt; }
    `;
    const styleFull = `
      @page { size: A4 landscape; margin: 10mm; }
      .label-box { width: 277mm; height: 190mm; padding: 10mm 14mm; page-break-after: always; }
      .lbl-title { font-size: 32pt; }
      .prat-v { font-size: 240pt; }
      .side-cell .v { font-size: 36pt; }
      .side-cell { padding: 6mm 8mm !important; }
      .lbl-foot { font-size: 14pt !important; }
      .lbl-foot .k { font-size: 11pt !important; }
      .lbl-logo { height: 22mm !important; max-width: 60mm !important; }
      .lbl-sys { font-size: 12pt !important; }
    `;

    let html = `<html><head><title>Etiquetas Estoque - ${PRINT_BRAND}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .sheet { display: flex; flex-direction: column; gap: 4mm; }
      .label-box { display: flex; flex-direction: column; border: 1.5px dashed #444; border-radius: 2mm; }
      .label-box:last-child { page-break-after: auto; }
      .lbl-head { display:flex; align-items:center; gap:8px; border-bottom: 1.5px solid #000; padding-bottom: 3px; }
      .lbl-logo { height: 12mm; max-width: 36mm; object-fit: contain; filter: grayscale(100%) contrast(160%); }
      .lbl-title { font-weight: 900; text-transform: uppercase; line-height: 1.05; flex:1; word-break: break-word; }
      .lbl-sys { font-size: 8pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color:#444; text-align:right; }
      .lbl-mid { flex:1; display:flex; align-items:center; justify-content:center; gap: 10mm; padding: 2mm 0; }
      .prat-block { text-align:center; flex:1; }
      .prat-k { font-size: 11pt; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color:#000; display:block; }
      .prat-v { font-weight: 900; font-family: 'Arial Black', Impact, sans-serif; line-height: 0.9; color:#000; }
      .side-info { display:flex; flex-direction:column; gap:3mm; min-width: 38mm; }
      .side-cell { border:1.5px solid #000; padding: 2mm 4mm; text-align:center; border-radius:2px; }
      .side-cell .k { font-size: 8pt; font-weight: bold; text-transform: uppercase; color:#444; display:block; }
      .side-cell .v { font-weight: 900; font-family: monospace; }
      .lbl-foot { border-top: 1px solid #000; padding-top: 3px; display:grid; grid-template-columns: 1fr 1fr; gap: 1mm 6mm; font-size: 9pt; }
      .lbl-foot .item { line-height: 1.2; }
      .lbl-foot .k { font-weight: 900; text-transform: uppercase; font-size: 7.5pt; color:#333; letter-spacing: 0.5px; }
      ${sizeMode === 'full' ? styleFull : styleSmall}
    </style></head><body><div class="sheet">`;

    items.forEach(item => {
        const validadeFormatada = item.validade || item.dna_payload?.validade_dna || item.dna_payload?.validade_quimico;
        const lote = item.lote || item.dna_payload?.lote_fabricacao || item.dna_payload?.lote_usina || 'N/A';
        const tpl = item._template || 'PADRAO';
        let extras = '';
        if (tpl === 'REVESTIMENTO') {
          extras = `
                  <div class="item"><span class="k">${L.tonalidade}:</span> ${String(item.tonalidade || '-')}</div>
                  <div class="item"><span class="k">${L.calibre}:</span> ${String(item.calibre || '-')}</div>
                  <div class="item"><span class="k">${L.pei}:</span> ${String(item.pei || '-')}</div>`;
        } else if (tpl === 'ENSACADO') {
          extras = `
                  <div class="item"><span class="k">${L.fabricante}:</span> ${String(item.fabricante || '-')}</div>
                  <div class="item"><span class="k">${L.tipo_cp}:</span> ${String(item.tipo_cp || '-')}</div>
                  <div class="item"><span class="k">${L.peso_saco}:</span> ${String(item.peso_saco || '-')}</div>`;
        } else {
          extras = `
                  <div class="item"><span class="k">${L.aplicacao}:</span> ${String(item.aplicacao || '-')}</div>
                  <div class="item"><span class="k">${L.categoria}:</span> ${String(item.categoria || '-')}</div>`;
        }
        html += `
           <div class="label-box">
               <div class="lbl-head">
                 <img class="lbl-logo" src="${REALMARKA_LOGO}" alt="${PRINT_BRAND}"/>
                 <div class="lbl-title">${String(item.nome)}</div>
                 <div class="lbl-sys">${PRINT_BRAND}<br/><span style="font-weight:400;letter-spacing:0">SKU ${String(item.sku)}</span></div>
               </div>
               <div class="lbl-mid">
                  <div class="side-info">
                    <div class="side-cell"><span class="k">${L.rua}</span><span class="v">${String(item.rua || '-')}</span></div>
                    <div class="side-cell"><span class="k">${L.gaveta}</span><span class="v">${String(item.gaveta || '-')}</span></div>
                  </div>
                  <div class="prat-block">
                    <span class="prat-k">${L.prateleira}</span>
                    <span class="prat-v">${String(item.prateleira || '-')}</span>
                  </div>
                  <div class="side-info">
                    <div class="side-cell"><span class="k">${L.unidade}</span><span class="v">${String(item.unidade || 'UN')}</span></div>
                    <div class="side-cell"><span class="k">${L.empreiteira}</span><span class="v" style="font-size:10pt">${String(item.empreiteira || 'Geral')}</span></div>
                  </div>
               </div>
               <div class="lbl-foot">
                  ${extras}
                  <div class="item"><span class="k">${L.lote}:</span> ${lote}</div>
                  <div class="item"><span class="k">${L.validade}:</span> ${formatBRDate(validadeFormatada)}</div>
               </div>
           </div>
        `;
    });

    html += `</div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};



const printDesperdiciosReport = (desperdicios, produtos, empreiteira = 'ALL', showMsg) => {
    let list = desperdicios || [];
    if (empreiteira !== 'ALL') list = list.filter(d => d.empreiteira === empreiteira);

    if (list.length === 0) {
        if(showMsg) showMsg("Aviso", "Nenhum desperdício encontrado para os filtros atuais.");
        return;
    }

    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) {
        if(showMsg) showMsg("Atenção", "Permita popups para imprimir.");
        return;
    }

    const grouped = list.reduce((acc, item) => {
        const emp = item.empreiteira || 'Geral';
        if (!acc[emp]) acc[emp] = { items: [], total: 0 };
        acc[emp].items.push(item);
        acc[emp].total += Number(item.valor_total || 0);
        return acc;
    }, {});

    let html = `<html><head><title>Relatório de Desperdício e Perdas</title>
    <style>
      body { font-family: Arial, sans-serif; }
      .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .header img { max-height: 40px; filter: grayscale(100%) contrast(200%); }
      h1 { text-align: center; font-size: 18px; text-transform: uppercase; flex-grow: 1;}
      h2 { border-bottom: 1px solid #ccc; font-size: 14px; background: #f0f0f0; padding: 6px; text-transform: uppercase; margin-top: 30px; display: flex; justify-content: space-between;}
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 11px; vertical-align: middle; }
      th { background-color: #e0e0e0; font-weight: bold; text-align: center; }
      .center { text-align: center; }
      .thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ccc; }
      .val { color: #b91c1c; font-weight: bold; }
    </style></head><body>
    <div class="header"><img src="${REALMARKA_LOGO}" alt="${SYSTEM_NAME}"><h1>RELATÓRIO DE DESPERDÍCIO E PERDAS (ISO 9001)</h1><div>Data:<br>${new Date().toLocaleDateString('pt-BR')}</div></div>`;

    let grandTotal = 0;

    Object.keys(grouped).sort().forEach(emp => {
        grandTotal += grouped[emp].total;
        html += `<h2><span>Empreiteira/Centro de Custo: ${String(emp)}</span> <span>Custo Total Perda: R$ ${grouped[emp].total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></h2>`;
        html += `<table><thead><tr><th style="width: 80px;">Evidência</th><th>Produto / Insumo</th><th>Local Encontrado</th><th>Estado/Motivo</th><th style="width: 60px;">Qtd</th><th style="width: 80px;">Custo (R$)</th></tr></thead><tbody>`;
        grouped[emp].items.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(item => {
            const prod = produtos.find(p => p.id === item.produto_id) || { nome: 'Produto Excluído', unidade: 'UN' };
            const imgHtml = item.foto_url ? `<img src="${item.foto_url}" class="thumb" />` : 'S/ Foto';
            html += `<tr>
                <td class="center">${imgHtml}</td>
                <td><strong>${prod.nome}</strong><br><span style="font-size: 9px; color: #555;">Data Registo: ${formatBRDate(item.data)}</span></td>
                <td>${item.local_encontrado}</td>
                <td>${item.estado}<br><span style="font-size: 9px; font-style: italic;">${item.obs||''}</span></td>
                <td class="center font-bold">${item.qtd} ${prod.unidade}</td>
                <td class="center val">R$ ${Number(item.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });

    html += `<div style="margin-top: 30px; text-align: right; font-size: 16px; border-top: 2px solid #000; padding-top: 10px;">
        <strong>CUSTO GLOBAL DE DESPERDÍCIO (FILTRO ATUAL): <span style="color: red;">R$ ${grandTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></strong>
    </div>`;

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 800);
};

// ============================================================================
// FVM - FICHA DE VERIFICAÇÃO DE MATERIAIS (PBQP-H / ISO 9001) - PO 7.10
// Layout oficial Realmarka. Agrupa entradas por mês + empreiteira + fornecedor + NF.
// ============================================================================
const FVM_CATEGORIAS = [
  'MATERIAIS DE LIMPEZA','EPI / EPC','FERRAGENS','HIDRÁULICO','ELÉTRICO',
  'AGREGADOS','AÇO E ARMADURAS','FORMAS E ESCORAMENTOS','CIMENTO E ARGAMASSAS',
  'IMPERMEABILIZAÇÃO','REVESTIMENTOS CERÂMICOS','TINTAS E VERNIZES','MADEIRAS',
  'ESQUADRIAS','VIDROS','GESSO E DRYWALL','TUBOS E CONEXÕES','LOUÇAS E METAIS',
  'FERRAMENTAS MANUAIS','EQUIPAMENTOS / MAQUINÁRIO','SOLDA','SISTEMAS DE COMBATE A INCÊNDIO',
  'COMBUSTÍVEIS E LUBRIFICANTES','OUTROS'
];

// ============================================================================
// BASE DE CONHECIMENTO PBQP-H — auto-classifica material por nome.
// Define: categoria interna, categoria FVM, unidade padrão, rastreabilidade,
// exigências (certificado/FVM/lote/fabricante) e classe PBQP-H.
// ============================================================================
const PBQPH_KB = [
  { rx:/(VASSOURA|RODO|DESINFET|SAB[AÃ]O|DETERGENTE|[ÁA]LCOOL|LIMPEZA|PANO)/i, categoria:'Limpeza e Conservação', categoria_fvm:'MATERIAIS DE LIMPEZA', unidade:'UN', rastreavel:false, exigeCertificado:false, exigeFVM:false, exigeLote:false, exigeFabricante:false, classe:'Apoio' },
  { rx:/(CAPACETE|CINTUR[AÃ]O|TALABARTE|[ÓO]CULOS|BOTINA|LUVA|PROTETOR|M[ÁA]SCARA|RESPIRADOR|EPI|EPC)/i, categoria:'EPI - Proteção de Mãos e Pés', categoria_fvm:'EPI / EPC', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - EPI/CA' },
  { rx:/(VERGALH[AÃ]O|CA\s?50|CA\s?60|TELA SOLD|TRELI[ÇC]A|BARRA ROSCADA|ARAME RECOZ)/i, categoria:'Aço e Armaduras (Vergalhão/Tela/Estribo)', categoria_fvm:'AÇO E ARMADURAS', unidade:'KG', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Estrutural' },
  { rx:/(CIMENTO|CP\s?(II|III|V)|PORTLAND)/i, categoria:'Aglomerantes (Cimento/Cal/Gesso)', categoria_fvm:'CIMENTO E ARGAMASSAS', unidade:'SC', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Estrutural' },
  { rx:/(ARGAMASSA|REJUNTE|GRAUTE|AC[123])/i, categoria:'Argamassas e Rejuntes', categoria_fvm:'CIMENTO E ARGAMASSAS', unidade:'SC', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Estrutural' },
  { rx:/(AREIA|BRITA|PEDRISCO|P[ÓO] DE PEDRA|AGREGADO)/i, categoria:'Agregados (Areia/Brita/Pedrisco)', categoria_fvm:'AGREGADOS', unidade:'M3', rastreavel:false, exigeCertificado:false, exigeFVM:false, exigeLote:false, exigeFabricante:false, classe:'Apoio' },
  { rx:/(TUBO\s?(PVC|PPR)|PVC SOLD|PVC ESGOTO|CURVA PVC|JOELHO|LUVA PVC|CONEX[AÃ]O)/i, categoria:'Hidráulica - Tubos e Conexões', categoria_fvm:'TUBOS E CONEXÕES', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante - Hidráulico' },
  { rx:/(REGISTRO|TORNEIRA|CAIXA SIFONADA|CAIXA DE GORDURA|LAVAT[ÓO]RIO|VASO SANIT|MICTOR)/i, categoria:'Hidráulica - Louças e Metais Sanitários', categoria_fvm:'LOUÇAS E METAIS', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante - Hidráulico' },
  { rx:/(CABO|FIO\s|FLEX[ÍI]VEL|PP\s)/i, categoria:'Elétrica - Cabos e Fios', categoria_fvm:'ELÉTRICO', unidade:'M', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Elétrico' },
  { rx:/(DISJUNTOR|QUADRO EL[ÉE]TRICO|TOMADA|INTERRUPTOR|ELETRODUTO|PERFILADO|CANALETA|L[ÂA]MPADA)/i, categoria:'Elétrica - Eletrodutos e Quadros', categoria_fvm:'ELÉTRICO', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Elétrico' },
  { rx:/(MANTA ASF[ÁA]LTICA|PRIMER|MEMBRANA L[ÍI]QUIDA|SELANTE PU|IMPERMEABIL)/i, categoria:'Impermeabilizantes', categoria_fvm:'IMPERMEABILIZAÇÃO', unidade:'M2', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Vedação' },
  { rx:/(CHAPA ST|CHAPA RU|CHAPA RF|DRYWALL|MONTANTE|GUIA DRY|GESSO)/i, categoria:'Forros (Gesso/PVC/Mineral)', categoria_fvm:'GESSO E DRYWALL', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante' },
  { rx:/(PORCELANATO|CER[ÂA]MICA|AZULEJO|RODAP[ÉE]|PISO\s)/i, categoria:'Revestimentos Cerâmicos e Porcelanatos', categoria_fvm:'REVESTIMENTOS CERÂMICOS', unidade:'M2', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante - Acabamento' },
  { rx:/(PORTA|JANELA|GUARDA-CORPO|ESQUADRIA|CORTA-FOGO)/i, categoria:'Esquadrias (Portas/Janelas)', categoria_fvm:'ESQUADRIAS', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Segurança' },
  { rx:/(TINTA|VERNIZ|SELADOR|ESMALTE|MASSA CORRIDA|TEXTURA)/i, categoria:'Pintura e Texturas', categoria_fvm:'TINTAS E VERNIZES', unidade:'L', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante - Acabamento' },
  { rx:/(MADEIRA|T[ÁA]BUA|RIPA|SARRAFO|COMPENSADO)/i, categoria:'Madeiras e Compensados', categoria_fvm:'MADEIRAS', unidade:'PC', rastreavel:false, exigeCertificado:false, exigeFVM:false, exigeLote:false, exigeFabricante:false, classe:'Apoio' },
  { rx:/(PARAFUSO|PORCA|ARRUELA|PREGO|BUCHA|DOBRADI[ÇC]A|FECHADURA|ESPA[ÇC]ADOR)/i, categoria:'Ferragens e Fixadores (Parafusos/Buchas)', categoria_fvm:'FERRAGENS', unidade:'UN', rastreavel:false, exigeCertificado:false, exigeFVM:false, exigeLote:false, exigeFabricante:false, classe:'Apoio' },
  { rx:/(SOLDA|ELETRODO)/i, categoria:'Serralheria e Soldagem', categoria_fvm:'SOLDA', unidade:'KG', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante' },
  { rx:/(EXTINTOR|MANGUEIRA INC[ÊE]NDIO|HIDRANTE)/i, categoria:'Sistemas de Combate a Incêndio', categoria_fvm:'SISTEMAS DE COMBATE A INCÊNDIO', unidade:'UN', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Crítico - Segurança' },
  { rx:/(DIESEL|GASOLINA|[ÓO]LEO|LUBRIFIC|GRAXA)/i, categoria:'Outros', categoria_fvm:'COMBUSTÍVEIS E LUBRIFICANTES', unidade:'L', rastreavel:true, exigeCertificado:true, exigeFVM:true, exigeLote:true, exigeFabricante:true, classe:'Importante' },
  { rx:/(MARTELO|CHAVE|ALICATE|TRENA|N[ÍI]VEL|FURADEIRA|ESMERILHADEIRA|SERRA)/i, categoria:'Ferramentas Manuais', categoria_fvm:'FERRAMENTAS MANUAIS', unidade:'UN', rastreavel:false, exigeCertificado:false, exigeFVM:false, exigeLote:false, exigeFabricante:false, classe:'Apoio' },
];

const classifyMaterialPBQPH = (nome = '') => {
  const n = String(nome).toUpperCase();
  for (const r of PBQPH_KB) {
    if (r.rx.test(n)) {
      const { rx, ...rest } = r;
      return rest;
    }
  }
  return { categoria: 'Outros', categoria_fvm: 'OUTROS', unidade: 'UN', rastreavel: false, exigeCertificado: false, exigeFVM: false, exigeLote: false, exigeFabricante: false, classe: 'Não classificado' };
};

// Compat: mantém função antiga para FVM
const inferCategoriaFVM = (nome = '') => classifyMaterialPBQPH(nome).categoria_fvm;

const parseXmlNumber = (value, fallback = 0) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveMaterialDNAType = (item = {}, kb = {}) => {
  const explicit = String(item.rig_classificacao || '').trim();
  if (explicit && DNA_TEMPLATES[explicit]) return explicit;
  const text = `${item.descricao || ''} ${item.almox_categoria || ''} ${kb.categoria || ''} ${kb.categoria_fvm || ''} ${explicit}`.toUpperCase();
  if (/CONCRET|FCK|SLUMP/.test(text)) return 'Estruturais de Base e Concretagem';
  if (/AÇO|ACO|VERGALH|CA\s?50|CA\s?60|TELA SOLD|TRELI/.test(text)) return 'Aço e Protensão';
  if (/CIMENTO|ARGAMASSA|GRAUTE|REJUNTE|CP\s?(II|III|V)|AC[123]/.test(text)) return 'Cimentícios e Ensacados';
  if (/REVEST|PORCELAN|CER[ÂA]MIC|AZULEJO|PISO|CALIBRE|TONALIDADE/.test(text)) return 'Alvenaria e Revestimentos Cerâmicos';
  if (/TUBO|CONEX|HIDR[ÁA]UL|CABO|FIO|DISJUNTOR|EL[ÉE]TRIC|ELETRODUTO|G[ÁA]S/.test(text)) return 'Instalações (Elétrica, Gás, Hidráulica)';
  return kb.rastreavel ? 'Cimentícios e Ensacados' : '';
};

const buildDnaPayloadFromXml = (item = {}) => {
  const payload = {};
  if (item.rig_concretagem?.fck) payload.fck = item.rig_concretagem.fck;
  if (item.rig_concretagem?.slump) payload.slump = item.rig_concretagem.slump;
  if (item.rig_concretagem?.lote_usina) payload.lote_usina = item.rig_concretagem.lote_usina;
  if (item.rig_concretagem?.volume) payload.volume = item.rig_concretagem.volume;
  if (item.rig_aco?.corrida_lote) payload.corrida_lote = item.rig_aco.corrida_lote;
  if (item.rig_aco?.bitola) payload.bitola = item.rig_aco.bitola;
  if (item.rig_aco?.ca_categoria) payload.ca = item.rig_aco.ca_categoria;
  if (item.rig_aco?.fabricante) payload.fabricante = item.rig_aco.fabricante;
  if (item.rig_lote) { payload.lote_fabricacao = item.rig_lote; payload.lote_referencia = item.rig_lote; }
  if (item.rig_validade) { payload.validade_dna = String(item.rig_validade).split('T')[0]; }
  if (item.rig_data_fabricacao) payload.data_fabricacao = String(item.rig_data_fabricacao).split('T')[0];
  if (item.rig_certificado) payload.certificado = item.rig_certificado;
  if (item.almox_marca) payload.marca_modelo = item.almox_marca;
  if (item.ncm) payload.norma = item.ncm;
  return payload;
};

const normalizeXmlProductForReview = (item = {}, nf = {}, produtosExistentes = []) => {
  const kb = classifyMaterialPBQPH(item.descricao || '');
  const match = (produtosExistentes || []).find(p => String(p.sku).toLowerCase() === String(item.codigo || '').toLowerCase() && item.codigo);
  const dnaType = resolveMaterialDNAType(item, kb);
  return {
    codigo: item.codigo || '',
    descricao: item.descricao || '',
    unidade: (item.unidade || kb.unidade || 'UN').toUpperCase(),
    qtd: parseXmlNumber(item.qtd, 0),
    valorUnitario: parseXmlNumber(item.valorUnitario, 0),
    lote: item.rig_lote || '',
    validade: item.rig_validade ? String(item.rig_validade).split('T')[0] : '',
    categoria: item.almox_categoria || kb.categoria,
    categoria_fvm: kb.categoria_fvm,
    classe_pbqph: kb.classe,
    local_armazenamento: item.almox_area_estocagem || AREAS_ESTOCAGEM[0],
    aplicacao: item.almox_aplicacao || '',
    empreiteira: item.almox_empreiteira || '',
    estoque_minimo: item.almox_estoque_minimo || 5,
    fornecedor_nf: item.rig_fornecedor_nf || `${nf.emitente?.razao || ''} - NF ${nf.numeroNF || ''}`.trim(),
    rastreavel: item.rig_ativar_dna || kb.rastreavel,
    exige_certificado: kb.exigeCertificado,
    exige_fvm: kb.exigeFVM,
    exige_lote: kb.exigeLote,
    exige_fabricante: kb.exigeFabricante,
    dna_type: dnaType,
    dna_payload: buildDnaPayloadFromXml(item),
    linkedSkuId: match ? match.id : 'NEW',
    selected: true,
  };
};

const printFVMReport = ({ produtos, movimentacoes, mes, dataInicio, dataFim, empreiteira, categoria, skuFiltro, titulo, showMsg }) => {
  let inicio = null, fim = null, mesNome = '';
  if (dataInicio || dataFim) {
    inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : new Date('1970-01-01');
    fim = dataFim ? new Date(`${dataFim}T23:59:59`) : new Date('2999-12-31');
    mesNome = `${dataInicio ? formatBRDate(dataInicio) : '...'} a ${dataFim ? formatBRDate(dataFim) : '...'}`;
  } else if (mes) {
    const [ano, mm] = mes.split('-');
    if (!ano || !mm) { showMsg && showMsg('FVM', 'Selecione o mês de referência.'); return; }
    inicio = new Date(`${ano}-${mm}-01T00:00:00`);
    fim = new Date(inicio); fim.setMonth(fim.getMonth() + 1);
    mesNome = inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  } else if (skuFiltro) {
    inicio = new Date('1970-01-01'); fim = new Date('2999-12-31'); mesNome = 'HISTÓRICO COMPLETO';
  } else {
    showMsg && showMsg('FVM', 'Informe um período (mês ou intervalo de datas) ou um item específico.'); return;
  }

  const catUpper = categoria && categoria !== 'ALL' ? String(categoria).toUpperCase() : null;
  const entradas = (movimentacoes || []).filter(m => {
    if (m.tipo !== 'ENTRADA') return false;
    const d = new Date(m.data); if (isNaN(d) || d < inicio || d >= fim) return false;
    const p = produtos.find(x => x.id === m.sku || x.sku === m.sku);
    if (!p) return false;
    if (empreiteira && empreiteira !== 'ALL' && (p.empreiteira || 'Sem Empreiteira') !== empreiteira) return false;
    if (catUpper) {
      const pc = (p.categoria_fvm || inferCategoriaFVM(p.nome) || '').toUpperCase();
      if (pc !== catUpper) return false;
    }
    if (skuFiltro && p.id !== skuFiltro && p.sku !== skuFiltro) return false;
    return true;
  });
  if (entradas.length === 0) { showMsg && showMsg('FVM', 'Nenhuma entrada de material encontrada para este filtro.'); return; }

  const grupos = {};
  entradas.forEach(m => {
    const p = produtos.find(x => x.id === m.sku || x.sku === m.sku) || {};
    const cat = (p.categoria_fvm || inferCategoriaFVM(p.nome)).toUpperCase();
    const fornNF = String(p.fornecedor_nf || m.origem || '');
    const fornecedor = (fornNF.split(' - NF ')[0] || fornNF || '—').toUpperCase();
    const nf = (m.origem?.match(/NF[\s-]?e?\s*([0-9]+)/i)?.[1]) || (fornNF.match(/NF\s*([0-9]+)/i)?.[1]) || '—';
    const oc = p.ordem_compra || m.ordem_compra || '—';
    const anexo = p.anexo_nf_url || '';
    const anexoNome = p.anexo_nf_nome || '';
    const key = `${cat}|${fornecedor}|${nf}|${oc}|${p.id||''}`;
    if (!grupos[key]) grupos[key] = { cat, fornecedor, nf, oc, anexo, anexoNome, itens: [], dataRecebimento: m.data };
    grupos[key].itens.push({ qtd: m.qtd, un: p.unidade || 'UN', nome: p.nome || m.sku });
    if (new Date(m.data) > new Date(grupos[key].dataRecebimento)) grupos[key].dataRecebimento = m.data;
  });

  const w = window.open('', '', 'height=900,width=1300');
  if (!w) { showMsg && showMsg('Aviso','Permita popups para imprimir.'); return; }

  const fichas = Object.values(grupos).map((g, idx) => {
    const itensHtml = g.itens.map((it, i) => `<b>${i+1}.</b> ${it.qtd} ${it.un} - ${it.nome}`).join('<br/>');
    const codigo = String(800000 + ((idx + Date.now()) % 1000)).padStart(6,'0');
    const anexoLinha = g.anexo
      ? `<tr><td colspan="8" class="anexo"><b>📎 ANEXO NF:</b> ${g.anexoNome || 'Documento anexado'} — <a href="${g.anexo}" target="_blank">Abrir documento</a>${/^data:image|\.(png|jpe?g)/i.test(g.anexo) ? `<div class="anexo-img"><img src="${g.anexo}" alt="NF"/></div>` : ''}</td></tr>`
      : '';
    return `
    <table class="fvm">
      <tr>
        <td class="logo" rowspan="2"><img src="${REALMARKA_LOGO}" alt="Realmarka"/></td>
        <td class="title" colspan="6"><b>INSPEÇÃO DE MATERIAL</b><br/>FVM - ${g.cat}</td>
        <td class="po"><b>PO: 7.10 ESPECIFICAÇÃO DE MATERIAL</b><div class="cod">Cód: ${codigo}</div></td>
      </tr>
      <tr>
        <td class="meta" colspan="3"><b>OBRA:</b> REALMARKA</td>
        <td class="meta" colspan="3"><b>LOCAL DE ARMAZENAMENTO:</b> ALMOXARIFADO</td>
        <td class="meta"><b>DATA DO RECEBIMENTO:</b> <u>${formatBRDate(g.dataRecebimento)}</u></td>
      </tr>
      <tr class="th">
        <th>FORNECEDOR</th><th>Nº NF</th><th>ORDEM DE COMPRA</th><th>ITENS RECEBIDOS</th>
        <th>ASPECTO GERAL</th><th>QUANTIDADE</th><th>ESPECIFICAÇÃO</th><th>OBS</th>
      </tr>
      <tr>
        <td class="forn"><b>${g.fornecedor}</b></td>
        <td class="c"><b>${g.nf}</b></td>
        <td class="c"><b>${g.oc}</b></td>
        <td class="itens">${itensHtml}</td>
        <td class="ag big">A</td>
        <td class="ag big">A</td>
        <td class="ag big">A</td>
        <td></td>
      </tr>
      ${anexoLinha}
      <tr>
        <td colspan="8" class="legenda">
          <b>LEGENDA:</b> <span class="bx">A - Aceito</span> <span class="bx">R - Rejeitado</span>
          <div class="ac"><b>Ação corretiva:</b> <i>Material inspecionado e aceito sem inconformidades.</i></div>
        </td>
      </tr>
      <tr>
        <td colspan="4" class="ft"><b>Data de fechamento:</b> <u>${formatBRDate(g.dataRecebimento)}</u></td>
        <td colspan="4" class="ft sig">
          <div class="sigline">_____________________________________</div>
          <div><b>Almoxarife responsável (nome e assinatura)</b></div>
        </td>
      </tr>
    </table>`;
  }).join('<div class="pb"></div>');

  const cabecalho = titulo || `RELATÓRIO FVM PBQP-H — ${empreiteira === 'ALL' || !empreiteira ? 'TODAS EMPREITEIRAS' : empreiteira}${catUpper ? ' — ' + catUpper : ''} — ${mesNome}`;

  w.document.write(`<html><head><title>FVM ${mesNome}</title>
  <style>
    @page { size: A4 landscape; margin: 0.8cm; }
    body { font-family: Arial, sans-serif; color:#000; margin:0; }
    .pb { page-break-after: always; }
    table.fvm { width:100%; border-collapse:collapse; margin-bottom:8px; }
    table.fvm td, table.fvm th { border:1.5px solid #000; padding:6px; vertical-align:middle; font-size:11px; }
    .logo { width:140px; text-align:center; padding:8px !important; }
    .logo img { max-width:130px; max-height:55px; }
    .title { text-align:center; font-size:14px; }
    .po { width:200px; text-align:center; font-size:10px; }
    .cod { font-size:9px; margin-top:4px; }
    .meta { font-size:10px; }
    .th th { background:#eee; text-align:center; font-size:10px; font-weight:bold; }
    .c { text-align:center; font-weight:bold; }
    .forn { font-size:11px; }
    .itens { font-size:11px; }
    .ag.big { text-align:center; font-size:32px; font-weight:bold; }
    .legenda { font-size:11px; padding:8px !important; }
    .legenda .bx { border:1px solid #000; padding:2px 8px; margin-right:8px; display:inline-block; }
    .legenda .ac { margin-top:8px; }
    .anexo { font-size:10px; padding:6px 8px !important; background:#fafafa; }
    .anexo a { color:#0645ad; text-decoration:underline; }
    .anexo-img { margin-top:4px; }
    .anexo-img img { max-height:130px; max-width:380px; border:1px solid #999; }
    .ft { padding:14px 8px 6px !important; font-size:11px; }
    .ft.sig { text-align:right; }
    .sigline { margin-bottom:2px; }
  </style></head><body>
    <div style="text-align:center;font-size:13px;font-weight:bold;margin:6px 0 10px;">
      ${cabecalho}
    </div>
    ${fichas}
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 800);
};

// Relatório de Rastreabilidade (itens controlados + histórico de movimentação)
const printRastreabilidadeReport = ({ produtos, movimentacoes, showMsg, itemUnico = null }) => {
  const lista = itemUnico ? [itemUnico] : (produtos || []).filter(p => !!p.rastreavel && String(p.ativo) !== 'false');
  if (lista.length === 0) { showMsg && showMsg('Rastreabilidade', 'Nenhum item rastreável encontrado.'); return; }
  const w = window.open('', '', 'height=900,width=1200');
  if (!w) { showMsg && showMsg('Aviso','Permita popups para imprimir.'); return; }
  const grupos = {};
  lista.forEach(p => {
    const cat = (p.categoria_fvm || inferCategoriaFVM(p.nome) || 'OUTROS').toUpperCase();
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  });
  const blocos = Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0])).map(([cat, itens]) => {
    const linhas = itens.map(p => {
      const movs = (movimentacoes || []).filter(m => m.sku === p.id || m.sku === p.sku).sort((a,b)=>new Date(b.data)-new Date(a.data));
      const dnaTxt = Object.entries(p.dna_payload || {}).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' • ') || '—';
      const histLinhas = movs.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:#666;">Sem movimentações registradas.</td></tr>`
        : movs.slice(0,40).map(m => `<tr><td>${formatBRDate(m.data)}</td><td>${m.tipo}</td><td class="c">${m.qtd}</td><td>${m.destino||m.origem||'—'}</td><td>${m.responsavel||'—'}</td></tr>`).join('');
      return `
        <div class="item">
          <table class="hdr"><tr>
            <td><b>${p.nome}</b><br/><span class="meta">SKU ${p.sku} · ${p.unidade} · Saldo ${p.saldo_atual||0}</span></td>
            <td class="r"><b>Lote:</b> ${p.lote||'—'} &nbsp; <b>Validade:</b> ${formatBRDate(p.validade)}<br/>
              <b>NF:</b> ${p.fornecedor_nf||'—'} &nbsp; <b>OC:</b> ${p.ordem_compra||'—'}</td>
          </tr></table>
          <div class="dna"><b>DNA (${p.dna_type||'—'}):</b> ${dnaTxt}</div>
          <table class="hist">
            <tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Origem/Destino</th><th>Responsável</th></tr>
            ${histLinhas}
          </table>
        </div>`;
    }).join('');
    return `<h2 class="cat">${cat}</h2>${linhas}`;
  }).join('');
  w.document.write(`<html><head><title>Rastreabilidade PBQP-H</title>
  <style>
    @page { size: A4; margin: 1cm; }
    body { font-family: Arial, sans-serif; color:#000; margin:0; }
    h1 { font-size:16px; text-align:center; margin:0 0 12px; }
    h2.cat { font-size:13px; background:#222; color:#fff; padding:6px 10px; margin:14px 0 6px; }
    .item { border:1px solid #000; padding:8px; margin-bottom:8px; page-break-inside:avoid; }
    table.hdr { width:100%; border-collapse:collapse; margin-bottom:6px; }
    table.hdr td { padding:4px; font-size:11px; vertical-align:top; }
    table.hdr td.r { text-align:right; }
    .meta { font-size:10px; color:#444; }
    .dna { font-size:10px; background:#f4f4f4; padding:4px 6px; margin-bottom:6px; border-left:3px solid #6b21a8; }
    table.hist { width:100%; border-collapse:collapse; font-size:10px; }
    table.hist th, table.hist td { border:1px solid #555; padding:3px 5px; }
    table.hist th { background:#e8e8e8; }
    .c { text-align:center; }
  </style></head><body>
    <h1>RELATÓRIO DE RASTREABILIDADE PBQP-H / ISO 9001${itemUnico ? ' — ' + itemUnico.nome : ''}</h1>
    ${blocos}
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(()=>w.print(), 600);
};


const parseXMLNFe = async (file) => {
    try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) throw new Error('Arquivo XML inválido ou mal formatado.');

        const getTextContent = (parent, tagName) => {
            const element = parent?.getElementsByTagName(tagName)?.[0];
            return element?.textContent?.trim() || '';
        };

        const infNFe = xmlDoc.getElementsByTagName('infNFe')[0] || xmlDoc.getElementsByTagName('NFe')[0];
        if (!infNFe) throw new Error('Não foi possível encontrar dados de NF-e no arquivo.');

        const ide = infNFe.getElementsByTagName('ide')[0];
        const emit = infNFe.getElementsByTagName('emit')[0];
        const dest = infNFe.getElementsByTagName('dest')[0];
        const detList = infNFe.getElementsByTagName('det');

        const numeroNF = getTextContent(ide, 'nNF');
        const serie = getTextContent(ide, 'serie');
        const dataEmissao = getTextContent(ide, 'dhEmi') || getTextContent(ide, 'dEmi');
        const chaveAcesso = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

        const razaoEmitente = getTextContent(emit, 'xNome');
        const cnpjEmitente = getTextContent(emit, 'CNPJ');

        const produtos = [];
        const getInDescendant = (parent, selector) => {
            if (!parent) return '';
            try {
                const n = parent.querySelector(selector);
                return n ? n.textContent.trim() : '';
            } catch { return ''; }
        };
        for (let i = 0; i < detList.length; i++) {
            const det = detList[i];
            const prod = det.getElementsByTagName('prod')[0];
            // Tags estendidas (NF-e enriquecida pelo nosso XML / IA): dados_almox + controle_rigoroso
            const almox = det.querySelector('dados_almox');
            const rigoroso = almox ? almox.querySelector('controle_rigoroso') : null;
            const item = {
                codigo: getTextContent(prod, 'cProd'),
                descricao: getTextContent(prod, 'xProd'),
                ncm: getTextContent(prod, 'NCM'),
                cfop: getTextContent(prod, 'CFOP'),
                unidade: getTextContent(prod, 'uCom'),
                qtd: parseXmlNumber(getTextContent(prod, 'qCom'), 1),
                valorUnitario: parseXmlNumber(getTextContent(prod, 'vUnCom'), 0),
                valorTotal: parseXmlNumber(getTextContent(prod, 'vProd'), 0),
                // Bloco ALMOX (preenchido se a NF-e carregar tags <dados_almox>)
                almox_categoria: getInDescendant(almox, 'categoria'),
                almox_empreiteira: getInDescendant(almox, 'empreiteira'),
                almox_area_estocagem: getInDescendant(almox, 'localizacao_sugerida > area_estocagem'),
                almox_aplicacao: getInDescendant(almox, 'aplicacao_uso'),
                almox_estoque_minimo: parseInt(getInDescendant(almox, 'estoque_minimo') || '0', 10) || 0,
                almox_observacoes: getInDescendant(almox, 'observacoes_adicionais'),
                // Bloco CONTROLE RIGOROSO (PBQP-H / DNA)
                rig_ativar_dna: getInDescendant(rigoroso, 'ativar_dna_material') === 'true',
                rig_fornecedor_nf: getInDescendant(rigoroso, 'fornecedor_nf'),
                rig_lote: getInDescendant(rigoroso, 'lote_identificador'),
                rig_validade: getInDescendant(rigoroso, 'data_validade'),
                rig_data_fabricacao: getInDescendant(rigoroso, 'data_fabricacao'),
                rig_certificado: getInDescendant(rigoroso, 'certificado'),
                rig_classificacao: getInDescendant(rigoroso, 'classificacao_estrutural'),
                almox_marca: getInDescendant(almox, 'marca'),
                rig_concretagem: rigoroso ? {
                    fck: getInDescendant(rigoroso, 'detalhes_concretagem > fck'),
                    slump: getInDescendant(rigoroso, 'detalhes_concretagem > slump'),
                    lote_usina: getInDescendant(rigoroso, 'detalhes_concretagem > usina_rastreio'),
                    volume: getInDescendant(rigoroso, 'detalhes_concretagem > volume_m3'),
                } : null,
                rig_aco: rigoroso ? {
                    corrida_lote: getInDescendant(rigoroso, 'detalhes_aco > corrida_lote'),
                    bitola: getInDescendant(rigoroso, 'detalhes_aco > bitola'),
                    ca_categoria: getInDescendant(rigoroso, 'detalhes_aco > ca_categoria'),
                    fabricante: getInDescendant(rigoroso, 'detalhes_aco > fabricante'),
                } : null,
            };
            produtos.push(item);
        }

        const total = infNFe.getElementsByTagName('total')[0];
        const icmsTot = total?.getElementsByTagName('ICMSTot')[0];
        const valorTotalNF = getTextContent(icmsTot, 'vNF');

        return {
            success: true,
            tipo: 'NFe',
            numeroNF,
            serie,
            dataEmissao,
            chaveAcesso,
            emitente: { razao: razaoEmitente, cnpj: cnpjEmitente },
            destinatario: { razao: getTextContent(dest, 'xNome'), cnpj: getTextContent(dest, 'CNPJ') || getTextContent(dest, 'CPF') },
            produtos,
            valorTotal: valorTotalNF,
            raw: { xmlDoc, infNFe }
        };
    } catch (error) {
        console.error('Erro ao parsear XML:', error);
        throw new Error(`Erro ao ler arquivo XML: ${error.message}`);
    }
};

// ============================================================================
// 5. COMPONENTES VISUAIS REUTILIZÁVEIS E MODAL DE ALERTAS
// ============================================================================

const DialogModal = ({ title, message, isConfirm, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          {isConfirm ? <AlertTriangle className="text-yellow-500"/> : <AlertCircle className="text-blue-500"/>}
          {title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
      </div>
      <div className="bg-gray-950 px-6 py-4 flex justify-end gap-3 border-t border-gray-800">
        {isConfirm && <button onClick={onCancel} className="px-4 py-2 rounded-lg font-bold text-gray-400 hover:bg-gray-800 transition">Cancelar</button>}
        <button onClick={onConfirm} className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition">OK</button>
      </div>
    </div>
  </div>
);

const Spinner = () => <div className="flex items-center justify-center p-2"><Cpu className={`w-5 h-5 animate-spin ${ACCENT_COLOR}`} /><span className={`${TEXT_LIGHT} ml-2 text-sm font-bold`}>Processando...</span></div>;

const Card = ({ children, title, icon: Icon, className = "", onClick = undefined }) => (
  <div className={`p-4 md:p-6 rounded-xl shadow-lg ${BG_DARK} ${TEXT_LIGHT} border border-yellow-800/50 ${className} print:border-none print:shadow-none print:bg-white print:text-black print:p-0 transition-all ${onClick ? 'cursor-pointer hover:border-yellow-500' : ''}`} onClick={onClick}>
    {title && <h2 className={`text-xl font-bold mb-4 ${ACCENT_COLOR} print:text-black print:text-2xl print:border-b print:border-black print:pb-2 flex items-center gap-2`}>{Icon && <Icon className="w-5 h-5"/>} {String(title)}</h2>}
    {children}
  </div>
);

const Button = ({ children, className = "", variant = "primary", ...props }) => {
  const variants = {
    primary: "bg-yellow-500 text-gray-900 hover:bg-yellow-600 shadow-yellow-500/30",
    secondary: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
    danger: "bg-red-600 text-white hover:bg-red-500 shadow-red-500/20",
    outline: "border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
  };
  return (
    <button {...props} className={`px-4 py-2 rounded-lg font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg print:hidden ${variants[variant] || variants.primary} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, className = "", list, ...props }) => (
  <div className={`w-full ${className}`}>
      {label && <label className="block text-xs font-medium text-gray-400 mb-1">{String(label)} {props.required && <span className="text-yellow-500">*</span>}</label>}
      <input {...props} list={list} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors print:hidden disabled:opacity-50 outline-none" />
  </div>
);

const Select = ({ label, className = "", options = [], description, ...props }) => (
  <div className={`w-full ${className}`}>
      {label && <label className="block text-xs font-medium text-gray-400 mb-1">{String(label)} {props.required && <span className="text-yellow-500">*</span>}</label>}
      <select {...props} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors print:hidden disabled:opacity-50 outline-none">
        {props.children}
        {options.length > 0 && options.map((opt, idx) => (
           <option key={idx} value={opt?.value ?? opt}>{String(opt?.label ?? opt)}</option>
        ))}
      </select>
      {description && <p className="mt-1.5 text-[11px] text-zinc-500 leading-tight italic">{String(description)}</p>}
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Rascunho': 'bg-zinc-800 text-yellow-500 border-zinc-700',
    'Aprovado': 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50',
    'Em Curso': 'bg-blue-950/40 text-blue-300 border-blue-900/60',
    'Concluída': 'bg-teal-950/40 text-teal-300 border-teal-900/60',
    'Reprovado': 'bg-red-950/30 text-red-400 border-red-900/50'
  };
  const Icons = { 'Rascunho': Clock, 'Aprovado': CheckCircle, 'Em Curso': RefreshCw, 'Concluída': CheckSquare, 'Reprovado': XCircle };
  const IconComponent = Icons[status] || Clock;

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 w-fit ${styles[status] || styles['Rascunho']}`}>
      <IconComponent size={14} /> {String(status)}
    </span>
  );
};

// Identifica erros de DOM causados por extensões do navegador (Google Tradutor,
// ad-blockers, etc.) que reordenam nós e quebram a reconciliação do React.
// Esses erros são inócuos para os dados — basta remontar a árvore.
const isBenignDomMutationError = (err) => {
  const msg = String(err?.message || err || '');
  return /insertBefore|removeChild|appendChild|Failed to execute|não é filho deste nó|is not a child of this node|NotFoundError/i.test(msg);
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recoverKey: 0 };
  }
  static getDerivedStateFromError(error) {
    if (isBenignDomMutationError(error)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    if (isBenignDomMutationError(error)) {
      console.warn('[ErrorBoundary] Erro de DOM ignorado (extensão do navegador):', error?.message);
      // Força uma remontagem silenciosa para limpar nós órfãos
      this.setState((s) => ({ hasError: false, error: null, recoverKey: s.recoverKey + 1 }));
      return;
    }
    console.error('Erro capturado na interface:', error, errorInfo);
  }

  handleEmergencyBackup = async () => {
    try {
      const exportData = {};
      for (const col of COLLECTIONS) {
        exportData[col] = await AppDB.getAll(col);
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `EMERGENCIA_RMK_${new Date().getTime()}.json`;
      a.click();
    } catch (e) {
      alert('Falha ao exportar dados da nuvem: ' + e.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-white bg-red-950 min-h-screen flex flex-col items-center justify-center">
          <AlertTriangle className="w-20 h-20 text-red-500 mb-4 animate-bounce" />
          <h1 className="text-3xl font-black text-red-400 mb-2">Falha Inesperada</h1>
          <p className="text-red-200 mb-8 max-w-md">Algo interrompeu a interface. Os seus dados estão a salvo na nuvem. Pode continuar usando o sistema ou exportar um backup.</p>
          <div className="flex gap-3 mb-8">
            <button onClick={() => this.setState((s) => ({ hasError: false, error: null, recoverKey: s.recoverKey + 1 }))} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl flex items-center gap-2 shadow-2xl border border-green-400 transition-all">
              <RefreshCw size={20} /> Continuar
            </button>
            <button onClick={this.handleEmergencyBackup} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl flex items-center gap-2 shadow-2xl border border-blue-400 transition-all">
              <Download size={20} /> Exportar Backup
            </button>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700">Recarregar</button>
          </div>
          <div className="mt-2 p-4 bg-black/50 rounded-lg text-left max-w-2xl w-full border border-red-900/50">
            <p className="text-xs text-red-400 font-mono overflow-auto">{String(this.state.error?.message || 'Erro Desconhecido')}</p>
          </div>
        </div>
      );
    }
    return <div translate="no" className="notranslate" key={this.state.recoverKey}>{this.props.children}</div>;
  }
}


const DateRangeFilter = ({ startDate, setStartDate, endDate, setEndDate, onClear }) => (
  <div className="flex flex-col sm:flex-row items-center gap-2 bg-gray-800 p-2 rounded border border-gray-700 w-full md:w-auto print:hidden">
    <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-yellow-500" /><span className="text-sm text-gray-400 font-medium">Filtrar Data:</span></div>
    <div className="flex items-center gap-2">
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-gray-900 text-gray-100 text-xs px-2 py-1 rounded border border-gray-700 outline-none" />
      <span className="text-gray-500">até</span>
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-gray-900 text-gray-100 text-xs px-2 py-1 rounded border border-gray-700 outline-none" />
    </div>
    {startDate && endDate && <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300"><XCircle size={16} /></button>}
  </div>
);

// ============================================================================
// 6. COMPONENTES DE LEITURA (XML NATIVO)
// ============================================================================

const XMLImportModal = ({ isOpen, onClose, onDataExtracted, showMsg, produtosExistentes = [] }) => {
    useSuspendRealtime(isOpen);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [rows, setRows] = useState([]); // [{ ...prod, linkedSkuId: 'NEW'|'<id>', selected: true }]
    const [vincularBusca, setVincularBusca] = useState('');
    const fileInputRef = useRef(null);

    // Reset state every time the modal opens/closes para não arrastar lixo de uma abertura anterior.
    useEffect(() => {
        if (!isOpen) {
            setFile(null); setExtractedData(null); setRows([]); setLoading(false); setVincularBusca('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [isOpen]);

    const processFile = async (selectedFile) => {
        if (!selectedFile) return;
        setLoading(true);
        try {
            const data = await parseXMLNFe(selectedFile);
            if (!data.produtos?.length) throw new Error('Nenhum item encontrado no XML da NF-e.');
            setExtractedData({
                numeroNF: data.numeroNF,
                dataEmissao: data.dataEmissao,
                emitente: { razao: data.emitente?.razao || '' },
                count: data.produtos.length
            });
            const initRows = data.produtos.map((i) => normalizeXmlProductForReview(i, data, produtosExistentes));
            setRows(initRows);
        } catch (error) {
            console.error('XML parse error', error);
            showMsg('Erro no XML', error.message || 'Não foi possível ler o XML.');
            setExtractedData(null);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        if (!selectedFile.name.toLowerCase().endsWith('.xml')) {
            showMsg('Aviso', 'Por favor, selecione apenas arquivos XML da NF-e.');
            return;
        }
        setFile(selectedFile);
        setExtractedData(null);
        setRows([]);
        // Não processa automaticamente — usuário clica em "Ler e Extrair Dados".
    };

    const handleProcessFile = () => {
        if (!file) { showMsg('Aviso', 'Selecione um arquivo XML antes de ler.'); return; }
        processFile(file);
    };


    const updateRow = (idx, patch) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, ...patch } : r));
    const selectAllProducts = () => setRows(prev => prev.map(r => ({ ...r, selected: true })));
    const deselectAllProducts = () => setRows(prev => prev.map(r => ({ ...r, selected: false })));

    const handleConfirm = async () => {
        const selecionados = rows.filter(r => r.selected);
        if (selecionados.length === 0) { showMsg('Aviso', 'Selecione pelo menos um produto para importar.'); return; }
        setLoading(true);
        try {
            await onDataExtracted({
                xmlData: extractedData,
                selectedProducts: selecionados,
                fornecedor: extractedData.emitente.razao,
                numeroNF: extractedData.numeroNF,
                dataEmissao: extractedData.dataEmissao
            });
            onClose(); setFile(null); setExtractedData(null); setRows([]); if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('XML import save error', error);
            showMsg('Erro ao salvar XML', error?.message || 'Não foi possível salvar os itens extraídos.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const novosCount = rows.filter(r => r.selected && r.linkedSkuId === 'NEW').length;
    const updatesCount = rows.filter(r => r.selected && r.linkedSkuId !== 'NEW').length;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <Card title="Importação Nativa de XML (NF-e)" className="max-w-6xl w-full bg-gray-900 border-gray-700 shadow-2xl relative max-h-[92vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-blue-700 rounded-lg p-6 text-center hover:border-blue-500 transition-colors bg-gray-800/50">
                        <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileChange} className="hidden" id="xml-upload" />
                        <label htmlFor="xml-upload" className="cursor-pointer flex flex-col items-center">
                            <FileCode className="w-12 h-12 text-blue-500 mb-3" />
                            <p className="text-gray-300 text-sm font-bold">{file ? file.name : 'Clique para selecionar o XML da Nota Fiscal'}</p>
                            <p className="text-gray-500 text-xs mt-1">Processamento 100% local e seguro via DOMParser nativo.</p>
                        </label>
                    </div>

                    {file && !extractedData && (
                        <Button onClick={handleProcessFile} className="w-full !bg-blue-600 !text-white" disabled={loading}>
                            {loading ? <Spinner /> : <><FileDigit className="w-4 h-4 mr-2"/> Ler e Extrair Dados do XML</>}
                        </Button>
                    )}

                    {extractedData && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2"><FileText size={18}/> Dados da Nota Fiscal</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    <div><span className="text-gray-400">NF-e:</span> <span className="text-white ml-2 font-mono">{extractedData.numeroNF || '-'}</span></div>
                                    <div><span className="text-gray-400">Emissão:</span> <span className="text-white ml-2">{formatBRDate(extractedData.dataEmissao)}</span></div>
                                    <div><span className="text-gray-400">Itens:</span> <span className="text-white ml-2">{extractedData.count}</span></div>
                                    <div className="sm:col-span-3"><span className="text-gray-400">Fornecedor:</span> <span className="text-white ml-2">{extractedData.emitente.razao}</span></div>
                                </div>
                            </div>

                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                    <h3 className="text-blue-400 font-bold flex items-center gap-2"><Package size={18}/> Itens da Nota — Edite e vincule a SKU existente</h3>
                                    <div className="flex gap-2 items-center text-xs">
                                        <span className="text-green-400 font-bold">+ {novosCount} novos</span>
                                        <span className="text-yellow-400 font-bold">↑ {updatesCount} atualizações</span>
                                        <span className="text-gray-600">|</span>
                                        <button onClick={selectAllProducts} className="text-blue-400 hover:text-blue-300">Sel. todos</button>
                                        <button onClick={deselectAllProducts} className="text-red-400 hover:text-red-300">Limpar</button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mb-2">Vincule a um SKU existente para apenas dar entrada e atualizar saldo. Deixe "Novo cadastro" para criar um novo item.</p>
                                <div className="mb-3 relative">
                                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"/>
                                    <input value={vincularBusca} onChange={e=>setVincularBusca(e.target.value)} placeholder="Pesquisar SKU existente por nome ou código para vincular..." className="w-full bg-gray-950 text-white text-xs pl-8 pr-2 py-2 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                </div>
                                <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2">
                                    {rows.map((r, idx) => {
                                        const isNew = r.linkedSkuId === 'NEW';
                                        return (
                                            <div key={idx} className={`p-3 rounded border transition-all ${r.selected ? (isNew ? 'bg-green-900/15 border-green-700/60' : 'bg-yellow-900/15 border-yellow-700/60') : 'bg-gray-900 border-gray-700'}`}>
                                                <div className="flex items-start gap-3">
                                                    <button onClick={() => updateRow(idx, { selected: !r.selected })} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 ${r.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                                                        {r.selected && <Check size={14} className="text-gray-900"/>}
                                                    </button>
                                                    <div className="flex-1 grid grid-cols-12 gap-2">
                                                        <div className="col-span-12 md:col-span-5">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Descrição</label>
                                                            <input value={r.descricao} onChange={e=>updateRow(idx,{descricao:e.target.value})} className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                                            {r.codigo && <span className="text-[10px] text-gray-500">Cód XML: {r.codigo}</span>}
                                                        </div>
                                                        <div className="col-span-4 md:col-span-2">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Qtd</label>
                                                            <input type="number" step="0.01" value={r.qtd} onChange={e=>updateRow(idx,{qtd:parseFloat(e.target.value)||0})} className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                                        </div>
                                                        <div className="col-span-3 md:col-span-1">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Un</label>
                                                            <input value={r.unidade} onChange={e=>updateRow(idx,{unidade:e.target.value})} className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                                        </div>
                                                        <div className="col-span-5 md:col-span-2">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Valor Unit.</label>
                                                            <input type="number" step="0.01" value={r.valorUnitario} onChange={e=>updateRow(idx,{valorUnitario:parseFloat(e.target.value)||0})} className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Vincular</label>
                                                            <select value={r.linkedSkuId} onChange={e=>updateRow(idx,{linkedSkuId:e.target.value})} className={`w-full text-xs px-2 py-1.5 rounded border outline-none ${isNew?'bg-green-950 border-green-700 text-green-300':'bg-yellow-950 border-yellow-700 text-yellow-300'}`}>
                                                                <option value="NEW">+ Novo cadastro</option>
                                                                {(produtosExistentes || []).filter(p => {
                                                                    if (String(p.ativo) === 'false') return false;
                                                                    if (p.id === r.linkedSkuId) return true; // mantém a opção atualmente vinculada visível
                                                                    if (!vincularBusca) return true;
                                                                    const s = vincularBusca.toLowerCase();
                                                                    return String(p.nome||'').toLowerCase().includes(s) || String(p.sku||'').toLowerCase().includes(s);
                                                                }).slice(0,200).map(p => (
                                                                    <option key={p.id} value={p.id}>{p.sku} — {p.nome}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-4">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Categoria PBQP-H</label>
                                                            <select value={r.categoria} onChange={e=>updateRow(idx,{categoria:e.target.value})} className="w-full bg-gray-950 text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500">
                                                                {CATEGORIAS_PADRAO.map(c => <option key={c} value={c}>{c}</option>)}
                                                                {!CATEGORIAS_PADRAO.includes(r.categoria) && <option value={r.categoria}>{r.categoria}</option>}
                                                            </select>
                                                            <span className="text-[10px] text-purple-300">{r.categoria_fvm || 'FVM: OUTROS'} · {r.classe_pbqph}</span>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-4">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">DNA / Controle rigoroso</label>
                                                            <select value={r.dna_type || ''} onChange={e=>updateRow(idx,{dna_type:e.target.value, rastreavel: !!e.target.value || r.rastreavel})} className="w-full bg-gray-950 text-white text-xs px-2 py-1.5 rounded border border-purple-800/60 outline-none focus:border-purple-500">
                                                                <option value="">Sem DNA</option>
                                                                {Object.keys(DNA_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-4">
                                                            <label className="text-[10px] uppercase font-bold text-gray-500">Local / Aplicação</label>
                                                            <select value={r.local_armazenamento || AREAS_ESTOCAGEM[0]} onChange={e=>updateRow(idx,{local_armazenamento:e.target.value})} className="w-full bg-gray-950 text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500 mb-1">
                                                                {AREAS_ESTOCAGEM.map(a => <option key={a} value={a}>{a}</option>)}
                                                            </select>
                                                            <input value={r.aplicacao || ''} onChange={e=>updateRow(idx,{aplicacao:e.target.value})} placeholder="Aplicação / uso" className="w-full bg-gray-950 text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"/>
                                                        </div>
                                                        <div className="col-span-6 md:col-span-3">
                                                            <label className="text-[10px] uppercase font-bold text-yellow-500">Lote (NF)</label>
                                                            <input value={r.lote || ''} onChange={e=>updateRow(idx,{lote:e.target.value})} placeholder="Lote desta entrada" className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-yellow-700/50 outline-none focus:border-yellow-500"/>
                                                        </div>
                                                        <div className="col-span-6 md:col-span-3">
                                                            <label className="text-[10px] uppercase font-bold text-yellow-500">Validade (NF)</label>
                                                            <input type="date" value={r.validade || ''} onChange={e=>updateRow(idx,{validade:e.target.value})} className="w-full bg-gray-950 text-white text-sm px-2 py-1.5 rounded border border-yellow-700/50 outline-none focus:border-yellow-500"/>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Cancelar</Button>
                                <Button onClick={handleConfirm} className="flex-1 !bg-blue-600 !text-white" disabled={loading}>{loading ? <Spinner /> : <><CheckCircle size={16} className="mr-2"/> Salvar revisão: {novosCount} novo(s) + {updatesCount} entrada(s)</>}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};


// ============================================================================
// 7. VIEWS PRINCIPAIS
// ============================================================================

const DashboardView = ({ produtos, locacoes, ferramentas, emprestimos, movimentacoes, desperdicios, agenda = [], cronograma = [], onSaveCronograma, onDeleteCronograma, setActiveTab, isViewer, showMsg }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportConfig, setReportConfig] = useState({ kpi: true, critico: true, controlados: false, auditoria: false });
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [lowStockFilter, setLowStockFilter] = useState({ tipo: 'categoria', valor: 'ALL' });
  const [fifoSearch, setFifoSearch] = useState('');
  const [novaAtividade, setNovaAtividade] = useState({ titulo: '', data: getLocalISOString().slice(0,10), prioridade: 'MEDIA', descricao: '' });

  const formatNumber = (num) => Number(num).toLocaleString('pt-BR');
  const produtosAtivos = (produtos || []).filter(p => String(p.ativo) !== 'false');
  const estoqueBaixo = produtosAtivos.filter(p => (Number(p.saldo_atual) || 0) < (Number(p.estoque_minimo) || 5));
  
  const ferramentasAtivas = (ferramentas || []).filter(f => String(f.ativo) !== 'false');
  const ferramentasEmUso = ferramentasAtivas.filter(f => f.status === 'EMPRESTADO');
  
  const locacoesAtivas = (locacoes || []).filter(l => String(l.ativo) !== 'false' && l.status !== 'DEVOLUCAO');

  const categoriasUnicas = useMemo(() => Array.from(new Set(produtosAtivos.map(p => p.categoria || 'Geral'))).sort(), [produtosAtivos]);
  const empreiteirasUnicas = useMemo(() => Array.from(new Set(produtosAtivos.map(p => p.empreiteira || 'Sem Empreiteira'))).sort(), [produtosAtivos]);

  // Lembretes da Agenda OC: vencidas + próximas 7 dias
  const agendaLembretes = useMemo(() => {
    const itens = (agenda||[]).map(a => ({...a, _status: computeAgendaStatus(a)}));
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(hoje); limite.setDate(limite.getDate() + 7);
    return itens
      .filter(i => i._status === 'VENCIDA' || i._status === 'PENDENTE' || (i._status === 'PROGRAMADA' && i.data_programada && new Date(i.data_programada+'T00:00:00') <= limite))
      .sort((a,b) => {
        const ord = { VENCIDA:0, PENDENTE:1, PROGRAMADA:2, ENTREGUE:3 };
        return (ord[a._status]-ord[b._status]) || ((a.data_programada||'9999').localeCompare(b.data_programada||'9999'));
      })
      .slice(0, 8);
  }, [agenda]);

  const PRIO = {
    URGENTE: { label: 'Urgente', cls: 'bg-red-500/15 text-red-300 border-red-500/40', dot: 'bg-red-500', rank: 0 },
    ALTA:    { label: 'Alta',    cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40', dot: 'bg-orange-500', rank: 1 },
    MEDIA:   { label: 'Média',   cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-500', rank: 2 },
    BAIXA:   { label: 'Baixa',   cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40', dot: 'bg-blue-500', rank: 3 },
  };

  const cronogramaOrdenado = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return [...(cronograma||[])]
      .map(a => {
        const d = a.data ? new Date(a.data+'T00:00:00') : null;
        const atrasada = !a.concluida && d && d < hoje;
        return { ...a, _atrasada: atrasada };
      })
      .sort((a,b) => {
        if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
        const ra = PRIO[a.prioridade||'MEDIA']?.rank ?? 2;
        const rb = PRIO[b.prioridade||'MEDIA']?.rank ?? 2;
        if (ra !== rb) return ra - rb;
        return (a.data||'9999').localeCompare(b.data||'9999');
      });
  }, [cronograma]);

  const printPostits = (incluirConcluidas = false) => {
    const POSTIT_COLORS = {
      URGENTE: { bg: '#fecaca', border: '#dc2626', tag: '#7f1d1d', label: 'URGENTE' },
      ALTA:    { bg: '#fed7aa', border: '#ea580c', tag: '#7c2d12', label: 'ALTA' },
      MEDIA:   { bg: '#fef08a', border: '#ca8a04', tag: '#713f12', label: 'MÉDIA' },
      BAIXA:   { bg: '#bfdbfe', border: '#2563eb', tag: '#1e3a8a', label: 'BAIXA' },
    };
    const lista = cronogramaOrdenado.filter(a => incluirConcluidas || !a.concluida);
    if (lista.length === 0) { showMsg && showMsg('Aviso','Nenhuma atividade para imprimir.'); return; }
    // group by date
    const grupos = {};
    lista.forEach(a => {
      const k = a.data || 'SEM_DATA';
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(a);
    });
    const datasOrdenadas = Object.keys(grupos).sort((a,b) => {
      if (a === 'SEM_DATA') return 1;
      if (b === 'SEM_DATA') return -1;
      return a.localeCompare(b);
    });
    const fmt = (d) => d === 'SEM_DATA' ? 'Sem Data' : formatBRDate(d);
    const diaSemana = (d) => {
      if (d === 'SEM_DATA') return '';
      const dt = new Date(d+'T00:00:00');
      return ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dt.getDay()];
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Post-its — Cronograma</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #111; }
        .grupo { page-break-inside: avoid; margin-bottom: 10mm; }
        .grupo-header { display: flex; align-items: baseline; gap: 8px; border-bottom: 2px dashed #333; padding-bottom: 4px; margin-bottom: 6mm; }
        .grupo-data { font-size: 18pt; font-weight: 900; }
        .grupo-dia { font-size: 11pt; color: #555; font-style: italic; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
        .postit { aspect-ratio: 1 / 1; padding: 4mm; border: 2px solid; border-radius: 3px; box-shadow: 2px 2px 4px rgba(0,0,0,0.15); display: flex; flex-direction: column; position: relative; overflow: hidden; transform: rotate(-0.5deg); }
        .postit:nth-child(even) { transform: rotate(0.6deg); }
        .postit:nth-child(3n) { transform: rotate(-0.3deg); }
        .tag { align-self: flex-start; font-size: 7pt; font-weight: 900; letter-spacing: 1px; padding: 2px 6px; border-radius: 2px; color: #fff; margin-bottom: 4px; }
        .titulo { font-size: 13pt; font-weight: 900; line-height: 1.15; margin-bottom: 3px; word-break: break-word; }
        .desc { font-size: 9pt; line-height: 1.3; flex: 1; word-break: break-word; }
        .rodape { font-size: 7.5pt; font-weight: 700; opacity: 0.7; margin-top: 4px; display: flex; justify-content: space-between; }
        .concluida .titulo { text-decoration: line-through; opacity: 0.6; }
        .legenda { margin: 4mm 0 8mm; padding: 4mm; border: 1px solid #ccc; border-radius: 4px; font-size: 9pt; }
        .legenda b { font-size: 10pt; }
        .leg-item { display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; }
        .leg-sw { width: 14px; height: 14px; border: 1.5px solid; display: inline-block; border-radius: 2px; }
        h1 { font-size: 16pt; margin: 0 0 2mm; }
        .subt { font-size: 10pt; color: #666; margin-bottom: 4mm; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      <div class="no-print" style="padding:10px;background:#eee;text-align:center;">
        <button onclick="window.print()" style="padding:8px 20px;font-weight:bold;cursor:pointer;">🖨 Imprimir</button>
        <button onclick="window.close()" style="padding:8px 20px;margin-left:8px;cursor:pointer;">Fechar</button>
      </div>
      <h1>📌 Cronograma de Atividades — Post-its</h1>
      <div class="subt">Gerado em ${new Date().toLocaleString('pt-BR')} • Recorte na linha tracejada e cole no seu painel.</div>
      <div class="legenda">
        <b>Legenda por urgência:</b><br/>
        ${Object.entries(POSTIT_COLORS).map(([k,c]) => `<span class="leg-item"><span class="leg-sw" style="background:${c.bg};border-color:${c.border}"></span>${c.label}</span>`).join('')}
      </div>
      ${datasOrdenadas.map(data => `
        <div class="grupo">
          <div class="grupo-header">
            <div class="grupo-data">${fmt(data)}</div>
            <div class="grupo-dia">${diaSemana(data)}</div>
          </div>
          <div class="grid">
            ${grupos[data].map(a => {
              const c = POSTIT_COLORS[a.prioridade||'MEDIA'] || POSTIT_COLORS.MEDIA;
              return `<div class="postit ${a.concluida?'concluida':''}" style="background:${c.bg};border-color:${c.border};color:${c.tag}">
                <span class="tag" style="background:${c.border}">${c.label}</span>
                <div class="titulo">${(a.titulo||'').replace(/[<>]/g,'')}</div>
                <div class="desc">${(a.descricao||'').replace(/[<>]/g,'')}</div>
                <div class="rodape"><span>${a.concluida?'✓ Concluída':(a._atrasada?'⚠ Atrasada':'○ Pendente')}</span><span>${fmt(data)}</span></div>
              </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showMsg && showMsg('Aviso','Habilite pop-ups para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); } catch(e){} }, 300);
  };

  const addAtividade = async () => {
    if (!novaAtividade.titulo.trim()) { showMsg && showMsg('Aviso','Informe o título da atividade.'); return; }
    const item = {
      id: `ATIV-${generateId()}`,
      titulo: novaAtividade.titulo.trim(),
      descricao: novaAtividade.descricao || '',
      data: novaAtividade.data || getLocalISOString().slice(0,10),
      prioridade: novaAtividade.prioridade || 'MEDIA',
      concluida: false,
      created_at: getLocalISOString(),
    };
    await onSaveCronograma?.(item);
    setNovaAtividade({ titulo: '', data: getLocalISOString().slice(0,10), prioridade: 'MEDIA', descricao: '' });
  };
  const toggleAtividade = async (a) => { await onSaveCronograma?.({ ...a, concluida: !a.concluida, data_conclusao: !a.concluida ? getLocalISOString() : null }); };
  const removerAtividade = async (a) => { if (await showMsg('Excluir', `Remover atividade "${a.titulo}"?`, true)) await onDeleteCronograma?.(a.id); };



  const handleGeneratePDF = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) return;

    let html = `<html><head><title>Relatório Gerencial ISO 9001 - ${SYSTEM_NAME}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .header img { max-height: 50px; }
      h1 { font-size: 20px; text-transform: uppercase; margin: 0; }
      h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; }
      .grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
      .box { border: 1px solid #000; padding: 15px; width: 45%; box-sizing: border-box; text-align: center; }
      .box .title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666; }
      .box .value { font-size: 24px; font-weight: bold; margin-top: 5px; color: #000; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
      th, td { border: 1px solid #000; padding: 6px; text-align: left; }
      th { background-color: #f0f0f0; }
      .signatures { margin-top: 60px; display: flex; justify-content: space-around; }
      .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight: bold; font-size: 12px; }
    </style></head><body>
    <div class="header">
      <img src="${REALMARKA_LOGO}" alt="${SYSTEM_NAME}">
      <div>
        <h1>Relatório de Status Geral</h1>
        <div style="font-size: 12px;">Conformidade PBQP-H / ISO 9001</div>
      </div>
      <div style="text-align: right; font-size: 12px;">
        Data: ${new Date().toLocaleDateString('pt-BR')}<br>
        Hora: ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>`;
    
    if (reportConfig.kpi) {
        html += `<h2>1. Indicadores de Desempenho (KPIs)</h2>
        <div class="grid">
          <div class="box"><div class="title">Itens em Estoque Controlado</div><div class="value">${produtosAtivos.length}</div></div>
          <div class="box"><div class="title">Alerta de Estoque Baixo</div><div class="value" style="color: red;">${estoqueBaixo.length}</div></div>
          <div class="box"><div class="title">Maquinário Externo (Locações)</div><div class="value">${locacoesAtivas.length}</div></div>
          <div class="box"><div class="title">Ferramentas em Uso (Campo)</div><div class="value">${ferramentasEmUso.length} / ${ferramentasAtivas.length}</div></div>
        </div>`;
    }

    if (reportConfig.critico) {
        html += `<h2>2. Síntese de Estoque Crítico (Abaixo do Mínimo)</h2>`;
        if (estoqueBaixo.length === 0) {
            html += `<p>Nenhum item com estoque abaixo do mínimo registrado.</p>`;
        } else {
            html += `<table><thead><tr><th>Insumo</th><th>Categoria</th><th>Empreiteira</th><th>Estoque Mín.</th><th>Saldo Físico</th></tr></thead><tbody>`;
            estoqueBaixo.slice(0, 30).forEach(p => {
                html += `<tr><td>${p.nome}</td><td>${p.categoria}</td><td>${p.empreiteira||'-'}</td><td style="text-align:center;">${p.estoque_minimo}</td><td style="text-align:center; font-weight:bold; color:red;">${p.saldo_atual}</td></tr>`;
            });
            html += `</tbody></table>`;
            if(estoqueBaixo.length > 30) html += `<p style="font-size: 10px; color: #666;">Exibindo os primeiros 30 de ${estoqueBaixo.length} itens críticos.</p>`;
        }
    }

    if (reportConfig.controlados) {
        const controlados = produtosAtivos.filter(p => !!p.rastreavel);
        html += `<h2>3. Insumos Controlados (Matriz PBQP-H)</h2>`;
        if (controlados.length === 0) {
            html += `<p>Nenhum insumo rastreável registrado no momento.</p>`;
        } else {
            html += `<table><thead><tr><th>Material</th><th>Tipo de DNA</th><th>Lote/NF</th><th>Validade Base</th><th>Saldo Físico</th></tr></thead><tbody>`;
            controlados.slice(0, 30).forEach(p => {
                html += `<tr><td>${p.nome}</td><td>${p.dna_type||'Geral'}</td><td>${p.lote||p.fornecedor_nf||'-'}</td><td>${formatBRDate(p.validade)}</td><td style="text-align:center; font-weight:bold;">${p.saldo_atual} ${p.unidade}</td></tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    if (reportConfig.auditoria) {
        const recentes = (movimentacoes || []).sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 40);
        html += `<h2>4. Auditoria de Movimentações (Últimos Registos)</h2>`;
        if (recentes.length === 0) {
            html += `<p>Nenhuma movimentação de estoque recente.</p>`;
        } else {
            html += `<table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Produto (SKU)</th><th>Qtd</th><th>Origem / Destino</th></tr></thead><tbody>`;
            recentes.forEach(m => {
                const p = produtos.find(x => x.id === m.sku || x.sku === m.sku);
                const isEntrada = m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCAO';
                html += `<tr><td>${new Date(m.data).toLocaleString('pt-BR')}</td><td>${m.tipo}</td><td>${p?.nome||m.sku}</td><td style="text-align:center;">${isEntrada?'+':'-'}${m.qtd}</td><td>${isEntrada ? m.origem : m.destino}</td></tr>`;
            });
            html += `</tbody></table>`;
        }
    }

    html += `
    <div class="signatures">
      <div class="sig-line">Responsável pelo Almoxarifado<br><span style="font-weight:normal; font-size: 10px;">Assinatura</span></div>
      <div class="sig-line">Auditoria / Engenharia<br><span style="font-weight:normal; font-size: 10px;">Assinatura</span></div>
    </div>
    </body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
    setShowReportModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 print:hidden">
        <div><h2 className="text-xl font-bold text-white">Visão Global</h2><p className="text-sm text-gray-400">Métricas atualizadas em tempo real.</p></div>
        <Button onClick={() => setShowReportModal(true)} className="!bg-blue-600 !text-white"><FileBarChart className="w-4 h-4 mr-2"/> Gerar Relatório ISO 9001</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card onClick={() => setActiveTab('ESTOQUE')} className="bg-gradient-to-br from-blue-900 to-blue-950 border-blue-800 cursor-pointer hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div><p className="text-blue-300 text-sm font-bold uppercase tracking-wider">Itens Estoque</p><p className="text-3xl font-black text-white">{produtosAtivos.length}</p></div>
            <Package className="w-10 h-10 text-blue-400 opacity-50" />
          </div>
        </Card>

        <Card onClick={() => setShowLowStockModal(true)} className="bg-gradient-to-br from-red-900 to-red-950 border-red-800 cursor-pointer hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div><p className="text-red-300 text-sm font-bold uppercase tracking-wider">Estoque Baixo</p><p className="text-3xl font-black text-white">{estoqueBaixo.length}</p></div>
            <AlertTriangle className="w-10 h-10 text-red-400 opacity-50" />
          </div>
        </Card>

        <Card onClick={() => setActiveTab('LOCACOES')} className="bg-gradient-to-br from-yellow-900 to-yellow-950 border-yellow-800 cursor-pointer hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div><p className="text-yellow-300 text-sm font-bold uppercase tracking-wider">Maquinário Ext.</p><p className="text-3xl font-black text-white">{locacoesAtivas.length}</p></div>
            <Building2 className="w-10 h-10 text-yellow-400 opacity-50" />
          </div>
        </Card>

        <Card onClick={() => setActiveTab('FERRAMENTAS')} className="bg-gradient-to-br from-purple-900 to-purple-950 border-purple-800 cursor-pointer hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div><p className="text-purple-300 text-sm font-bold uppercase tracking-wider">Ferramentas Uso</p><p className="text-3xl font-black text-white">{ferramentasEmUso.length} / {ferramentasAtivas.length}</p></div>
            <Wrench className="w-10 h-10 text-purple-400 opacity-50" />
          </div>
        </Card>
      </div>

      {/* FIFO - PEPS: Primeiro que Entra, Primeiro que Sai */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const allFifo = produtosAtivos
          .filter(p => p.validade && Number(p.saldo_atual) > 0)
          .map(p => {
            const v = new Date(p.validade);
            const dias = Math.ceil((v - today) / (1000*60*60*24));
            return { ...p, _validadeDate: v, _dias: dias };
          })
          .sort((a,b) => a._validadeDate - b._validadeDate);
        const filtered = fifoSearch.trim()
          ? allFifo.filter(p => `${p.nome} ${p.sku} ${p.lote||''} ${p.categoria||''}`.toLowerCase().includes(fifoSearch.toLowerCase()))
          : allFifo;
        const fifoItems = filtered.slice(0, 15);
        if (allFifo.length === 0) return null;
        const proximo = filtered[0];
        return (
          <Card title="Matriz FIFO (PEPS) — Liberar Primeiro" icon={Clock} className="bg-gradient-to-br from-gray-900 to-gray-950 border-yellow-900/40">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <p className="text-xs text-gray-400 flex-1">Lotes ordenados por validade. <span className="text-yellow-400 font-bold">Libere de cima para baixo</span> para evitar perdas.</p>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input value={fifoSearch} onChange={e=>setFifoSearch(e.target.value)} placeholder="Buscar item, lote ou categoria..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-950 text-gray-100 border border-gray-800 focus:border-yellow-500 outline-none text-sm" />
              </div>
            </div>
            {fifoSearch && proximo && (
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-gray-900 font-black text-xl">1º</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-bold text-yellow-400 tracking-wider">Próximo a sair</p>
                  <p className="text-lg font-black text-white truncate">{proximo.nome}</p>
                  <p className="text-xs text-gray-400">Lote {proximo.lote || proximo.fornecedor_nf || '—'} • Validade {formatBRDate(proximo.validade)} • Saldo {proximo.saldo_atual} {proximo.unidade}</p>
                </div>
                <div className={`text-2xl font-black ${proximo._dias < 0 ? 'text-red-400' : proximo._dias <= 7 ? 'text-orange-400' : 'text-green-400'}`}>{proximo._dias < 0 ? `-${Math.abs(proximo._dias)}d` : `${proximo._dias}d`}</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {fifoItems.map((p, idx) => {
                const cor = p._dias < 0 ? 'border-red-500/50 bg-red-900/20' : p._dias <= 7 ? 'border-orange-500/40 bg-orange-900/10' : p._dias <= 30 ? 'border-yellow-500/30 bg-yellow-900/5' : 'border-green-500/30 bg-green-900/5';
                const txt = p._dias < 0 ? 'text-red-400' : p._dias <= 7 ? 'text-orange-400' : p._dias <= 30 ? 'text-yellow-400' : 'text-green-400';
                const loc = [p.rua && `R${p.rua}`, p.prateleira && `P${p.prateleira}`, p.gaveta && `G${p.gaveta}`].filter(Boolean).join('-') || p.local_armazenamento || '-';
                return (
                  <div key={p.id} className={`rounded-xl border ${cor} p-3 flex flex-col gap-2`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded px-1.5 py-0.5 shrink-0">{idx+1}º</span>
                        <p className="text-sm font-bold text-white truncate" title={p.nome}>{p.nome}</p>
                      </div>
                      <span className={`text-xs font-black ${txt} whitespace-nowrap`}>{p._dias < 0 ? `VENC ${Math.abs(p._dias)}d` : `${p._dias}d`}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                      <div><span className="block text-[9px] text-gray-600 uppercase font-bold">Lote/NF</span><span className="text-gray-300 truncate block">{p.lote || p.fornecedor_nf || '—'}</span></div>
                      <div><span className="block text-[9px] text-gray-600 uppercase font-bold">Validade</span><span className="text-gray-300 font-mono">{formatBRDate(p.validade)}</span></div>
                      <div><span className="block text-[9px] text-gray-600 uppercase font-bold">Saldo</span><span className="text-white font-bold">{p.saldo_atual} {p.unidade}</span></div>
                      <div><span className="block text-[9px] text-gray-600 uppercase font-bold">Local</span><span className="text-gray-300">{loc}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > 15 && <p className="text-[11px] text-gray-500 mt-3 text-center">Mostrando 15 de {filtered.length} itens. Refine a busca para encontrar específicos.</p>}
            {filtered.length === 0 && <p className="text-xs text-gray-500 text-center py-6">Nenhum item encontrado para "{fifoSearch}".</p>}
          </Card>
        );
      })()}

      {/* Lembretes da Agenda OC */}
      <Card title="Lembretes da Agenda de OC" icon={Bell} className="border-blue-900/40">
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs text-gray-400">Vencidas, pendentes e próximos 7 dias.</p>
          <button onClick={() => setActiveTab('AGENDA')} className="text-xs text-yellow-400 hover:text-yellow-300 font-bold uppercase tracking-wider">Abrir Agenda →</button>
        </div>
        {agendaLembretes.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">Nenhum lembrete pendente. Tudo em dia! 🎉</p>
        ) : (
          <div className="space-y-2">
            {agendaLembretes.map(it => (
              <button key={it.id} onClick={() => setActiveTab('AGENDA')} className="w-full text-left bg-gray-950/60 hover:bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-lg p-3 flex items-center gap-3 transition">
                <div className={`w-2 self-stretch rounded-full ${AGENDA_STATUS[it._status].dot}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white truncate">{it.titulo}</span>
                    {it.numero_oc && <span className="text-[9px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">OC #{it.numero_oc}</span>}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${AGENDA_STATUS[it._status].cls}`}>{AGENDA_STATUS[it._status].label}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                    <CalendarDays size={11}/> {it.data_programada ? formatBRDate(it.data_programada) : 'Sem data'}
                    {it.fornecedor && <span>• {it.fornecedor}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Cronograma de Atividades */}
      <Card title="Cronograma de Atividades" icon={CalendarClock} className="border-purple-900/40">
        <div className="flex justify-end gap-2 mb-3 -mt-2 flex-wrap">
          <button onClick={()=>printPostits(false)} className="text-[10px] font-bold uppercase tracking-wider bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 rounded px-3 py-1.5 flex items-center gap-1.5"><Printer size={12}/> Imprimir Post-its</button>
          <button onClick={()=>printPostits(true)} className="text-[10px] font-bold uppercase tracking-wider bg-gray-700/40 hover:bg-gray-700/60 text-gray-200 border border-gray-600/40 rounded px-3 py-1.5 flex items-center gap-1.5"><Printer size={12}/> Incluir Concluídas</button>
        </div>
        <div className="bg-gray-950/60 rounded-xl border border-gray-800 p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <input value={novaAtividade.titulo} onChange={e=>setNovaAtividade(p=>({...p, titulo:e.target.value}))} placeholder="Nova atividade..." className="md:col-span-5 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            <input type="date" value={novaAtividade.data} onChange={e=>setNovaAtividade(p=>({...p, data:e.target.value}))} className="md:col-span-3 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            <select value={novaAtividade.prioridade} onChange={e=>setNovaAtividade(p=>({...p, prioridade:e.target.value}))} className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
              <option value="URGENTE">Urgente</option><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option>
            </select>
            <button onClick={addAtividade} disabled={isViewer} className="md:col-span-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black rounded-lg px-3 py-2 text-xs uppercase tracking-wider flex items-center justify-center gap-1"><Plus size={14}/> Adicionar</button>
          </div>
          <input value={novaAtividade.descricao} onChange={e=>setNovaAtividade(p=>({...p, descricao:e.target.value}))} placeholder="Descrição (opcional)" className="mt-2 w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
        </div>

        {cronogramaOrdenado.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">Nenhuma atividade cadastrada. Adicione acima.</p>
        ) : (
          <div className="space-y-2">
            {cronogramaOrdenado.map(a => {
              const prio = PRIO[a.prioridade||'MEDIA'] || PRIO.MEDIA;
              return (
                <div key={a.id} className={`flex items-center gap-3 rounded-lg border p-3 transition ${a.concluida ? 'bg-gray-950/40 border-gray-800 opacity-60' : a._atrasada ? 'bg-red-900/10 border-red-500/30' : 'bg-gray-950/60 border-gray-800'}`}>
                  <button onClick={()=>toggleAtividade(a)} disabled={isViewer} className={`w-5 h-5 rounded border-2 ${a.concluida ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-purple-500'} flex items-center justify-center shrink-0`}>
                    {a.concluida && <Check size={12} className="text-white"/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${a.concluida ? 'text-gray-500 line-through' : 'text-white'}`}>{a.titulo}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${prio.cls}`}><Flag size={9}/>{prio.label}</span>
                      {a._atrasada && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-red-500/15 text-red-300 border-red-500/40">Atrasada</span>}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <CalendarDays size={11}/> {a.data ? formatBRDate(a.data) : 'Sem data'}
                      {a.descricao && <span className="truncate">— {a.descricao}</span>}
                    </div>
                  </div>
                  <button onClick={()=>removerAtividade(a)} disabled={isViewer} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded shrink-0" title="Remover"><Trash2 size={14}/></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal: Estoque Baixo (filtrar e imprimir) */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={()=>setShowLowStockModal(false)}>
          <Card title="Estoque Baixo — Filtrar e Imprimir" className="max-w-lg w-full" onClick={e=>e?.stopPropagation?.()}>
            <button onClick={() => setShowLowStockModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24}/></button>
            <p className="text-sm text-gray-400 mb-4">Escolha como deseja agrupar e filtrar o relatório de itens com estoque abaixo do mínimo.</p>
            <div className="space-y-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtrar por</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={()=>setLowStockFilter({tipo:'categoria', valor:'ALL'})} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border ${lowStockFilter.tipo==='categoria'?'bg-yellow-500/20 border-yellow-500/50 text-yellow-300':'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>Categoria</button>
                  <button onClick={()=>setLowStockFilter({tipo:'empreiteira', valor:'ALL'})} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border ${lowStockFilter.tipo==='empreiteira'?'bg-yellow-500/20 border-yellow-500/50 text-yellow-300':'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>Centro de Custo</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{lowStockFilter.tipo==='categoria' ? 'Categoria' : 'Empreiteira / Centro de Custo'}</label>
                <select value={lowStockFilter.valor} onChange={e=>setLowStockFilter(p=>({...p, valor:e.target.value}))} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1">
                  <option value="ALL">Todas / Todos</option>
                  {(lowStockFilter.tipo==='categoria' ? categoriasUnicas : empreiteirasUnicas).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-2 border border-gray-800">
                Total de itens críticos: <span className="text-red-400 font-bold">{estoqueBaixo.length}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <Button variant="secondary" onClick={() => { setShowLowStockModal(false); setActiveTab('ESTOQUE'); }} className="flex-1">Abrir Estoque</Button>
              <Button onClick={() => {
                const filtrados = lowStockFilter.valor === 'ALL'
                  ? produtosAtivos
                  : produtosAtivos.filter(p => lowStockFilter.tipo==='categoria' ? (p.categoria||'Geral')===lowStockFilter.valor : (p.empreiteira||'Sem Empreiteira')===lowStockFilter.valor);
                printLowStockReport(filtrados, 'ALL', showMsg);
                setShowLowStockModal(false);
              }} className="flex-1 !bg-red-600 !text-white"><Printer className="w-4 h-4 mr-2"/> Imprimir</Button>
            </div>
          </Card>
        </div>
      )}


      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <Card title="Relatórios de Auditoria ISO 9001" className="max-w-md w-full">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24}/></button>
            <p className="text-sm text-gray-400 mb-4">Selecione quais áreas deseja incluir na impressão deste relatório gerencial:</p>
            <div className="space-y-3 bg-gray-950 p-4 rounded-lg border border-gray-800">
              <label className="flex items-center gap-3 cursor-pointer text-gray-300"><input type="checkbox" checked={reportConfig.kpi} onChange={e=>setReportConfig({...reportConfig, kpi: e.target.checked})} className="w-5 h-5 rounded border-gray-600 text-yellow-500 bg-gray-900" /> Indicadores Gerais (KPIs)</label>
              <label className="flex items-center gap-3 cursor-pointer text-gray-300"><input type="checkbox" checked={reportConfig.critico} onChange={e=>setReportConfig({...reportConfig, critico: e.target.checked})} className="w-5 h-5 rounded border-gray-600 text-yellow-500 bg-gray-900" /> Análise de Estoque Crítico</label>
              <label className="flex items-center gap-3 cursor-pointer text-gray-300"><input type="checkbox" checked={reportConfig.controlados} onChange={e=>setReportConfig({...reportConfig, controlados: e.target.checked})} className="w-5 h-5 rounded border-gray-600 text-yellow-500 bg-gray-900" /> Matriz de Insumos Controlados (DNA)</label>
              <label className="flex items-center gap-3 cursor-pointer text-gray-300"><input type="checkbox" checked={reportConfig.auditoria} onChange={e=>setReportConfig({...reportConfig, auditoria: e.target.checked})} className="w-5 h-5 rounded border-gray-600 text-yellow-500 bg-gray-900" /> Auditoria de Movimentações (Recentes)</label>
            </div>
            <div className="flex gap-3 pt-6">
              <Button variant="secondary" onClick={() => setShowReportModal(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleGeneratePDF} className="flex-1 !bg-blue-600 !text-white"><Printer className="w-4 h-4 mr-2"/> Imprimir Relatório</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MODAL: Editor de Etiquetas (templates: Padrão / Revestimento / Ensacado)
// Permite editar campos por item antes de mandar para impressão.
// ============================================================================
const LABEL_TEMPLATES = {
  PADRAO: { label: 'Padrão (Estoque)', fields: ['nome','sku','rua','prateleira','gaveta','unidade','categoria','aplicacao','empreiteira','lote','validade'] },
  REVESTIMENTO: { label: 'Revestimento (Cerâmica/Porcelanato)', fields: ['nome','sku','rua','prateleira','gaveta','unidade','tonalidade','calibre','pei','lote','validade','empreiteira'] },
  ENSACADO: { label: 'Ensacado (Cimento/Argamassa/Graute)', fields: ['nome','sku','rua','prateleira','gaveta','unidade','fabricante','tipo_cp','peso_saco','lote','validade','empreiteira'] },
};
const FIELD_LABELS = { nome:'Nome', sku:'SKU', rua:'Rua', prateleira:'Prateleira', gaveta:'Gaveta', unidade:'Unidade', categoria:'Categoria', aplicacao:'Aplicação', empreiteira:'Empreiteira', lote:'Lote', validade:'Validade', tonalidade:'Tonalidade', calibre:'Calibre', pei:'PEI', fabricante:'Fabricante', tipo_cp:'Tipo CP', peso_saco:'Peso do Saco' };

const LabelEditorModal = ({ items, onClose, onConfirm }) => {
  useSuspendRealtime();
  const guessTemplate = (it) => {
    const cat = String(it.categoria || '').toUpperCase();
    if (/REVEST|PORCELAN|CER[ÂA]MIC|AZULEJO|PISO/.test(cat) || /PORCELAN|CER[ÂA]MIC|AZULEJO/.test(String(it.nome||'').toUpperCase())) return 'REVESTIMENTO';
    if (/CIMENTO|ARGAMASS|AGLOMERANT|GRAUTE/.test(cat) || /CIMENTO|ARGAMASSA|GRAUTE/.test(String(it.nome||'').toUpperCase())) return 'ENSACADO';
    return 'PADRAO';
  };
  const [rows, setRows] = useState(() => items.map(it => ({
    ...it,
    _template: guessTemplate(it),
    tonalidade: it.tonalidade || it.dna_payload?.tonalidade || '',
    calibre: it.calibre || it.dna_payload?.calibre || '',
    pei: it.pei || it.dna_payload?.pei || '',
    fabricante: it.fabricante || it.dna?.fabricante || it.dna_payload?.fabricante || '',
    tipo_cp: it.tipo_cp || it.dna_payload?.tipo_cp || '',
    peso_saco: it.peso_saco || it.dna_payload?.peso_saco || '',
    validade: it.validade ? String(it.validade).split('T')[0] : '',
  })));
  const update = (idx, field, value) => setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const [sizeMode, setSizeMode] = useState('small');
  const [customLabels, setCustomLabels] = useState(() => ({ ...FIELD_LABELS }));
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  const updateLabel = (k, v) => setCustomLabels(l => ({ ...l, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <Card title={`Editor de Etiquetas — ${rows.length} item(ns)`} className="max-w-5xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
        <p className="text-xs text-gray-400 mb-4">Ajuste os campos por item. Escolha o template apropriado (Revestimento para cerâmica/porcelanato, Ensacado para cimento/argamassa).</p>

        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Tamanho da impressão</label>
            <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
              <button onClick={()=>setSizeMode('small')} className={`flex-1 py-2 text-xs font-bold rounded ${sizeMode==='small'?'bg-yellow-500 text-gray-900':'text-gray-400'}`}>Tamanho atual (3 por A4)</button>
              <button onClick={()=>setSizeMode('full')} className={`flex-1 py-2 text-xs font-bold rounded ${sizeMode==='full'?'bg-yellow-500 text-gray-900':'text-gray-400'}`}>1 etiqueta inteira por A4</button>
            </div>
          </div>
          <div>
            <button type="button" onClick={()=>setShowLabelEdit(s=>!s)} className="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase">{showLabelEdit?'▼':'▶'} Editar títulos dos campos (Rua, Gaveta, etc.)</button>
            {showLabelEdit && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                {Object.keys(FIELD_LABELS).filter(k=>k!=='nome'&&k!=='sku').map(k => (
                  <Input key={k} label={FIELD_LABELS[k]} value={customLabels[k] || ''} onChange={e=>updateLabel(k, e.target.value)} placeholder={FIELD_LABELS[k]} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((row, idx) => {
            const tpl = LABEL_TEMPLATES[row._template];
            return (
              <div key={row.id || idx} className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <strong className="text-yellow-400 text-sm">{row.nome}</strong>
                  <Select label="" value={row._template} onChange={e => update(idx, '_template', e.target.value)} options={Object.entries(LABEL_TEMPLATES).map(([k,v]) => ({ value: k, label: v.label }))} className="!w-auto" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Input label="Nome (título da etiqueta)" value={row.nome || ''} onChange={e => update(idx, 'nome', e.target.value)} />
                  {tpl.fields.filter(f=>f!=='nome').map(f => (
                    <Input key={f} label={customLabels[f] || FIELD_LABELS[f] || f} value={row[f] || ''} onChange={e => update(idx, f, e.target.value)} type={f === 'validade' ? 'date' : 'text'} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-800 mt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onConfirm(rows, { sizeMode, labels: customLabels })} className="flex-1 !bg-yellow-500"><PrinterIcon size={16} className="mr-2"/> Imprimir Etiquetas</Button>
        </div>
      </Card>
    </div>
  );
};


// Modal de filtros avançados para impressão da FVM
const FvmFiltersModal = ({ onClose, produtos, movimentacoes, empreiteiras, showMsg }) => {
  useSuspendRealtime();
  const [tipo, setTipo] = useState('range'); // 'range' | 'mes'
  const hoje = new Date();
  const primeiroMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
  const [dataInicio, setDataInicio] = useState(primeiroMes);
  const [dataFim, setDataFim] = useState(ultimoDia);
  const [mes, setMes] = useState(new Date().toISOString().slice(0,7));
  const [categoria, setCategoria] = useState('ALL');
  const [empreiteira, setEmpreiteira] = useState('ALL');
  const [skuFiltro, setSkuFiltro] = useState('');

  const categoriasFVM = useMemo(() => {
    const s = new Set();
    (produtos || []).forEach(p => { const c = (p.categoria_fvm || inferCategoriaFVM(p.nome) || '').toUpperCase(); if (c) s.add(c); });
    return [...s].sort();
  }, [produtos]);

  const gerar = () => {
    printFVMReport({
      produtos, movimentacoes,
      mes: tipo === 'mes' ? mes : null,
      dataInicio: tipo === 'range' ? dataInicio : null,
      dataFim: tipo === 'range' ? dataFim : null,
      empreiteira, categoria,
      skuFiltro: skuFiltro || null,
      showMsg,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <Card className="w-full max-w-xl !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900">
          <h3 className="text-white font-bold flex items-center gap-2"><Filter size={18} className="text-yellow-400"/> Filtros da FVM PBQP-H</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
            <button onClick={()=>setTipo('range')} className={`flex-1 py-2 text-xs font-bold rounded ${tipo==='range'?'bg-yellow-500 text-gray-900':'text-gray-400'}`}>Intervalo de Datas</button>
            <button onClick={()=>setTipo('mes')} className={`flex-1 py-2 text-xs font-bold rounded ${tipo==='mes'?'bg-yellow-500 text-gray-900':'text-gray-400'}`}>Mês de Referência</button>
          </div>
          {tipo === 'range' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Data Início" type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} />
              <Input label="Data Fim" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
            </div>
          ) : (
            <Input label="Mês de Referência" type="month" value={mes} onChange={e=>setMes(e.target.value)} />
          )}
          <Select label="Categoria FVM" value={categoria} onChange={e=>setCategoria(e.target.value)} options={['ALL', ...categoriasFVM]} />
          <Select label="Empreiteira" value={empreiteira} onChange={e=>setEmpreiteira(e.target.value)} options={['ALL', ...(empreiteiras||[])]} />
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Item específico (opcional)</label>
            <input value={skuFiltro} onChange={e=>setSkuFiltro(e.target.value)} placeholder="ID ou SKU do produto" className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500 text-sm font-mono" />
          </div>
          <div className="flex gap-3 pt-3 border-t border-gray-800">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={gerar} className="flex-1 !bg-yellow-500 !text-gray-900"><Printer className="w-4 h-4 mr-2"/> Gerar FVM</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};



const HistoricoMovItemModal = ({ item, movimentacoes, onClose }) => {
  useSuspendRealtime();
  const movs = useMemo(() => (movimentacoes || [])
    .filter(m => m.sku === item.id || m.sku === item.sku)
    .sort((a,b) => new Date(b.data) - new Date(a.data)),
  [movimentacoes, item]);

  const entradas = movs.filter(m => m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCAO').reduce((s,m) => s + (Number(m.qtd)||0), 0);
  const saidas = movs.filter(m => m.tipo === 'SAIDA' || m.tipo === 'SAÍDA').reduce((s,m) => s + (Number(m.qtd)||0), 0);
  const saldo = Math.max(0, entradas - saidas);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const rows = movs.map(m => `
      <tr>
        <td>${formatBRDate(m.data)}</td>
        <td><strong>${m.tipo}</strong></td>
        <td style="text-align:right">${m.qtd}</td>
        <td>${m.origem || '-'}</td>
        <td>${m.destino || '-'}</td>
        <td>${m.responsavel || '-'}</td>
        <td>${(m.obs || '').replace(/</g,'&lt;')}</td>
      </tr>`).join('');
    win.document.write(`
      <html><head><title>Histórico - ${item.nome}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{margin:0 0 4px;font-size:18px} h2{margin:0 0 16px;font-size:13px;color:#555;font-weight:normal}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #999;padding:5px 6px;text-align:left}
        th{background:#222;color:#fff}
        .resumo{margin:12px 0;padding:10px;background:#f3f4f6;border:1px solid #ccc;border-radius:6px;display:flex;gap:20px;font-size:12px}
        .resumo b{display:block;font-size:16px;color:#111}
      </style></head><body>
      <h1>Histórico de Movimentação</h1>
      <h2>${item.nome} — SKU ${item.sku} — ${item.categoria || 'Geral'}</h2>
      <div class="resumo">
        <div>Entradas <b style="color:#059669">+${entradas}</b></div>
        <div>Saídas <b style="color:#dc2626">-${saidas}</b></div>
        <div>Saldo calculado <b>${saldo}</b></div>
        <div>Registros <b>${movs.length}</b></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Origem</th><th>Destino</th><th>Responsável</th><th>Observação</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">Sem movimentações registradas.</td></tr>'}</tbody>
      </table>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-cyan-900/30 rounded-lg flex items-center justify-center shrink-0"><History className="w-5 h-5 text-cyan-400"/></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">Acompanhar Movimentação</h2>
              <p className="text-xs text-gray-400 truncate">{item.nome} · SKU {item.sku}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="!py-1 !px-3 text-xs"><Printer className="w-4 h-4 mr-1"/> Imprimir</Button>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X className="w-5 h-5"/></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 border-b border-gray-800">
          <div className="bg-green-900/20 border border-green-900/40 rounded-lg p-3"><p className="text-[10px] uppercase font-bold text-green-400">Entradas</p><p className="text-2xl font-black text-green-400">+{entradas}</p></div>
          <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-3"><p className="text-[10px] uppercase font-bold text-red-400">Saídas</p><p className="text-2xl font-black text-red-400">-{saidas}</p></div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3"><p className="text-[10px] uppercase font-bold text-gray-400">Saldo Calc.</p><p className="text-2xl font-black text-white">{saldo}</p></div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3"><p className="text-[10px] uppercase font-bold text-gray-400">Registros</p><p className="text-2xl font-black text-white">{movs.length}</p></div>
        </div>
        <div className="overflow-auto flex-1 p-4 space-y-2">
          {movs.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-50"/>Sem movimentações registradas para este material.</div>
          ) : movs.map(mov => {
            const isEntrada = mov.tipo === 'ENTRADA' || mov.tipo === 'DEVOLUCAO';
            return (
              <div key={mov.id} className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-800 rounded-lg">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isEntrada ? 'bg-green-900/30 text-green-400' : mov.tipo==='AJUSTE'?'bg-blue-900/30 text-blue-400':'bg-red-900/30 text-red-400'}`}>
                  {isEntrada ? <ArrowDownCircle className="w-4 h-4"/> : <ArrowRightLeft className="w-4 h-4"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`font-black ${isEntrada?'text-green-400':mov.tipo==='AJUSTE'?'text-blue-400':'text-red-400'}`}>{mov.tipo}</span>
                    <span className="font-mono text-gray-300">{formatBRDate(mov.data)}</span>
                    {mov.responsavel && <span className="text-gray-400"><span className="text-gray-500">Resp:</span> {mov.responsavel}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3">
                    {mov.origem && <span><span className="text-gray-500 font-bold">Origem:</span> {mov.origem}</span>}
                    {mov.destino && <span><span className="text-gray-500 font-bold">Destino:</span> {mov.destino}</span>}
                  </div>
                  {mov.obs && <p className="text-xs text-gray-500 mt-1 italic">{mov.obs}</p>}
                </div>
                <div className={`text-xl font-black shrink-0 ${isEntrada?'text-green-400':mov.tipo==='AJUSTE'?'text-blue-400':'text-red-400'}`}>{isEntrada?'+':mov.tipo==='AJUSTE'?'':'-'}{mov.qtd}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const EstoqueView = ({ produtos, movimentacoes, onSave, onDelete, onPrintLowStock, onPrintLabel, onImportXML, showMsg }) => {
  const [mesFVM, setMesFVM] = useState(() => new Date().toISOString().slice(0,7));
  const [showFvmFilters, setShowFvmFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCateg, setFilterCateg] = useState('ALL');
  const [filterEmpreiteira, setFilterEmpreiteira] = useState('ALL');
  const [filterEstoque, setFilterEstoque] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [labelQueue, setLabelQueue] = useState(null); // itens prestes a imprimir
  const [historicoItem, setHistoricoItem] = useState(null); // item para mostrar histórico de movimentação

  const toggleSel = (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(filteredItemsRef.current.map(i => i.id)));
  const filteredItemsRef = useRef([]);
  const openLabelEditor = (items) => {
    if (!items || items.length === 0) { showMsg('Aviso', 'Selecione ao menos um item para imprimir etiquetas.'); return; }
    setLabelQueue(items);
  };
  const handleBulkPrint = () => {
    const items = (produtos || []).filter(p => selectedIds.has(p.id));
    openLabelEditor(items);
  };
  const [filterRua, setFilterRua] = useState('ALL');
  const ruasUnicas = useMemo(() => [...new Set((produtos || []).map(p => String(p.rua || '').trim()).filter(Boolean))].sort(), [produtos]);
  const handlePrintByRua = () => {
    if (filterRua === 'ALL') return;
    const items = (produtos || []).filter(p => String(p.rua || '').trim() === filterRua && String(p.ativo) !== 'false');
    openLabelEditor(items);
  };


  // Recalcula saldo_atual de TODOS os produtos a partir das movimentações
  // (ENTRADA = +, SAIDA/DEVOLUCAO = -). Corrige divergências de estoque.
  const handleRecalcSaldos = async () => {
    const conf = await showMsg('Recalcular Saldos', 'Vou recalcular o saldo real de cada produto somando todas as ENTRADAS e subtraindo as SAÍDAS registradas. Continuar?', true);
    if (!conf) return;
    const movs = movimentacoes || [];
    let atualizados = 0;
    for (const p of (produtos || [])) {
      const entradas = movs.filter(m => (m.sku === p.id || m.sku === p.sku) && m.tipo === 'ENTRADA').reduce((s,m) => s + (Number(m.qtd)||0), 0);
      const saidas = movs.filter(m => (m.sku === p.id || m.sku === p.sku) && (m.tipo === 'SAIDA' || m.tipo === 'SAÍDA')).reduce((s,m) => s + (Number(m.qtd)||0), 0);
      const realSaldo = Math.max(0, entradas - saidas);
      if (Number(p.saldo_atual || 0) !== realSaldo) {
        await AppDB.put('produtos', { ...p, saldo_atual: realSaldo });
        atualizados++;
      }
    }
    showMsg('Saldos recalculados', `${atualizados} produto(s) tiveram o saldo corrigido com base nas movimentações reais.`);
  };

  // Revisa e reclassifica TODOS os produtos cadastrados aplicando a base
  // de conhecimento PBQP-H (categoria, FVM, unidade, rastreabilidade,
  // exigências) e o DNA correto pelo nome/descrição.
  const handleReclassificarTodos = async () => {
    const conf = await showMsg(
      'Revisar e Reclassificar Materiais',
      'Vou reanalisar TODOS os materiais cadastrados aplicando a classificação PBQP-H (categoria, FVM, unidade, rastreabilidade e DNA correto). Campos já preenchidos manualmente serão preservados quando possível. Continuar?',
      true
    );
    if (!conf) return;
    let atualizados = 0;
    let dnaCorrigidos = 0;
    for (const p of (produtos || [])) {
      const nome = `${p.nome || ''} ${p.descricao || ''}`;
      const kb = classifyMaterialPBQPH(nome);
      const novaCategoria = (!p.categoria || p.categoria === 'Outros' || p.categoria === 'Geral') ? kb.categoria : p.categoria;
      const novaCategoriaFVM = p.categoria_fvm || kb.categoria_fvm;
      const novaUnidade = (!p.unidade || p.unidade === 'UN') ? kb.unidade : p.unidade;
      const novoDnaType = resolveMaterialDNAType({ descricao: nome, almox_categoria: novaCategoria }, kb) || p.dna_type || '';
      const patch = {
        ...p,
        categoria: novaCategoria,
        categoria_fvm: novaCategoriaFVM,
        unidade: novaUnidade,
        classe_pbqph: p.classe_pbqph || kb.classe,
        rastreavel: p.rastreavel || kb.rastreavel,
        exige_certificado: p.exige_certificado ?? kb.exigeCertificado,
        exige_fvm: p.exige_fvm ?? kb.exigeFVM,
        exige_lote: p.exige_lote ?? kb.exigeLote,
        exige_fabricante: p.exige_fabricante ?? kb.exigeFabricante,
        dna_type: novoDnaType,
        dna_payload: p.dna_payload || {},
      };
      const mudou =
        patch.categoria !== p.categoria ||
        patch.categoria_fvm !== p.categoria_fvm ||
        patch.unidade !== p.unidade ||
        patch.classe_pbqph !== p.classe_pbqph ||
        patch.rastreavel !== p.rastreavel ||
        patch.dna_type !== (p.dna_type || '');
      if (patch.dna_type !== (p.dna_type || '')) dnaCorrigidos++;
      if (mudou) {
        await AppDB.put('produtos', patch);
        atualizados++;
      }
    }
    showMsg(
      'Reclassificação concluída',
      `${atualizados} material(is) reclassificado(s). DNA ajustado em ${dnaCorrigidos} item(ns). Base PBQP-H aplicada com sucesso.`
    );
  };



  const filteredItems = useMemo(() => {
    let result = (produtos || []).filter(i => String(i.ativo) !== 'false');
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i => String(i.nome).toLowerCase().includes(s) || String(i.sku).toLowerCase().includes(s) || String(i.empreiteira || '').toLowerCase().includes(s));
    }
    if (filterCateg !== 'ALL') result = result.filter(i => (i.categoria || 'Geral') === filterCateg);
    if (filterEmpreiteira !== 'ALL') result = result.filter(i => (i.empreiteira || 'Sem Empreiteira') === filterEmpreiteira);
    if (filterEstoque === 'LOW') result = result.filter(i => (Number(i.saldo_atual) || 0) < (Number(i.estoque_minimo) || 5));
    else if (filterEstoque === 'OUT') result = result.filter(i => (Number(i.saldo_atual) || 0) <= 0);
    return result.sort((a,b) => a.nome.localeCompare(b.nome));
  }, [produtos, search, filterCateg, filterEmpreiteira, filterEstoque]);

  const categoriasUnicas = useMemo(() => [...new Set([...CATEGORIAS_PADRAO, ...(produtos || []).map(p => p.categoria || 'Geral')])].sort(), [produtos]);
  const empreiteirasUnicas = useMemo(() => [...new Set((produtos || []).map(p => p.empreiteira).filter(Boolean))].sort(), [produtos]);

  filteredItemsRef.current = filteredItems;
  return (
    <div className="space-y-4 animate-in fade-in">

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between print:hidden bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input type="text" placeholder="Buscar por nome, SKU ou empreiteira..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" />
          </div>
          <select value={filterCateg} onChange={(e) => setFilterCateg(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todas Categorias</option>{categoriasUnicas.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={filterEmpreiteira} onChange={(e) => setFilterEmpreiteira(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todas Empreiteiras</option>{empreiteirasUnicas.map(e => <option key={e} value={e}>{e}</option>)}</select>
          <select value={filterEstoque} onChange={(e) => setFilterEstoque(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todos Estoque</option><option value="LOW">Estoque Baixo</option><option value="OUT">Sem Estoque</option></select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {onImportXML && <Button variant="outline" onClick={onImportXML} className="!bg-blue-900/20 !border-blue-800 !text-blue-400 hover:!bg-blue-900/40"><FileCode className="w-4 h-4 mr-1"/> Importar XML NF-e</Button>}
          <Button variant="outline" onClick={() => onPrintLowStock(produtos)} title="Relatório de Estoque Baixo" className="!text-red-400 !border-red-900 hover:!bg-red-900/20"><Printer className="w-4 h-4 mr-1"/> Estoque Baixo</Button>
          <Button variant="outline" onClick={() => printEstoqueGeralReport(produtos, 'ALL', showMsg)} title="Relatório Geral de Estoque (todas empreiteiras)"><Printer className="w-4 h-4 mr-1"/> Geral</Button>
          <Button variant="outline" onClick={() => printEstoqueGeralReport(produtos, filterEmpreiteira, showMsg)} title="Relatório por Empreiteira selecionada" className="!text-blue-400 !border-blue-900 hover:!bg-blue-900/20" disabled={filterEmpreiteira === 'ALL'}><Printer className="w-4 h-4 mr-1"/> {filterEmpreiteira === 'ALL' ? 'Por Empreiteira' : filterEmpreiteira}</Button>
          <div className="flex items-center gap-1 bg-gray-800/60 border border-gray-700 rounded-lg px-2">
            <input type="month" value={mesFVM} onChange={e=>setMesFVM(e.target.value)} className="bg-transparent text-gray-100 text-xs py-1.5 outline-none" title="Mês de referência FVM"/>
            <Button variant="outline" onClick={() => printFVMReport({ produtos, movimentacoes, mes: mesFVM, empreiteira: filterEmpreiteira, showMsg })} className="!text-yellow-300 !border-yellow-800 hover:!bg-yellow-900/20 !py-1 !px-2 text-xs" title="Gerar FVM PBQP-H (PO 7.10) do mês"><Printer className="w-4 h-4 mr-1"/> FVM Mês</Button>
            <Button variant="outline" onClick={() => setShowFvmFilters(true)} className="!text-yellow-200 !border-yellow-800 hover:!bg-yellow-900/20 !py-1 !px-2 text-xs" title="FVM com filtros (data, categoria, empreiteira)"><Filter className="w-4 h-4 mr-1"/> FVM Filtros</Button>
          </div>
          <Button variant="outline" onClick={handleRecalcSaldos} title="Recalcula o saldo real de cada produto somando ENTRADAS e SAÍDAS registradas" className="!text-green-400 !border-green-900 hover:!bg-green-900/20"><RefreshCw className="w-4 h-4 mr-1"/> Recalcular Saldos</Button>
          <Button variant="outline" onClick={handleReclassificarTodos} title="Revisa e reclassifica TODOS os materiais cadastrados pela base PBQP-H (categoria, FVM, unidade, DNA)" className="!text-purple-300 !border-purple-900 hover:!bg-purple-900/20" data-write="1"><Tag className="w-4 h-4 mr-1"/> Reclassificar Materiais</Button>
          <Button onClick={() => { setEditingItem(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1"/> Adicionar ao Estoque</Button>
        </div>
      </div>


      <div className="flex items-center justify-between gap-2 print:hidden -mt-1 pl-1 flex-wrap">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Leia o XML da NF-e direto aqui: produtos da nota aparecem lado a lado com o estoque para vincular ou criar.</p>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && <span className="text-xs text-yellow-400 font-bold">{selectedIds.size} selecionado(s)</span>}
          <button onClick={selectAllVisible} className="text-[11px] text-blue-400 hover:text-blue-300 font-bold">Sel. Todos</button>
          <button onClick={clearSel} className="text-[11px] text-red-400 hover:text-red-300 font-bold">Limpar</button>
          <div className="flex items-center gap-1 bg-gray-800/60 border border-gray-700 rounded-lg px-2">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Rua</span>
            <select value={filterRua} onChange={e=>setFilterRua(e.target.value)} className="bg-transparent text-gray-100 text-xs py-1.5 outline-none" title="Filtrar etiquetas por Rua">
              <option value="ALL">Todas</option>
              {ruasUnicas.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button onClick={handlePrintByRua} disabled={filterRua==='ALL'} className="!bg-yellow-700 !text-gray-100 !py-1 !px-2 text-xs disabled:opacity-40" title="Imprimir etiquetas dos itens dessa Rua"><PrinterIcon className="w-3.5 h-3.5 mr-1"/> Etiquetas da Rua</Button>
          </div>
          <Button onClick={handleBulkPrint} className="!bg-yellow-600 !text-gray-900 !py-1 !px-3 text-xs"><PrinterIcon className="w-3.5 h-3.5 mr-1"/> Editar e Imprimir Etiquetas</Button>
        </div>
      </div>



      {showForm && <ProdutoFormModal onClose={() => { setShowForm(false); setEditingItem(null); }} onSave={(d) => { onSave(d); setShowForm(false); setEditingItem(null); }} initialData={editingItem} produtosExistentes={produtos} categorias={categoriasUnicas} empreiteiras={empreiteirasUnicas} showMsg={showMsg} />}
      {labelQueue && <LabelEditorModal items={labelQueue} onClose={() => setLabelQueue(null)} onConfirm={(edited, opts) => { onPrintLabel(edited, opts); setLabelQueue(null); clearSel(); }} />}
      {historicoItem && <HistoricoMovItemModal item={historicoItem} movimentacoes={movimentacoes} onClose={() => setHistoricoItem(null)} />}
      {showFvmFilters && <FvmFiltersModal onClose={() => setShowFvmFilters(false)} produtos={produtos} movimentacoes={movimentacoes} empreiteiras={empreiteirasUnicas} showMsg={showMsg} />}

      <div className="grid gap-3">
        {filteredItems.length === 0 ? (
          <Card className="text-center py-12"><Package className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-500">Nenhum item encontrado no estoque.</p></Card>
        ) : (
          filteredItems.map(item => {
            const saldo = Number(item.saldo_atual) || 0;
            const minimo = Number(item.estoque_minimo) || 5;
            const stockStatus = saldo <= 0 ? 'text-red-400' : saldo < minimo ? 'text-yellow-400' : 'text-green-400';

            return (
              <Card key={item.id} className="hover:border-yellow-600 transition-colors p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleSel(item.id)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 print:hidden ${selectedIds.has(item.id) ? 'bg-yellow-500 border-yellow-500' : 'border-gray-600 hover:border-yellow-500'}`} title="Selecionar para etiqueta em lote">
                        {selectedIds.has(item.id) && <Check size={14} className="text-gray-900"/>}
                      </button>
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${saldo <= 0 ? 'bg-red-500' : saldo < minimo ? 'bg-yellow-500' : 'bg-green-500'}`}></div>

                      <div>
                        <h3 className="text-white font-semibold text-lg">{item.nome}</h3>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400 font-mono">
                          <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{item.sku}</span>
                          <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{item.categoria || 'Geral'}</span>
                          <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{item.unidade}</span>
                          {item.empreiteira && <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900/50">{item.empreiteira}</span>}
                          {item.rua && item.prateleira && <span className="bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded border border-yellow-900/50">R{item.rua}-P{item.prateleira}</span>}
                          {item.rastreavel && <span className="bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded border border-purple-900/50 flex items-center gap-1"><Tag size={10}/> PBQP-H</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 border-t lg:border-t-0 border-gray-800 pt-4 lg:pt-0">
                    <div className="text-center"><p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Mínimo</p><p className="text-white font-medium">{minimo}</p></div>
                    <div className="text-center"><p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Atual</p><p className={`text-2xl font-black ${stockStatus}`}>{saldo}</p></div>
                    <div className="flex gap-1.5 print:hidden">
                      <button onClick={() => setHistoricoItem(item)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400 transition" title="Acompanhar Movimentação deste material"><History className="w-4 h-4"/></button>
                      <button onClick={() => openLabelEditor([item])} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition" title="Editar e Imprimir Etiqueta"><PrinterIcon className="w-4 h-4"/></button>
                      <button onClick={() => printFVMReport({ produtos, movimentacoes, skuFiltro: item.id, showMsg, titulo: `FVM PBQP-H — ${item.nome}` })} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-yellow-400 transition" title="Imprimir FVM deste item"><FileCheck className="w-4 h-4"/></button>
                      <button onClick={() => { setEditingItem(item); setShowForm(true); }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-blue-400 transition" title="Editar"><Edit className="w-4 h-4"/></button>
                      <button onClick={async () => { if(await showMsg("Confirmação", `Deseja excluir "${item.nome}"?`, true)) onDelete(item.id); }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-red-400 transition" title="Excluir"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const ProdutoFormModal = ({ onClose, onSave, initialData, produtosExistentes, categorias, empreiteiras, showMsg }) => {
  useSuspendRealtime();
  const [modo, setModo] = useState(initialData ? 'editar' : 'novo'); // 'novo' | 'existente' | 'editar'
  const [buscaExistente, setBuscaExistente] = useState('');
  
  const [form, setForm] = useState(() => ({
    id: initialData?.id || `PROD-${generateId()}`, sku: initialData?.sku || `SKU-${generateId()}`,
    nome: initialData?.nome || '', descricao: initialData?.descricao || '', categoria: initialData?.categoria || CATEGORIAS_PADRAO[0],
    unidade: initialData?.unidade || 'UN', saldo_atual: initialData?.saldo_atual || 0, qtd_inicial: initialData?.qtd_inicial || 0,
    qtd_entrada: 0, // Novo campo para entrada em item existente
    estoque_minimo: initialData?.estoque_minimo || 5, local_armazenamento: initialData?.local_armazenamento || AREAS_ESTOCAGEM[0],
    rua: initialData?.rua || '', prateleira: initialData?.prateleira || '', gaveta: initialData?.gaveta || '',
    aplicacao: initialData?.aplicacao || '', empreiteira: initialData?.empreiteira || '',
    dna_type: initialData?.dna_type || '', dna_payload: initialData?.dna_payload || {}, fornecedor_nf: initialData?.fornecedor_nf || '',
    ordem_compra: initialData?.ordem_compra || '',
    anexo_nf_url: initialData?.anexo_nf_url || '', anexo_nf_nome: initialData?.anexo_nf_nome || '',
    lote: initialData?.lote || '', validade: initialData?.validade || '', preco_unitario: initialData?.preco_unitario || 0, ativo: initialData?.ativo !== false, rastreavel: !!initialData?.rastreavel
  }));
  const xmlInputRef = useRef(null);
  const [xmlLoading, setXmlLoading] = useState(false);

  const handleReadXmlInForm = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) { showMsg('Aviso', 'Selecione um arquivo .xml da NF-e.'); return; }
    setXmlLoading(true);
    try {
      const data = await parseXMLNFe(file);
      const first = data.produtos[0];
      if (!first) { showMsg('Aviso', 'Nenhum produto encontrado na NF-e.'); return; }
      const nfTag = `${data.emitente?.razao || 'Fornecedor'} - NF ${data.numeroNF || ''}`.trim();
      // DNA payload dinâmico vindo do XML <controle_rigoroso>
      const dnaPayloadFromXml = {};
      if (first.rig_classificacao && (first.rig_classificacao.toUpperCase().includes('CONCRET'))) {
        if (first.rig_concretagem?.fck) dnaPayloadFromXml.fck = first.rig_concretagem.fck;
        if (first.rig_concretagem?.slump) dnaPayloadFromXml.slump = first.rig_concretagem.slump;
        if (first.rig_concretagem?.lote_usina) dnaPayloadFromXml.lote_usina = first.rig_concretagem.lote_usina;
        if (first.rig_concretagem?.volume) dnaPayloadFromXml.volume = first.rig_concretagem.volume;
      }
      if (first.rig_classificacao && first.rig_classificacao.toUpperCase().includes('AÇO')) {
        if (first.rig_aco?.corrida_lote) dnaPayloadFromXml.corrida_lote = first.rig_aco.corrida_lote;
        if (first.rig_aco?.bitola) dnaPayloadFromXml.bitola = first.rig_aco.bitola;
        if (first.rig_aco?.ca_categoria) dnaPayloadFromXml.ca_categoria = first.rig_aco.ca_categoria;
        if (first.rig_aco?.fabricante) dnaPayloadFromXml.fabricante = first.rig_aco.fabricante;
      }
      const fornecedorNF = first.rig_fornecedor_nf || `${data.emitente?.razao || ''} - NF ${data.numeroNF || ''}`.trim();
      setForm(prev => {
        if (modo === 'existente') {
          return {
            ...prev,
            qtd_entrada: Number(first.qtd) || 0,
            preco_unitario: Number(first.valorUnitario) || prev.preco_unitario,
            fornecedor_nf: fornecedorNF,
            lote: first.rig_lote || '',
            validade: first.rig_validade || '',
            aplicacao: first.almox_aplicacao || prev.aplicacao,
            empreiteira: first.almox_empreiteira || prev.empreiteira,
            local_armazenamento: first.almox_area_estocagem || prev.local_armazenamento,
          };
        }
        // Novo SKU: aplica ALMOX/RIGOROSO do XML quando presentes, com fallback no classifier PBQP-H
        const kb = classifyMaterialPBQPH(first.descricao || '');
        return {
          ...prev,
          nome: first.descricao || prev.nome,
          sku: first.codigo || prev.sku,
          unidade: (first.unidade || kb.unidade || 'UN').toUpperCase(),
          categoria: first.almox_categoria || kb.categoria,
          categoria_fvm: kb.categoria_fvm,
          classe_pbqph: kb.classe,
          rastreavel: first.rig_ativar_dna || kb.rastreavel,
          exige_certificado: kb.exigeCertificado,
          exige_fvm: kb.exigeFVM,
          exige_lote: kb.exigeLote,
          exige_fabricante: kb.exigeFabricante,
          qtd_inicial: Number(first.qtd) || 0,
          estoque_minimo: first.almox_estoque_minimo || prev.estoque_minimo,
          preco_unitario: Number(first.valorUnitario) || 0,
          descricao: first.almox_observacoes || prev.descricao || `Importado de ${nfTag}`,
          aplicacao: first.almox_aplicacao || prev.aplicacao,
          empreiteira: first.almox_empreiteira || prev.empreiteira,
          local_armazenamento: first.almox_area_estocagem || prev.local_armazenamento,
          fornecedor_nf: fornecedorNF,
          lote: first.rig_lote || '',
          validade: first.rig_validade || '',
          dna_type: first.rig_classificacao || prev.dna_type,
          dna_payload: { ...(prev.dna_payload || {}), ...dnaPayloadFromXml },
        };
      });
      // Mantém a seção DNA aberta para revisão
      setShowDna(true);
      showMsg('XML lido', `Pré-preenchido "${first.descricao}". Revise os campos antes de salvar.`);
    } catch (err) {
      showMsg('Erro no XML', err.message);
    } finally {
      setXmlLoading(false);
      if (xmlInputRef.current) xmlInputRef.current.value = '';
    }
  };

  const [showDna, setShowDna] = useState(true);

  const filteredProd = useMemo(() => {
    if(modo !== 'existente') return [];
    const s = buscaExistente.toLowerCase().trim();
    const ativos = produtosExistentes.filter(p => String(p.ativo)!=='false');
    if (!s) return ativos.sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).slice(0,200);
    return ativos.filter(p =>
      String(p.nome||'').toLowerCase().includes(s) ||
      String(p.sku||'').toLowerCase().includes(s) ||
      String(p.categoria||'').toLowerCase().includes(s) ||
      String(p.empreiteira||'').toLowerCase().includes(s)
    ).sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).slice(0,200);
  }, [produtosExistentes, buscaExistente, modo]);


  const handleSelectExistente = (prodId) => {
      const p = produtosExistentes.find(x => x.id === prodId);
      if(p) {
          setForm({
              ...p,
              qtd_entrada: 0,
              fornecedor_nf: '',
              lote: '',
              validade: ''
          });
          setShowDna(!!p.rastreavel);
      }
  };

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const handleDnaChange = (f, v) => setForm(p => ({ ...p, dna_payload: { ...p.dna_payload, [f]: v } }));

  const handleSaveClick = () => {
    if (!form.nome.trim()) { showMsg("Atenção", "Nome do item é obrigatório."); return; }
    
    let movimentacao = null;
    let finalSaldo = Number(form.saldo_atual);

    if (modo === 'novo') {
        if(Number(form.qtd_inicial) > 0) {
            movimentacao = {
                id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'ENTRADA', sku: form.id, qtd: Number(form.qtd_inicial),
                origem: form.fornecedor_nf || 'Cadastro Inicial', destino: form.local_armazenamento, obs: 'Entrada via Cadastro de Novo Item'
            };
            finalSaldo = Number(form.qtd_inicial);
        }
    } else if (modo === 'existente') {
        const qtdIn = Number(form.qtd_entrada || 0);
        if(qtdIn > 0) {
            movimentacao = {
                id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'ENTRADA', sku: form.id, qtd: qtdIn,
                origem: form.fornecedor_nf || 'Atualização/Entrada', destino: form.local_armazenamento, obs: 'Entrada em item existente'
            };
            finalSaldo += qtdIn;
        }
    }

    onSave({ 
        produto: { ...form, saldo_atual: finalSaldo, rastreavel: showDna },
        movimentacao
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card title={modo === 'editar' ? 'Editar Insumo' : 'Adicionar Insumo ao Estoque'} className="max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
        <div className="space-y-6">
          
          {!initialData && (
              <div className="flex gap-2 p-1 bg-gray-950 rounded-lg border border-gray-800">
                  <button onClick={() => setModo('novo')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${modo==='novo'?'bg-yellow-500 text-gray-900 shadow':'text-gray-400 hover:text-white'}`}>Cadastrar Novo Item (Novo SKU)</button>
                  <button onClick={() => setModo('existente')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${modo==='existente'?'bg-yellow-500 text-gray-900 shadow':'text-gray-400 hover:text-white'}`}>Dar Entrada em Existente (Manter SKU)</button>
              </div>
          )}

          {modo !== 'editar' && (
            <div className="bg-blue-900/15 border border-blue-800/40 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 text-blue-300 text-xs font-bold flex-1">
                <FileCode size={16}/>
                <div>
                  <div>Importação Nativa de XML (NF-e)</div>
                  <div className="text-[10px] text-blue-200/70 font-normal">
                    {modo === 'existente'
                      ? 'Lê o XML, preenche Qtd a entrar e mantém SKU/local. NF, Lote e Validade ficam em branco para você preencher.'
                      : 'Lê o XML, pré-preenche nome, SKU, unidade, qtd e preço. NF, Lote e Validade ficam em branco para você preencher.'}
                  </div>
                </div>
              </div>
              <input ref={xmlInputRef} type="file" accept=".xml" onChange={(e) => handleReadXmlInForm(e.target.files?.[0])} className="hidden" id="xml-form-upload" />
              <label htmlFor="xml-form-upload" className={`cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold ${xmlLoading?'bg-gray-700 text-gray-400':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                {xmlLoading ? <Spinner /> : <><FileDigit size={14}/> Ler XML e preencher</>}
              </label>
            </div>
          )}

          {modo === 'existente' && (
              <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-4 animate-in fade-in">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 z-10" />
                    <input
                      value={buscaExistente}
                      onChange={e=>setBuscaExistente(e.target.value)}
                      placeholder="Pesquisar por nome, SKU ou categoria para vincular..."
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500 text-sm"
                    />
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-blue-300 mb-1">
                    {filteredProd.length} resultado(s) — clique para vincular
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar bg-gray-950 border border-gray-800 rounded-lg divide-y divide-gray-800">
                    {filteredProd.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500">Nenhum produto encontrado.</div>
                    ) : filteredProd.map(p => {
                      const isSel = form.id === p.id;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => handleSelectExistente(p.id)}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-900/30 transition flex items-center justify-between gap-3 ${isSel ? 'bg-blue-900/40 border-l-2 border-yellow-500' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white font-semibold truncate">{p.nome}</div>
                            <div className="text-[10px] text-gray-400 font-mono flex gap-2 flex-wrap">
                              <span className="bg-gray-800 px-1.5 py-0.5 rounded">{p.sku}</span>
                              <span className="bg-gray-800 px-1.5 py-0.5 rounded">{p.categoria || 'Geral'}</span>
                              <span className="bg-gray-800 px-1.5 py-0.5 rounded">{p.unidade}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase text-gray-500">Saldo</div>
                            <div className={`text-base font-black ${(Number(p.saldo_atual)||0) <= 0 ? 'text-red-400' : 'text-green-400'}`}>{p.saldo_atual || 0}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {form.id && form.nome && (
                    <div className="mt-2 text-xs text-green-400 font-bold flex items-center gap-1">
                      <Check size={14}/> Vinculado a: {form.nome} [{form.sku}]
                    </div>
                  )}
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nome do Item" value={form.nome} onChange={(e) => handleChange('nome', e.target.value)} required autoFocus={modo==='novo'}/><Input label="SKU/Código" value={form.sku} onChange={(e) => handleChange('sku', e.target.value)} disabled={modo==='existente'} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Select label="Categoria" value={form.categoria} onChange={(e) => handleChange('categoria', e.target.value)} options={categorias} /><Input label="Unidade" value={form.unidade} onChange={(e) => handleChange('unidade', e.target.value.toUpperCase())} placeholder="UN, KG, M, L" /><Input label="Preço Unitário (R$)" type="number" step="0.01" value={form.preco_unitario} onChange={(e) => handleChange('preco_unitario', parseFloat(e.target.value) || 0)} /></div>
          
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2 text-sm"><Building2 size={16}/> Apropriação / Empreiteira</h3>
            <Input label="Empreiteira / Centro de Custo" value={form.empreiteira} onChange={(e) => handleChange('empreiteira', e.target.value)} list="empreiteiras-list" placeholder="Digite ou selecione..." />
            <datalist id="empreiteiras-list">
                {empreiteiras.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 space-y-3">
            <h3 className="text-yellow-400 font-semibold flex items-center gap-2 text-sm"><MapPin size={16}/> Localização Física</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Select label="Área de Estocagem" value={form.local_armazenamento} onChange={(e) => handleChange('local_armazenamento', e.target.value)} options={AREAS_ESTOCAGEM} /><Input label="Aplicação / Uso" value={form.aplicacao} onChange={(e) => handleChange('aplicacao', e.target.value)} placeholder="Ex: Alvenaria, Acabamento, Estrutura..." /></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Input label="Rua" value={form.rua} onChange={(e) => handleChange('rua', e.target.value)} placeholder="Ex: A, B, 1" /><Input label="Prateleira" value={form.prateleira} onChange={(e) => handleChange('prateleira', e.target.value)} placeholder="Ex: P1, 05" /><Input label="Gaveta" value={form.gaveta} onChange={(e) => handleChange('gaveta', e.target.value)} placeholder="Ex: G3" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modo === 'existente' ? (
                <>
                <Input label="Saldo Atual no Sistema" type="number" value={form.saldo_atual} disabled className="opacity-50" />
                <Input label="Qtd a dar Entrada Agora" type="number" value={form.qtd_entrada} onChange={(e) => handleChange('qtd_entrada', parseFloat(e.target.value) || 0)} className="border-green-500 bg-green-900/10" />
                </>
            ) : (
                <Input label="Quantidade Inicial" type="number" value={form.qtd_inicial} onChange={(e) => handleChange('qtd_inicial', parseFloat(e.target.value) || 0)} />
            )}
            <Input label="Estoque Mínimo" type="number" value={form.estoque_minimo} onChange={(e) => handleChange('estoque_minimo', parseFloat(e.target.value) || 0)} />
          </div>

          <div className="border border-purple-900/50 bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-3">
              <h3 className="text-purple-400 font-semibold flex items-center gap-2 text-sm"><ClipboardCheck size={16}/> Controle Rigoroso (PBQP-H / ISO 9001)</h3>
              <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-700 transition"><input type="checkbox" checked={showDna} onChange={(e) => setShowDna(e.target.checked)} className="rounded border-gray-600 bg-gray-900 text-purple-500 w-4 h-4 cursor-pointer" /><span className="text-sm font-bold text-gray-300">Ativar DNA Material</span></label>
            </div>
            {showDna && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Input label="Fornecedor / NF" value={form.fornecedor_nf} onChange={(e) => handleChange('fornecedor_nf', e.target.value)} /><Input label="Lote Identificador" value={form.lote} onChange={(e) => handleChange('lote', e.target.value)} /><Input label="Data de Validade" type="date" value={form.validade ? form.validade.split('T')[0] : ''} onChange={(e) => handleChange('validade', e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Ordem de Compra (OC)" value={form.ordem_compra} onChange={(e) => handleChange('ordem_compra', e.target.value)} placeholder="Ex: OC-2025-0123" />
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Anexar NF (PDF/Imagem)</label>
                    <div className="flex items-center gap-2">
                      <input type="file" accept=".pdf,image/*" id="nf-anexo-up" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 5 * 1024 * 1024) { showMsg('Anexo NF', 'Arquivo maior que 5MB. Comprima antes de anexar.'); return; }
                        const reader = new FileReader();
                        reader.onload = () => { handleChange('anexo_nf_url', reader.result); handleChange('anexo_nf_nome', f.name); };
                        reader.readAsDataURL(f);
                        e.target.value = '';
                      }} />
                      <label htmlFor="nf-anexo-up" className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white">
                        <Upload size={14}/> {form.anexo_nf_url ? 'Trocar anexo' : 'Selecionar arquivo'}
                      </label>
                      {form.anexo_nf_url && (
                        <button type="button" onClick={() => { handleChange('anexo_nf_url',''); handleChange('anexo_nf_nome',''); }} className="px-2 py-2 rounded-md bg-red-900/30 text-red-300 text-xs border border-red-900" title="Remover anexo"><X size={14}/></button>
                      )}
                    </div>
                    {form.anexo_nf_nome && <div className="mt-1 text-[10px] text-green-400 truncate" title={form.anexo_nf_nome}>📎 {form.anexo_nf_nome}</div>}
                  </div>
                </div>
                <Select label="Classificação Estrutural (Tipo de DNA)" value={form.dna_type} onChange={(e) => { handleChange('dna_type', e.target.value); handleChange('dna_payload', {}); }} options={['', ...Object.keys(DNA_TEMPLATES)]} />
                {form.dna_type && DNA_TEMPLATES[form.dna_type] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
                    {DNA_TEMPLATES[form.dna_type].map(field => field.type === 'select' ? ( <Select key={field.name} label={field.label} value={form.dna_payload[field.name] || ''} onChange={(e) => handleDnaChange(field.name, e.target.value)} options={['', ...(field.options||[])]} /> ) : ( <Input key={field.name} label={field.label} type={field.type || 'text'} placeholder={field.placeholder} value={form.dna_payload[field.name] || ''} onChange={(e) => handleDnaChange(field.name, e.target.value)} /> ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div><label className="block text-xs font-medium text-gray-400 mb-1">Observações Adicionais</label><textarea value={form.descricao} onChange={(e) => handleChange('descricao', e.target.value)} rows={2} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 focus:border-yellow-500 outline-none" placeholder="Informações extra..." /></div>

          <div className="flex gap-3 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={handleSaveClick} className="flex-1 !bg-green-600 !text-white"><Save className="w-4 h-4 mr-2"/> Guardar Insumo no Estoque</Button></div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// 10. VIEW: MOVIMENTAÇÕES DE ESTOQUE
// ============================================================================

const MovimentacoesView = ({ movimentacoes, produtos, onSave, onPrint, showMsg }) => {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('ALL');
  const [filterEmpreiteira, setFilterEmpreiteira] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredItems = useMemo(() => {
    let result = (movimentacoes || []).sort((a, b) => new Date(b.data) - new Date(a.data));
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m => String(m.sku).toLowerCase().includes(s) || String(m.obs).toLowerCase().includes(s) || String(m.destino).toLowerCase().includes(s) || String(m.responsavel).toLowerCase().includes(s));
    }
    if (filterTipo !== 'ALL') result = result.filter(m => m.tipo === filterTipo);
    if (filterEmpreiteira !== 'ALL') result = result.filter(m => { const p = produtos.find(x => x.id === m.sku || x.sku === m.sku); return (p?.empreiteira || 'Sem Empreiteira') === filterEmpreiteira; });
    if (startDate) result = result.filter(m => new Date(m.data) >= new Date(startDate));
    if (endDate) result = result.filter(m => new Date(m.data) <= new Date(endDate + 'T23:59:59'));
    return result;
  }, [movimentacoes, search, filterTipo, filterEmpreiteira, startDate, endDate, produtos]);

  const empreiteirasUnicas = useMemo(() => [...new Set((produtos || []).map(p => p.empreiteira).filter(Boolean))].sort(), [produtos]);

  const handleSaveMov = async (formData) => {
    await onSave(formData);
    setShowForm(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800 print:hidden">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" /><input type="text" placeholder="Buscar por código, obs ou resp..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" /></div>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todos Tipos</option><option value="ENTRADA">Entradas</option><option value="SAIDA">Saídas</option><option value="DEVOLUCAO">Devoluções</option><option value="AJUSTE">Ajustes</option></select>
          <select value={filterEmpreiteira} onChange={(e) => setFilterEmpreiteira(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todas Empreiteiras</option>{empreiteirasUnicas.map(e => <option key={e} value={e}>{e}</option>)}</select>
          <DateRangeFilter startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} onClear={() => { setStartDate(''); setEndDate(''); }} />
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => onPrint(filteredItems)} className="mr-2" title="Imprimir Filtro Atual"><Printer className="w-4 h-4 mr-2"/> Imprimir Relatório</Button>
            <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1"/> Lançar</Button>
        </div>
      </div>

      {showForm && <MovimentacaoFormModal onClose={() => setShowForm(false)} onSave={handleSaveMov} produtos={produtos} showMsg={showMsg} />}

      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <Card className="text-center py-12"><ArrowRightLeft className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-500">Nenhum registo de auditoria encontrado.</p></Card>
        ) : (
          filteredItems.slice(0, 100).map(mov => {
            const produto = produtos.find(p => p.id === mov.sku || p.sku === mov.sku);
            const isEntrada = mov.tipo === 'ENTRADA' || mov.tipo === 'DEVOLUCAO';
            return (
              <Card key={mov.id} className="hover:border-yellow-600 transition-colors p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isEntrada ? 'bg-green-900/30 text-green-400' : mov.tipo==='AJUSTE'?'bg-blue-900/30 text-blue-400':'bg-red-900/30 text-red-400'}`}>
                      {isEntrada ? <ArrowDownCircle className="w-5 h-5"/> : <ArrowRightLeft className="w-5 h-5"/>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base truncate">{produto?.nome || mov.sku}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-0.5">
                        <span className={`font-black ${isEntrada?'text-green-500':mov.tipo==='AJUSTE'?'text-blue-500':'text-red-500'}`}>{mov.tipo}</span>
                        <span className="font-mono">{formatBRDate(mov.data)}</span>
                        <span><span className="text-gray-500 font-bold">Local:</span> {isEntrada ? mov.origem : mov.destino}</span>
                        {mov.responsavel && <span><span className="text-gray-500 font-bold">Resp:</span> {mov.responsavel}</span>}
                        {produto?.empreiteira && <span className="bg-gray-800 border border-gray-700 px-1.5 rounded text-gray-300">{produto.empreiteira}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={`text-2xl font-black ${isEntrada ? 'text-green-400' : mov.tipo==='AJUSTE'?'text-blue-400':'text-red-400'}`}>{isEntrada ? '+' : (mov.tipo==='AJUSTE'?'':'')}{mov.qtd}</p>
                    <p className="text-[10px] text-gray-500 max-w-[150px] truncate" title={mov.obs}>{mov.obs || '-'}</p>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const MovimentacaoFormModal = ({ onClose, onSave, produtos, showMsg }) => {
  useSuspendRealtime();
  const [form, setForm] = useState({ id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'SAIDA', sku: '', qtd: '', responsavel: '', origem: AREAS_ESTOCAGEM[0], destino: '', obs: '' });
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);

  const filteredProd = useMemo(() => {
      const s = busca.toLowerCase();
      return produtos.filter(p => String(p.ativo)!=='false' && (p.nome.toLowerCase().includes(s) || String(p.sku).toLowerCase().includes(s))).slice(0,50);
  }, [produtos, busca]);

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }));
  
  useEffect(() => {
      if(form.sku) { const p = produtos.find(x => x.id === form.sku || x.sku === form.sku); setProdutoSelecionado(p||null); }
  }, [form.sku, produtos]);

  // Adjust default Origem/Destino logic based on Type
  useEffect(() => {
      if (form.tipo === 'SAIDA') {
          setForm(p => ({ ...p, origem: AREAS_ESTOCAGEM[0], destino: '' }));
      } else if (form.tipo === 'DEVOLUCAO') {
          setForm(p => ({ ...p, origem: '', destino: AREAS_ESTOCAGEM[0] }));
      } else if (form.tipo === 'ENTRADA') {
          setForm(p => ({ ...p, origem: 'Fornecedor', destino: AREAS_ESTOCAGEM[0] }));
      }
  }, [form.tipo]);

  const handleSaveClick = async () => {
    if (!form.sku || !form.qtd || Number(form.qtd) <= 0) { showMsg("Aviso", "Selecione um produto e informe uma quantidade válida."); return; }
    if (!produtoSelecionado) return;
    
    const saldoAtual = Number(produtoSelecionado.saldo_atual) || 0;
    const q = Number(form.qtd);
    let novoSaldo = saldoAtual;

    if (form.tipo === 'ENTRADA' || form.tipo === 'DEVOLUCAO') {
        novoSaldo += q;
    }
    else if (form.tipo === 'SAIDA') {
        if(q > saldoAtual) {
            const conf = await new Promise(r => showMsg("Alerta de Estoque Negativo", `A quantidade a sair (${q}) é maior que o saldo atual (${saldoAtual}). Deseja prosseguir e deixar o saldo negativo?`, true).then(res => r(res)));
            if(!conf) return;
        }
        novoSaldo -= q;
    } else if (form.tipo === 'AJUSTE') {
        novoSaldo = q;
    }

    const produtoAtualizado = { ...produtoSelecionado, saldo_atual: novoSaldo };
    await AppDB.put('produtos', produtoAtualizado);
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card title="Lançar Movimentação" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
        <div className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg"><Input label="Pesquisar Produto (Nome/SKU)" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite para filtrar a lista..." autoFocus className="mb-2"/><Select label="Selecione o Insumo" value={form.sku} onChange={(e) => handleChange('sku', e.target.value)} options={[{value:'', label:'Selecione um produto da lista...'}, ...filteredProd.map(p => ({ value: p.id, label: `[${p.sku}] ${p.nome}` }))]} /></div>

          {produtoSelecionado && (
            <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-3 text-sm flex justify-between items-center">
              <div><p className="text-gray-400">Saldo Atual</p><p className="text-xl font-bold text-white">{produtoSelecionado.saldo_atual} <span className="text-sm font-normal text-gray-400">{produtoSelecionado.unidade}</span></p></div>
              <div className="text-right">{produtoSelecionado.empreiteira && <p className="text-blue-400 font-bold">{produtoSelecionado.empreiteira}</p>}{produtoSelecionado.rua && <p className="text-yellow-400 font-mono text-xs">R{produtoSelecionado.rua}-P{produtoSelecionado.prateleira}</p>}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4"><Select label="Tipo de Operação" value={form.tipo} onChange={(e) => handleChange('tipo', e.target.value)} options={['SAIDA', 'ENTRADA', 'DEVOLUCAO', 'AJUSTE']} /><Input label="Quantidade" type="number" value={form.qtd} onChange={(e) => handleChange('qtd', e.target.value)} /></div>
          
          <Input label="Nome de quem está retirando/devolvendo (Responsável)" value={form.responsavel} onChange={(e) => handleChange('responsavel', e.target.value)} placeholder="Ex: João Silva" />

          <div className="grid grid-cols-2 gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
             {form.tipo === 'SAIDA' ? (
                 <>
                 <Select label="De Qual Estoque (Origem)" value={form.origem} onChange={e=>handleChange('origem', e.target.value)} options={AREAS_ESTOCAGEM} />
                 <Input label="Para Qual Obra/Setor (Destino)" value={form.destino} onChange={e=>handleChange('destino', e.target.value)} placeholder="Ex: Obra Alpha" />
                 </>
             ) : form.tipo === 'DEVOLUCAO' ? (
                 <>
                 <Input label="De Qual Obra Voltou (Origem)" value={form.origem} onChange={e=>handleChange('origem', e.target.value)} placeholder="Ex: Obra Alpha" />
                 <Select label="Para Qual Estoque (Destino)" value={form.destino} onChange={e=>handleChange('destino', e.target.value)} options={AREAS_ESTOCAGEM} />
                 </>
             ) : form.tipo === 'ENTRADA' ? (
                 <>
                 <Input label="Fornecedor (Origem)" value={form.origem} onChange={e=>handleChange('origem', e.target.value)} placeholder="Ex: Fornecedor X" />
                 <Select label="Para Qual Estoque (Destino)" value={form.destino} onChange={e=>handleChange('destino', e.target.value)} options={AREAS_ESTOCAGEM} />
                 </>
             ) : (
                 <>
                 <Input label="Local de Origem" value={form.origem} onChange={(e) => handleChange('origem', e.target.value)} />
                 <Input label="Local de Destino" value={form.destino} onChange={(e) => handleChange('destino', e.target.value)} />
                 </>
             )}
          </div>

          <div><label className="block text-xs font-medium text-gray-400 mb-1">Motivo / Observação</label><textarea value={form.obs} onChange={(e) => handleChange('obs', e.target.value)} rows={2} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" /></div>

          <div className="flex gap-3 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={handleSaveClick} className="flex-1 !bg-blue-600 !text-white"><Save className="w-4 h-4 mr-2"/> Efetivar Registo</Button></div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// NOVO MODULO: DESPERDÍCIOS E PERDAS
// ============================================================================

const DesperdiciosView = ({ desperdicios, produtos, onSave, showMsg }) => {
  const [showForm, setShowForm] = useState(false);
  const [filterEmpreiteira, setFilterEmpreiteira] = useState('ALL');

  const filteredItems = useMemo(() => {
    let result = (desperdicios || []).sort((a,b) => new Date(b.data) - new Date(a.data));
    if (filterEmpreiteira !== 'ALL') result = result.filter(d => d.empreiteira === filterEmpreiteira);
    return result;
  }, [desperdicios, filterEmpreiteira]);

  const empreiteirasUnicas = useMemo(() => [...new Set((produtos || []).map(p => p.empreiteira).filter(Boolean))].sort(), [produtos]);

  const handleSaveDesperdicio = async (formData) => {
    await onSave(formData);
    setShowForm(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="flex gap-2 flex-1">
          <select value={filterEmpreiteira} onChange={(e) => setFilterEmpreiteira(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none w-full sm:max-w-xs"><option value="ALL">Todas Empreiteiras</option>{empreiteirasUnicas.map(e => <option key={e} value={e}>{e}</option>)}</select>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => printDesperdiciosReport(desperdicios, produtos, filterEmpreiteira, showMsg)} className="mr-2 !text-red-400 !border-red-900 hover:!bg-red-900/30" title="Imprimir Relatório de Perdas"><Printer className="w-4 h-4 mr-2"/> Relatório Empreiteira</Button>
            <Button onClick={() => setShowForm(true)} className="!bg-red-600 !text-white hover:!bg-red-500"><AlertOctagon className="w-4 h-4 mr-1"/> Registar Desperdício</Button>
        </div>
      </div>

      {showForm && <DesperdicioFormModal onClose={() => setShowForm(false)} onSave={handleSaveDesperdicio} produtos={produtos} empreiteiras={empreiteirasUnicas} showMsg={showMsg} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800"><AlertOctagon className="w-12 h-12 text-gray-600 mx-auto mb-3"/><p className="text-gray-500">Nenhum registo de perda ou desperdício encontrado.</p></div>
        ) : (
          filteredItems.map(d => {
            const p = produtos.find(x => x.id === d.produto_id);
            return (
              <Card key={d.id} className="border-red-900/30 bg-gray-900 p-0 overflow-hidden flex flex-col h-full">
                {d.foto_url ? (
                    <div className="h-32 w-full bg-black relative"><img src={d.foto_url} className="w-full h-full object-cover opacity-80" alt="Evidência"/></div>
                ) : (
                    <div className="h-10 w-full bg-red-900/20 border-b border-red-900/50 flex items-center justify-center text-xs text-red-500 font-bold uppercase tracking-widest">Sem Evidência Fotográfica</div>
                )}
                <div className="p-4 flex-1">
                  <div className="flex justify-between items-start mb-2"><h3 className="text-white font-bold truncate pr-2">{p?.nome || 'Desconhecido'}</h3><span className="text-red-400 font-black text-lg">-{d.qtd}</span></div>
                  <p className="text-xs text-blue-400 font-bold mb-3">{d.empreiteira}</p>
                  <div className="space-y-1 text-xs text-gray-400">
                    <p><strong className="text-gray-300">Local:</strong> {d.local_encontrado}</p>
                    <p><strong className="text-gray-300">Motivo:</strong> {d.estado}</p>
                    <p><strong className="text-gray-300">Custo Perda:</strong> <span className="text-red-400 font-bold">R$ {Number(d.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const DesperdicioFormModal = ({ onClose, onSave, produtos, empreiteiras, showMsg }) => {
  useSuspendRealtime();
  const [form, setForm] = useState({ id: `DESP-${generateId()}`, data: getLocalISOString(), empreiteira: '', produto_id: '', qtd: '', local_encontrado: '', estado: 'Quebrado', foto_url: '', obs: '' });
  
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);

  useEffect(() => {
      if (form.empreiteira) {
          setProdutosFiltrados(produtos.filter(p => p.empreiteira === form.empreiteira && String(p.ativo)!=='false').sort((a,b)=>a.nome.localeCompare(b.nome)));
      } else {
          setProdutosFiltrados([]);
      }
      setForm(p => ({...p, produto_id: ''})); // reset product when empreiteira changes
  }, [form.empreiteira, produtos]);

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleCapture = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const b64 = await resizeImage(file, 800);
              setForm(p => ({ ...p, foto_url: b64 }));
          } catch(err) {
              showMsg("Erro", "Falha ao processar a fotografia da câmera.");
          }
      }
  };

  const handleSaveClick = async () => {
    if (!form.empreiteira || !form.produto_id || !form.qtd || Number(form.qtd) <= 0) { showMsg("Aviso", "Preencha a Empreiteira, o Produto e a Quantidade."); return; }
    
    const prod = produtos.find(p => p.id === form.produto_id);
    if (!prod) return;

    const custo = Number(form.qtd) * Number(prod.preco_unitario || 0);

    const desperdicioData = { ...form, valor_total: custo };

    // Atualiza saldo do produto
    const novoSaldo = Math.max(0, (Number(prod.saldo_atual) || 0) - Number(form.qtd));
    await AppDB.put('produtos', { ...prod, saldo_atual: novoSaldo });

    // Cria movimentacao
    await AppDB.put('movimentacoes_estoque', {
        id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'SAIDA', sku: prod.id, qtd: Number(form.qtd),
        origem: prod.local_armazenamento || LOCACAO_ESTOQUE_LOCAL, destino: 'DESCARTE / PERDA', obs: `Desperdício: ${form.estado} - ${form.local_encontrado}`
    });

    onSave(desperdicioData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card title="Registar Desperdício / Perda" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
        <div className="space-y-4">
          
          <Select label="Selecione a Empreiteira / Centro de Custo" value={form.empreiteira} onChange={e=>handleChange('empreiteira', e.target.value)} options={[{value:'', label:'Selecione...'}, ...empreiteiras]} />

          {form.empreiteira && (
              <Select label="Selecione o Insumo Perdido (Para calcular o custo)" value={form.produto_id} onChange={e=>handleChange('produto_id', e.target.value)} options={[{value:'', label:'Selecione um produto da lista...'}, ...produtosFiltrados.map(p => ({ value: p.id, label: `[${p.sku}] ${p.nome} - R$ ${p.preco_unitario||0}` }))]} />
          )}

          <div className="grid grid-cols-2 gap-4"><Input label="Quantidade Perdida" type="number" value={form.qtd} onChange={e=>handleChange('qtd', e.target.value)} /><Select label="Estado / Motivo" value={form.estado} onChange={e=>handleChange('estado', e.target.value)} options={['Quebrado', 'Vencido', 'Extraviado', 'Mau Uso', 'Danificado por Chuva', 'Outros']} /></div>
          
          <Input label="Onde foi encontrado? (Local na Obra)" value={form.local_encontrado} onChange={e=>handleChange('local_encontrado', e.target.value)} placeholder="Ex: Torre B, Andar 5" />

          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
              <label className="block text-xs font-medium text-gray-400 mb-2">Evidência Fotográfica (Câmera)</label>
              <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-blue-900/30 text-blue-400 border border-blue-800/50 px-4 py-3 rounded-lg hover:bg-blue-900/50 transition-colors flex items-center justify-center flex-1">
                      <Camera size={24} className="mr-2"/> Tirar Foto
                      <input type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
                  </label>
                  {form.foto_url && <img src={form.foto_url} alt="Evidência" className="h-16 w-16 object-cover rounded border border-gray-600" />}
              </div>
          </div>

          <div><label className="block text-xs font-medium text-gray-400 mb-1">Observações Adicionais</label><textarea value={form.obs} onChange={(e) => handleChange('obs', e.target.value)} rows={2} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" /></div>

          <div className="flex gap-3 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={handleSaveClick} className="flex-1 !bg-red-600 !text-white hover:!bg-red-500"><AlertOctagon className="w-4 h-4 mr-2"/> Efetivar Registo de Perda</Button></div>
        </div>
      </Card>
    </div>
  );
};


// ============================================================================
// 12. VIEW: REQUISIÇÕES (MODELO ANTIGO - 15 LINHAS FIXAS E AUTOFILL)
// ============================================================================

const RequisicoesView = ({ requisicoes, produtos, onSave, onUpdate, onDelete, showMsg }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredItems = useMemo(() => {
    let result = (requisicoes || []).sort((a, b) => new Date(b.created_at || b.data) - new Date(a.created_at || a.data));
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => String(r.numero).toLowerCase().includes(s) || String(r.requisitante).toLowerCase().includes(s) || String(r.obra_destino).toLowerCase().includes(s) || String(r.rc_scm || '').toLowerCase().includes(s));
    }
    if (filterStatus !== 'ALL') result = result.filter(r => (r.status || 'Rascunho') === filterStatus);
    return result;
  }, [requisicoes, search, filterStatus]);

  const reqStats = useMemo(() => {
    const s = { 'Rascunho': 0, 'Aprovado': 0, 'Em Curso': 0, 'Concluída': 0, 'Reprovado': 0 };
    (requisicoes || []).forEach(r => { const k = r.status || 'Rascunho'; s[k] = (s[k]||0) + 1; });
    return s;
  }, [requisicoes]);

  const statCfg = [
    { k: 'Rascunho', label: 'Rascunho', dot: 'bg-yellow-500' },
    { k: 'Aprovado', label: 'Aprovadas', dot: 'bg-emerald-500' },
    { k: 'Em Curso', label: 'Em Curso', dot: 'bg-blue-500' },
    { k: 'Concluída', label: 'Concluídas', dot: 'bg-teal-500' },
    { k: 'Reprovado', label: 'Reprovadas', dot: 'bg-red-500' },
  ];

  const printRequisicao = (req) => {
    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) { showMsg('Atenção', 'Permita popups para imprimir.'); return; }
    
    let html = `<html><head><title>Solicitação de Compra ${req.numero}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: Arial, sans-serif; padding: 0; margin: 0; font-size: 11px; color: black; background: white; }
      .container { width: 100%; max-width: 190mm; margin: auto; }
      table { width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: 6px; }
      th, td { border: 1px solid black; padding: 4px; text-align: left; }
      .center { text-align: center; }
      .bg-dark { background-color: #000; color: white; font-weight: bold; text-align: center; padding: 4px; font-size: 11px; }
      .bg-light { background-color: #f0f0f0; font-weight: bold; }
      .header-table td { padding: 8px; vertical-align: middle; border: 2px solid black; }
      .header-logo { max-height: 40px; filter: grayscale(100%) contrast(200%); }
      .signatures { display: flex; justify-content: center; margin-top: 60px; padding: 0 10px; }
      .sig-line { width: 50%; text-align: center; border-top: 1px solid black; padding-top: 5px; font-weight: bold; font-size: 12px;}
    </style></head><body><div class="container">
    <table class="header-table"><tr><td style="width: 25%; text-align: center;"><img src="${REALMARKA_LOGO}" class="header-logo" alt="${SYSTEM_NAME}"></td><td style="width: 50%;"><div style="font-size: 18px; font-weight: bold; text-transform: uppercase; text-align: center;">SOLICITAÇÃO DE COMPRA</div></td><td style="width: 25%; text-align: center; font-size: 14px; font-weight: bold; color: red;">Nº <u>${req.numero}</u></td></tr></table>
    <table><tr><td class="bg-light" style="width: 10%;">DATA:</td><td style="width: 23%;">${req.data ? new Date(req.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}</td><td class="bg-light" style="width: 15%;">Requisitante:</td><td style="width: 30%;">${req.requisitante || ''}</td><td class="bg-light" style="width: 10%;">Entrega:</td><td style="width: 12%;">${req.prazo_entrega || ''}</td></tr></table>
    <table><tr><td colspan="2" class="bg-dark">OBRA DESTINO</td></tr><tr><td class="bg-light" style="width: 20%;">Obra Destino:</td><td>${req.obra_destino || ''}</td></tr><tr><td class="bg-light">Observações gerais:</td><td>${req.obs_gerais || '&nbsp;'}</td></tr></table>
    <table><tr><td colspan="4" class="bg-dark">DADOS PARA ENTREGA</td></tr><tr><td class="bg-light" style="width: 10%;">OBRA:</td><td colspan="3">${req.obra_destino || ''}</td></tr><tr><td class="bg-light">RUA:</td><td style="width: 50%;">${req.entrega_rua || ''}</td><td class="bg-light" style="width: 5%;">Nº:</td><td>${req.entrega_numero || ''}</td></tr><tr><td class="bg-light">BAIRRO:</td><td>${req.entrega_bairro || ''}</td><td class="bg-light">CIDADE:</td><td>${req.entrega_cidade || ''}</td></tr><tr><td class="bg-light">Obs:</td><td colspan="3">${req.entrega_obs || '&nbsp;'}</td></tr></table>
    <table><tr><td colspan="3" class="bg-dark">SUGESTÕES DE FORNECEDORES</td></tr><tr class="center bg-light"><td style="width: 33%;">FORNECEDOR 1</td><td style="width: 33%;">FORNECEDOR 2</td><td style="width: 33%;">FORNECEDOR 3</td></tr><tr class="center"><td>${req.fornecedor_1 || '&nbsp;'}</td><td>${req.fornecedor_2 || '&nbsp;'}</td><td>${req.fornecedor_3 || '&nbsp;'}</td></tr><tr><td class="bg-light" style="width: 15%; border-right: none;">Observações:</td><td colspan="2" style="border-left: none;">${req.obs_fornecedores || '&nbsp;'}</td></tr></table>
    <table><thead class="bg-light center"><tr><th style="width: 40%">Descrição do item</th><th style="width: 15%">Cód. Insumo</th><th style="width: 10%">Un.</th><th style="width: 10%">Qtde</th><th style="width: 25%">Observações sobre itens</th></tr></thead><tbody>`;
    
    const filledItens = (req.itens || []).filter(i => i.descricao);
    for (let i = 0; i < 15; i++) {
        const item = filledItens[i] || { qtde: '', un: '', descricao: '', cod_insumo: '', obs: '' };
        html += `<tr><td>${item.descricao || '&nbsp;'}</td><td class="center">${item.cod_insumo || '&nbsp;'}</td><td class="center">${item.un || '&nbsp;'}</td><td class="center">${item.qtde || '&nbsp;'}</td><td>${item.obs || '&nbsp;'}</td></tr>`;
    }
    
    html += `</tbody></table><div class="signatures"><div class="sig-line">Assinatura</div></div></div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };






  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {statCfg.map(s => (
          <button key={s.k} onClick={()=>setFilterStatus(filterStatus===s.k?'ALL':s.k)} className={`p-3 rounded-xl border text-left transition ${filterStatus===s.k?'border-yellow-500 bg-yellow-500/5':'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-1"><span className={`w-2 h-2 rounded-full ${s.dot}`}></span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span></div>
            <p className="text-2xl font-black text-white">{reqStats[s.k]||0}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" /><input type="text" placeholder="Buscar por número, solicitante ou obra..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" /></div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none"><option value="ALL">Todos Status</option><option value="Rascunho">Rascunho</option><option value="Aprovado">Aprovado</option><option value="Em Curso">Em Curso</option><option value="Concluída">Concluída</option><option value="Reprovado">Reprovado</option></select>
        </div>
        <Button onClick={() => { setEditingReq(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1"/> Montar Requisição</Button>
      </div>

      {showForm && <RequisicaoFormModal edit={editingReq} onClose={() => { setShowForm(false); setEditingReq(null); }} onSave={(data) => { (editingReq ? onUpdate : onSave)(data); setShowForm(false); setEditingReq(null); }} produtos={produtos} requisicoes={requisicoes} showMsg={showMsg} />}

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <Card className="text-center py-12"><FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-500">Nenhuma requisição/pedido encontrado.</p></Card>
        ) : (
          filteredItems.map(req => {
            const filledItens = (req.itens || []).filter(i => i.descricao);
            return (
            <Card key={req.id} className="hover:border-yellow-600 transition-colors p-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2"><h3 className="text-white font-black text-lg">REQ-{req.numero}</h3><StatusBadge status={req.status || 'Rascunho'} /></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-400 mb-4">
                      <div><span className="block text-[10px] uppercase font-bold text-gray-600">Emissão</span><span className="font-mono text-gray-300">{formatBRDate(req.data)}</span></div>
                      <div><span className="block text-[10px] uppercase font-bold text-gray-600">Requisitante</span><span className="text-gray-300 truncate">{req.requisitante}</span></div>
                      <div className="md:col-span-2"><span className="block text-[10px] uppercase font-bold text-gray-600">Obra / Destino</span><span className="text-yellow-500 font-bold truncate">{req.obra_destino}</span></div>
                  </div>
                  {(req.status === 'Aprovado' || req.status === 'Em Curso' || req.status === 'Concluída') && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-gray-600">RC SCM</span>
                      {req.rc_scm ? (
                        <span className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-700 text-yellow-300 font-mono text-xs font-bold">{req.rc_scm}</span>
                      ) : (
                        <span className="text-xs text-gray-500 italic">não informado</span>
                      )}
                      <button
                        onClick={() => {
                          const v = window.prompt('Informe o número da RC SCM (sistema externo):', req.rc_scm || '');
                          if (v !== null) onUpdate({ ...req, rc_scm: v.trim() });
                        }}
                        className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 underline"
                      >{req.rc_scm ? 'Editar' : 'Adicionar'}</button>
                    </div>
                  )}
                  {filledItens.length > 0 && (
                    <div className="bg-gray-950 rounded border border-gray-800 p-3 max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-[10px] uppercase font-bold text-gray-600 mb-1">Itens Solicitados ({filledItens.length})</p>
                      {filledItens.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs py-1 border-b border-gray-800/50 last:border-0"><span className="text-gray-300">{item.descricao}</span><span className="font-bold text-white">{item.qtde} <span className="text-gray-500">{item.un}</span></span></div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0 border-t md:border-t-0 border-gray-800 pt-4 md:pt-0">
                  {(req.status || 'Rascunho') === 'Rascunho' && (
                    <React.Fragment>
                      <Button variant="outline" onClick={() => onUpdate({ ...req, status: 'Aprovado', aprovado_at: new Date().toISOString() })} className="!p-2 !bg-green-900/20 !border-green-800 hover:!bg-green-800 !text-green-400" title="Aprovar"><Check size={18}/></Button>
                      <Button variant="outline" onClick={() => onUpdate({ ...req, status: 'Reprovado' })} className="!p-2 !bg-red-900/20 !border-red-800 hover:!bg-red-800 !text-red-400" title="Reprovar"><X size={18}/></Button>
                    </React.Fragment>
                  )}
                  {req.status === 'Aprovado' && (
                    <Button variant="outline" onClick={() => onUpdate({ ...req, status: 'Em Curso', em_curso_at: new Date().toISOString() })} className="!p-2 !bg-blue-900/20 !border-blue-800 hover:!bg-blue-800 !text-blue-300" title="Iniciar (Em Curso)"><RefreshCw size={18}/></Button>
                  )}
                  {req.status === 'Em Curso' && (
                    <Button variant="outline" onClick={() => onUpdate({ ...req, status: 'Concluída', concluida_at: new Date().toISOString() })} className="!p-2 !bg-teal-900/20 !border-teal-800 hover:!bg-teal-800 !text-teal-300" title="Concluir"><CheckSquare size={18}/></Button>
                  )}
                  {(req.status || 'Rascunho') === 'Rascunho' && (
                    <Button variant="outline" onClick={() => { setEditingReq(req); setShowForm(true); }} className="!p-2 !bg-blue-900/20 !border-blue-800 hover:!bg-blue-800 !text-blue-400" title="Editar"><Edit size={18}/></Button>
                  )}
                  <Button variant="secondary" onClick={() => printRequisicao(req)} className="!p-2 w-full md:w-auto" title="Imprimir PDF Clássico"><Printer size={18}/></Button>
                  <Button variant="danger" onClick={async () => { if(await showMsg("Excluir", `Apagar requisição REQ-${req.numero}?`, true)) await onDelete(req.id); }} className="!p-2 w-full md:w-auto"><Trash2 size={18}/></Button>
                </div>

              </div>
            </Card>
          )})
        )}
      </div>
    </div>
  );
};

const RequisicaoFormModal = ({ onClose, onSave, produtos, requisicoes, showMsg, edit }) => {
  useSuspendRealtime();
  const getNextReqNumber = useCallback(() => {
      if (!requisicoes || requisicoes.length === 0) return '01';
      const numeros = requisicoes.map(r => {
          const parsed = parseInt(r.numero, 10);
          return isNaN(parsed) ? 0 : parsed;
      });
      const maxNumber = Math.max(...numeros);
      const nextNumber = maxNumber + 1;
      return nextNumber < 10 ? `0${nextNumber}` : String(nextNumber);
  }, [requisicoes]);

  const getEmptyRows = () => Array(15).fill().map(() => ({ descricao: '', cod_insumo: '', un: '', qtde: '', obs: '' }));

  const [form, setForm] = useState(() => {
    if (edit) {
      const baseItens = Array.isArray(edit.itens) ? edit.itens.slice(0, 15) : [];
      const padded = [...baseItens, ...getEmptyRows()].slice(0, 15);
      return { ...edit, itens: padded };
    }
    return {
      id: `REQ-${generateId()}`, numero: getNextReqNumber(), data: getLocalISOString().slice(0, 10), requisitante: '', prazo_entrega: '', obra_destino: 'Le Monde',
      obs_gerais: '',
      entrega_rua: 'Rua Desembargador Lauro Sodré Lopes',
      entrega_numero: '457',
      entrega_bairro: 'Portão',
      entrega_cidade: 'Curitiba',
      entrega_obs: '',
      fornecedor_1: '', fornecedor_2: '', fornecedor_3: '', obs_fornecedores: '', itens: getEmptyRows(), status: 'Rascunho'
    };
  });

  const handleChange = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleItemChange = (index, field, value) => {
      const newItens = [...form.itens];
      newItens[index][field] = value;
      // Auto-fill logic when description changes
      if (field === 'descricao') {
          const matchedProd = produtos.find(p => String(p.nome).toLowerCase() === String(value).toLowerCase());
          if (matchedProd) {
              if (!newItens[index].un) newItens[index].un = matchedProd.unidade || 'UN';
              if (!newItens[index].cod_insumo) newItens[index].cod_insumo = matchedProd.sku || '';
          }
      }
      setForm({...form, itens: newItens});
  };

  const handleSaveClick = () => {
    if (!form.requisitante || !form.obra_destino) { showMsg("Aviso", "Preencha o requisitante e a obra de destino."); return; }
    const filledItens = form.itens.filter(i => i.descricao.trim() !== '');
    if (filledItens.length === 0) { showMsg("Aviso", "Adicione pelo menos um item à lista da requisição."); return; }
    
    // Save exactly the 15 array structure to keep parity with the print layout if needed
    onSave({ ...form, created_at: getLocalISOString() });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card title="Emitir Solicitação de Compra" className="max-w-5xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button>
        <div className="space-y-6">
          <datalist id="produtos-list">
              {(produtos || []).filter(p => String(p.ativo) !== 'false').map(p => <option key={p.id} value={p.nome} />)}
          </datalist>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
            <Input label="Nº Doc (Sequencial)" value={form.numero} onChange={e=>handleChange('numero', e.target.value)} className="font-mono text-yellow-500" />
            <Input type="date" label="Data do Pedido" value={form.data} onChange={e=>handleChange('data', e.target.value)} />
            <Input label="Requisitante (Solicitante)" value={form.requisitante} onChange={e=>handleChange('requisitante', e.target.value)} required className="md:col-span-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Obra Destino / Aplicação" value={form.obra_destino} onChange={e=>handleChange('obra_destino', e.target.value)} required />
            <Input label="Prazo Entrega Solicitado" value={form.prazo_entrega} onChange={e=>handleChange('prazo_entrega', e.target.value)} placeholder="Ex: Imediato, 15 dias" />
            <div className="md:col-span-2"><Input label="Observações Gerais da Obra" value={form.obs_gerais} onChange={e=>handleChange('obs_gerais', e.target.value)} /></div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-white font-bold mb-3">Dados para Entrega</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <Input label="Rua" value={form.entrega_rua} onChange={e=>handleChange('entrega_rua', e.target.value)} className="md:col-span-2" />
              <Input label="Nº" value={form.entrega_numero} onChange={e=>handleChange('entrega_numero', e.target.value)} />
              <Input label="Bairro" value={form.entrega_bairro} onChange={e=>handleChange('entrega_bairro', e.target.value)} />
              <Input label="Cidade" value={form.entrega_cidade} onChange={e=>handleChange('entrega_cidade', e.target.value)} className="md:col-span-2" />
              <Input label="Obs Local Entrega" value={form.entrega_obs} onChange={e=>handleChange('entrega_obs', e.target.value)} className="md:col-span-2" />
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-4 overflow-x-auto">
            <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2"><ListTodo size={18}/> Lista de Itens (15 Linhas)</h3>
            <p className="text-xs text-gray-500 mb-2">Digite a descrição. Se o item existir no estoque, o Código e Unidade serão preenchidos automaticamente.</p>
            <div className="min-w-[700px]">
                <table className="w-full text-xs text-left border border-gray-700 rounded overflow-hidden">
                  <thead className="bg-gray-800 text-gray-400 uppercase">
                    <tr><th className="p-2 w-2/5">Descrição do item</th><th className="p-2 w-24 text-center">Cód. Insumo</th><th className="p-2 w-16 text-center">Un.</th><th className="p-2 w-20 text-center">Qtde</th><th className="p-2 w-1/4">Observações sobre itens</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {form.itens.map((item, idx) => (
                      <tr key={idx} className="bg-gray-900 hover:bg-gray-800/50 transition-colors">
                        <td className="p-1"><input list="produtos-list" value={item.descricao} onChange={e => handleItemChange(idx, 'descricao', e.target.value)} className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-yellow-500" placeholder={`Item ${idx+1}`} /></td>
                        <td className="p-1"><input value={item.cod_insumo} onChange={e => handleItemChange(idx, 'cod_insumo', e.target.value)} className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-center text-gray-400 outline-none" /></td>
                        <td className="p-1"><input value={item.un} onChange={e => handleItemChange(idx, 'un', e.target.value.toUpperCase())} className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-center text-gray-400 outline-none" /></td>
                        <td className="p-1"><input type="number" value={item.qtde} onChange={e => handleItemChange(idx, 'qtde', e.target.value)} className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-center text-yellow-500 font-bold outline-none focus:border-yellow-500" /></td>
                        <td className="p-1"><input value={item.obs} onChange={e => handleItemChange(idx, 'obs', e.target.value)} className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-gray-400 outline-none" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={handleSaveClick} className="flex-1 !bg-green-600 !text-white"><CheckSquare className="w-4 h-4 mr-2"/> Fechar e Salvar Requisição</Button></div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// 13. VIEW: MAQUINÁRIO EXTERNO (LOCAÇÕES)
// ============================================================================

const LocacoesView = ({ locacoes, onSave, onDelete, showMsg }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filtroLocadora, setFiltroLocadora] = useState('TODAS');

  const fornecedoresCadastrados = useMemo(() => {
    const set = new Set();
    (locacoes || []).forEach(l => { if (l.lending_company) set.add(String(l.lending_company).trim()); });
    return Array.from(set).filter(Boolean).sort();
  }, [locacoes]);

  // Considera "ativa" tudo que NÃO foi devolvido nem substituído por troca
  const locacoesAtivas = (locacoes || [])
    .filter(l => String(l.ativo) !== 'false' && l.status !== 'DEVOLUCAO' && l.status !== 'SUBSTITUIDO')
    .filter(l => filtroLocadora === 'TODAS' || l.lending_company === filtroLocadora)
    .sort((a,b) => new Date(b.entry_date || 0) - new Date(a.entry_date || 0));

  const [mesRel, setMesRel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const handleSaveLoc = async (data) => { await onSave(data); setShowForm(false); setEditingItem(null); };

  // TROCA: dá baixa no equipamento atual (status SUBSTITUIDO) e cria um novo card
  // com o equipamento que entrou no lugar. DEVOLUCAO: apenas finaliza o card.
  const registrarEvento = async (loc, tipo) => {
    if (tipo === 'TROCA') {
      const novoNome = window.prompt(`TROCA — Qual o nome do NOVO equipamento que ficou no lugar de "${loc.tool_name}"?`, loc.tool_name);
      if (!novoNome || !novoNome.trim()) return;
      const novoPatrimonio = window.prompt('Nº de patrimônio do novo equipamento (deixe em branco se não houver):', '') || '';
      const obs = window.prompt('Motivo da troca / observação (opcional):', '') || '';
      const dataEvento = getLocalISOString();

      // 1) baixa o equipamento antigo
      const eventoSaida = { tipo: 'TROCA', data: dataEvento, obs, substituido_por: `${novoNome}${novoPatrimonio ? ' (PAT '+novoPatrimonio+')' : ''}` };
      const antigo = { ...loc, status: 'SUBSTITUIDO', ativo: false, historico: [...(loc.historico || []), eventoSaida] };
      await onSave(antigo);

      // 2) cria o novo equipamento no lugar (mesma locadora/responsável)
      const eventoEntrada = { tipo: 'ENTRADA_POR_TROCA', data: dataEvento, obs: `Substituiu ${loc.tool_name}${loc.patrimonio ? ' (PAT '+loc.patrimonio+')':''}`, substituido_por: '-' };
      const novo = {
        id: `LOC-${generateId()}`,
        tool_name: novoNome.trim(),
        lending_company: loc.lending_company,
        patrimonio: novoPatrimonio.trim(),
        responsavel: loc.responsavel,
        entry_date: dataEvento.slice(0,10),
        status: 'ENTRADA',
        observacoes: `Entrou por troca em ${formatBRDate(dataEvento)}. Substituiu: ${loc.tool_name}.`,
        historico: [eventoEntrada],
        substitui_id: loc.id,
        ativo: true,
      };
      await onSave(novo);
      showMsg('Troca registrada', `${loc.tool_name} foi substituído por ${novoNome}.`);
      return;
    }

    // DEVOLUCAO
    const obs = window.prompt('Observação da devolução (estado, avarias, etc):', '') || '';
    const evento = { tipo: 'DEVOLUCAO', data: getLocalISOString(), obs };
    const updated = { ...loc, status: 'DEVOLUCAO', ativo: false, historico: [...(loc.historico || []), evento] };
    await onSave(updated);
    showMsg('OK', `Devolução registrada para ${loc.tool_name}.`);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <div><h2 className="text-lg font-bold text-white flex items-center gap-2"><Building2 className="text-yellow-500"/> Controlo de Equipamentos Alugados</h2><p className="text-xs text-gray-400 mt-1">Trocas substituem o equipamento automaticamente. Histórico completo para relatório mensal.</p></div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="min-w-[180px]">
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filtrar por Locadora</label>
            <select value={filtroLocadora} onChange={e=>setFiltroLocadora(e.target.value)} className="w-full p-2 rounded-lg bg-gray-950 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500 text-sm">
              <option value="TODAS">Todas as locadoras</option>
              {fornecedoresCadastrados.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Mês de Referência</label>
            <input type="month" value={mesRel} onChange={e=>setMesRel(e.target.value)} className="p-2 rounded-lg bg-gray-950 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500 text-sm" />
          </div>
          <Button variant="outline" onClick={() => printTrocasReport(locacoes, mesRel, showMsg)} className="!text-orange-300 !border-orange-800 hover:!bg-orange-900/30"><Printer className="w-4 h-4 mr-1"/> Relatório Mensal</Button>
          <Button onClick={() => { setEditingItem(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1"/> Adicionar Máquina</Button>
        </div>
      </div>


      {showForm && <LocacaoFormModal onClose={() => {setShowForm(false); setEditingItem(null);}} onSave={handleSaveLoc} initialData={editingItem} showMsg={showMsg} fornecedoresCadastrados={fornecedoresCadastrados}/>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locacoesAtivas.length === 0 ? ( <div className="col-span-full text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800"><Truck className="w-12 h-12 text-gray-600 mx-auto mb-3"/><p className="text-gray-500">Nenhum equipamento externo registado{filtroLocadora!=='TODAS' ? ` para ${filtroLocadora}` : ''}.</p></div> ) : (
          locacoesAtivas.map(loc => {
            const statusColor = loc.status === 'ENTRADA' ? 'text-green-400 bg-green-900/20 border-green-800/50' : loc.status === 'DEVOLUCAO' ? 'text-blue-400 bg-blue-900/20 border-blue-800/50' : 'text-orange-400 bg-orange-900/20 border-orange-800/50';
            return (
              <Card key={loc.id} className="p-4 hover:border-yellow-600 transition flex flex-col h-full">
                <div className="flex justify-between items-start mb-3"><h3 className="text-white font-bold text-lg leading-tight line-clamp-2 pr-2">{loc.tool_name}</h3><span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${statusColor}`}>{loc.status || 'ENTRADA'}</span></div>
                <div className="space-y-1.5 flex-1 mt-2 text-sm">
                  <div className="flex justify-between border-b border-gray-800 pb-1.5"><span className="text-gray-500">Locadora</span><span className="text-white font-medium truncate ml-2">{loc.lending_company}</span></div>
                  <div className="flex justify-between border-b border-gray-800 pb-1.5"><span className="text-gray-500">Nº Patrimônio</span><span className="text-yellow-400 font-mono truncate ml-2">{loc.patrimonio || '-'}</span></div>
                  <div className="flex justify-between border-b border-gray-800 pb-1.5"><span className="text-gray-500">Responsável</span><span className="text-gray-300 truncate ml-2">{loc.responsavel || '-'}</span></div>
                  <div className="flex justify-between pb-1.5"><span className="text-gray-500">Data Entrada</span><span className="text-yellow-500 font-mono">{formatBRDate(loc.entry_date)}</span></div>
                </div>
                {loc.historico && loc.historico.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-800 max-h-24 overflow-y-auto">
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Histórico</p>
                    {loc.historico.slice(-3).reverse().map((h,i) => (
                      <div key={i} className="text-[11px] text-gray-400 flex justify-between"><span className={h.tipo==='DEVOLUCAO'?'text-blue-400':'text-orange-400'}>{h.tipo}</span><span className="font-mono">{formatBRDate(h.data)}</span></div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-800">
                  <Button variant="secondary" data-write="1" onClick={() => registrarEvento(loc, 'TROCA')} className="!py-1.5 !text-xs !bg-orange-900/30 !border-orange-800 !text-orange-300">Registrar Troca</Button>
                  <Button variant="secondary" data-write="1" onClick={() => registrarEvento(loc, 'DEVOLUCAO')} className="!py-1.5 !text-xs !bg-blue-900/30 !border-blue-800 !text-blue-300">Devolução</Button>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="secondary" onClick={() => { setEditingItem(loc); setShowForm(true); }} className="!p-2 flex-1"><Edit size={16}/></Button>
                  <Button variant="danger" onClick={async () => { if(await showMsg("Excluir", `Remover ${loc.tool_name} do controlo?`, true)) onDelete(loc.id); }} className="!p-2 flex-1"><Trash2 size={16}/></Button>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  );
};

const LocacaoFormModal = ({ onClose, onSave, initialData, showMsg, fornecedoresCadastrados = [] }) => {
  useSuspendRealtime();
  const [form, setForm] = useState(() => ({
    id: initialData?.id || `LOC-${generateId()}`,
    tool_name: initialData?.tool_name || '',
    lending_company: initialData?.lending_company || '',
    patrimonio: initialData?.patrimonio || '',
    responsavel: initialData?.responsavel || '',
    entry_date: initialData?.entry_date ? initialData.entry_date.split('T')[0] : getLocalISOString().slice(0,10),
    status: initialData?.status || 'ENTRADA',
    observacoes: initialData?.observacoes || '',
    historico: initialData?.historico || [],
    ativo: true
  }));
  const handleChange = (f,v) => setForm(p => ({ ...p, [f]: v }));
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card title="Registo de Maquinário" className="max-w-lg w-full">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24}/></button>
        <div className="space-y-4">
          <datalist id="locadoras-list">
            {fornecedoresCadastrados.map(f => <option key={f} value={f} />)}
          </datalist>
          <Input label="Nome da Máquina / Equipamento" value={form.tool_name} onChange={e=>handleChange('tool_name', e.target.value)} required autoFocus />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Fornecedor / Locadora <span className="text-red-500">*</span></label>
              <input list="locadoras-list" value={form.lending_company} onChange={e=>handleChange('lending_company', e.target.value)} required className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" placeholder="Selecione ou digite" />
            </div>
            <Input label="Nº Patrimônio" value={form.patrimonio} onChange={e=>handleChange('patrimonio', e.target.value)} placeholder="Ex: PAT-0042" />
          </div>
          <div className="grid grid-cols-2 gap-4"><Input label="Responsável" value={form.responsavel} onChange={e=>handleChange('responsavel', e.target.value)} /><Input type="date" label="Data de Entrada" value={form.entry_date} onChange={e=>handleChange('entry_date', e.target.value)} /></div>
          <Select label="Status Atual" value={form.status} onChange={e=>handleChange('status', e.target.value)} options={['ENTRADA', 'TROCA', 'DEVOLUCAO']} />
          <div><label className="block text-xs font-medium text-gray-400 mb-1">Observações (Nº Contrato, Condição...)</label><textarea value={form.observacoes} onChange={e=>handleChange('observacoes', e.target.value)} rows={2} className="w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-yellow-500" /></div>
          <div className="flex gap-3 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={() => { if(!form.tool_name) return showMsg("Erro", "Nome obrigatório"); if(!form.lending_company) return showMsg("Erro", "Locadora obrigatória"); onSave(form); }} className="flex-1 !bg-yellow-500"><Save className="w-4 h-4 mr-2"/> Guardar</Button></div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// 14. VIEW: FERRAMENTAS ALUGADAS (ALMOXARIFADO INTERNO)
// ============================================================================

const FerramentasAlugadasView = ({ ferramentas, emprestimos, onSaveFerr, onDeleteFerr, onSaveEmp, onUpdateEmp, showMsg }) => {
  const [activeTab, setActiveTab] = useState('CATALOGO');
  const [showForm, setShowForm] = useState(false);
  const [showSaidaForm, setShowSaidaForm] = useState(false);

  const ferramentasAtivas = (ferramentas || []).filter(f => String(f.ativo) !== 'false' && f.status !== 'INATIVO').sort((a,b)=>a.nome.localeCompare(b.nome));
  const emprestimosAbertos = (emprestimos || []).filter(e => e.status === 'ABERTO').sort((a,b)=>new Date(b.data_retirada)-new Date(a.data_retirada));
  
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between bg-gray-900 p-4 rounded-xl border border-gray-800 gap-3">
        <div className="flex gap-2 p-1 bg-gray-950 rounded-lg border border-gray-800">
          <button onClick={()=>setActiveTab('CATALOGO')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab==='CATALOGO'?'bg-yellow-500 text-gray-900 shadow':'text-gray-400 hover:text-white'}`}>Catálogo Interno</button>
          <button onClick={()=>setActiveTab('EM_USO')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab==='EM_USO'?'bg-yellow-500 text-gray-900 shadow':'text-gray-400 hover:text-white'}`}>Painel de Saídas ({emprestimosAbertos.length})</button>
        </div>
        <div className="flex gap-2">
          {activeTab==='CATALOGO' && <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1"/> Adicionar Ferramenta</Button>}
          {activeTab==='EM_USO' && <Button onClick={() => setShowSaidaForm(true)} className="!bg-blue-600 !text-white"><ArrowRightLeft className="w-4 h-4 mr-1"/> Registar Saída / Empréstimo</Button>}
        </div>
      </div>

      {showForm && <FerramentaFormModal onClose={()=>setShowForm(false)} onSave={d=>{onSaveFerr(d); setShowForm(false);}} showMsg={showMsg}/>}
      {showSaidaForm && <SaidaFormModal onClose={()=>setShowSaidaForm(false)} onSave={d=>{onSaveEmp(d); setShowSaidaForm(false);}} ferramentas={ferramentasAtivas.filter(f=>f.status==='DISPONIVEL')} showMsg={showMsg}/>}

      {activeTab === 'CATALOGO' ? (
        <div className="overflow-x-auto border border-gray-800 rounded-xl">
          <table className="w-full text-sm text-left text-gray-300"><thead className="bg-gray-800"><tr><th className="p-3">Nome / Modelo</th><th className="p-3">Patrimônio</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-gray-800/50">
            {ferramentasAtivas.length===0?(<tr><td colSpan="4" className="p-8 text-center text-gray-500">Sem ferramentas registadas no acervo.</td></tr>):(
              ferramentasAtivas.map(f => (
                <tr key={f.id} className="hover:bg-gray-800/30">
                  <td className="p-3 text-white font-bold">{f.nome}</td><td className="p-3 font-mono text-xs text-gray-500">{f.patrimonio||'-'}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${f.status==='EMPRESTADO'?'bg-orange-900/30 text-orange-400 border border-orange-800':'bg-green-900/30 text-green-400 border border-green-800'}`}>{f.status}</span></td>
                  <td className="p-3 text-right"><button onClick={async()=>{if(await showMsg("Remover", `Inativar ${f.nome}?`, true)) onDeleteFerr(f.id);}} className="text-red-400 p-2 hover:bg-gray-800 rounded transition"><Trash2 size={16}/></button></td>
                </tr>
              ))
            )}
          </tbody></table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emprestimosAbertos.length===0?(<div className="col-span-full py-12 text-center bg-gray-900/50 rounded-xl border border-gray-800"><CheckCircle className="w-12 h-12 text-green-500/50 mx-auto mb-2"/><p className="text-gray-500">Todas as ferramentas encontram-se na base.</p></div>):(
            emprestimosAbertos.map(emp => {
              const ferr = ferramentas.find(f=>f.id===emp.ferramenta_id);
              return (
                <Card key={emp.id} className="border-orange-800/30 bg-gray-900 p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-2"><h3 className="text-white font-bold">{ferr?.nome||'Desconhecida'}</h3><Clock size={16} className="text-orange-400"/></div>
                    <div className="text-sm text-gray-400 space-y-1"><p><strong className="text-gray-300">Retirou:</strong> {emp.retirado_por}</p><p><strong className="text-gray-300">Destino:</strong> {emp.locacao_retirada}</p><p className="text-xs font-mono mt-2 pt-2 border-t border-gray-800">Saída: {formatBRDate(emp.data_retirada)}</p></div>
                  </div>
                  <Button data-write="1" onClick={() => onUpdateEmp(emp.id, 'DEVOLVIDO')} className="w-full mt-4 !bg-green-800 hover:!bg-green-700 !text-green-100 !border-none"><ArrowDownCircle size={16} className="mr-2"/> Registar Devolução</Button>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  );
};

const FerramentaFormModal = ({onClose, onSave, showMsg}) => {
  const [f, setF] = useState({id: `FERR-${generateId()}`, nome: '', patrimonio: '', categoria: 'Ferramentas Manuais', status: 'DISPONIVEL', ativo: true});
  useSuspendRealtime();
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><Card title="Nova Ferramenta" className="max-w-md w-full"><div className="space-y-4"><Input label="Nome da Ferramenta" value={f.nome} onChange={e=>setF({...f,nome:e.target.value})} autoFocus/><Input label="Nº de Patrimônio / Etiqueta" value={f.patrimonio} onChange={e=>setF({...f,patrimonio:e.target.value})}/><div className="flex gap-2 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={()=>{if(!f.nome)return showMsg("Erro","Nome obrigatório"); onSave(f);}} className="flex-1">Guardar</Button></div></div></Card></div>
  );
};

const SaidaFormModal = ({onClose, onSave, ferramentas, showMsg}) => {
  useSuspendRealtime();
  const [f, setF] = useState({id: `EMP-${generateId()}`, data_retirada: getLocalISOString(), ferramenta_id: '', retirado_por: '', locacao_retirada: '', status: 'ABERTO'});
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><Card title="Registo de Saída (Empréstimo)" className="max-w-md w-full"><div className="space-y-4"><Select label="Selecionar Ferramenta Disponível" value={f.ferramenta_id} onChange={e=>setF({...f,ferramenta_id:e.target.value})} options={[{value:'',label:'Selecione...'}, ...ferramentas.map(x=>({value:x.id, label:x.nome}))]} /><Input label="Nome do Colaborador" value={f.retirado_por} onChange={e=>setF({...f,retirado_por:e.target.value})}/><Input label="Obra / Destino" value={f.locacao_retirada} onChange={e=>setF({...f,locacao_retirada:e.target.value})}/><div className="flex gap-2 pt-4 border-t border-gray-800"><Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button onClick={()=>{if(!f.ferramenta_id || !f.retirado_por)return showMsg("Erro","Preencha ferramenta e responsável"); onSave(f);}} className="flex-1 !bg-blue-600 !text-white">Registar Saída</Button></div></div></Card></div>
  );
};

// ============================================================================
// 15. VIEW: INSUMOS CONTROLADOS (PBQP-H)
// ============================================================================

const InsumosControladosView = ({ produtos, movimentacoes, onPrintLabel, showMsg }) => {
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState(() => new Set());
  const [openItem, setOpenItem] = useState(null);

  const rastreaveis = useMemo(() => (produtos || []).filter(p => !!p.rastreavel && String(p.ativo) !== 'false'), [produtos]);

  const grupos = useMemo(() => {
    const s = search.toLowerCase().trim();
    const out = {};
    rastreaveis.forEach(p => {
      if (s && !(`${p.nome} ${p.sku} ${p.lote||''} ${p.fornecedor_nf||''}`.toLowerCase().includes(s))) return;
      const cat = (p.categoria_fvm || inferCategoriaFVM(p.nome) || 'OUTROS').toUpperCase();
      if (!out[cat]) out[cat] = [];
      out[cat].push(p);
    });
    Object.values(out).forEach(arr => arr.sort((a,b)=>String(a.nome).localeCompare(String(b.nome))));
    return out;
  }, [rastreaveis, search]);

  const toggleCat = (cat) => {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };
  const expandAll = () => setExpandedCats(new Set(Object.keys(grupos)));
  const collapseAll = () => setExpandedCats(new Set());

  const movsDoItem = (item) => (movimentacoes || []).filter(m => m.sku === item.id || m.sku === item.sku).sort((a,b)=>new Date(b.data)-new Date(a.data));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-gray-900 p-5 rounded-xl border border-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1"><ClipboardCheck className="text-purple-400"/> Matriz de Rastreabilidade (ISO/PBQP-H)</h2>
            <p className="text-sm text-gray-400">{rastreaveis.length} insumo(s) rastreável(eis) agrupados por categoria FVM.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={expandAll} className="!text-xs !py-1 !px-2">Expandir tudo</Button>
            <Button variant="outline" onClick={collapseAll} className="!text-xs !py-1 !px-2">Recolher tudo</Button>
            <Button onClick={() => printRastreabilidadeReport({ produtos, movimentacoes, showMsg })} className="!bg-purple-600 !text-white"><Printer className="w-4 h-4 mr-1"/> Imprimir Relatório Completo</Button>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, SKU, lote ou NF..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 outline-none focus:border-purple-500" />
        </div>
      </div>

      {Object.keys(grupos).length === 0 ? (
        <div className="text-center py-10 bg-gray-900/30 rounded-xl border border-gray-800"><Tag className="w-10 h-10 text-gray-600 mx-auto mb-3"/><p className="text-gray-500">Nenhum insumo rastreável encontrado.</p></div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grupos).sort((a,b)=>a[0].localeCompare(b[0])).map(([cat, itens]) => {
            const open = expandedCats.has(cat);
            return (
              <div key={cat} className="border border-purple-900/30 rounded-xl overflow-hidden bg-gray-900">
                <button onClick={()=>toggleCat(cat)} className="w-full flex items-center justify-between px-4 py-3 bg-purple-900/20 hover:bg-purple-900/30 transition">
                  <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="w-4 h-4 text-purple-300"/> : <ChevronRight className="w-4 h-4 text-purple-300"/>}
                    <span className="font-bold text-white text-sm uppercase tracking-wider">{cat}</span>
                    <span className="bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded text-[10px] font-bold">{itens.length}</span>
                  </div>
                </button>
                {open && (
                  <ul className="divide-y divide-gray-800">
                    {itens.map(item => (
                      <li key={item.id}>
                        <button onClick={()=>setOpenItem(item)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition text-left">
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-semibold truncate">{item.nome}</div>
                            <div className="text-[10px] text-gray-400 font-mono flex gap-2 flex-wrap mt-0.5">
                              <span className="bg-gray-800 px-1.5 py-0.5 rounded">{item.sku}</span>
                              {item.lote && <span className="bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">Lote {item.lote}</span>}
                              {item.validade && <span className="bg-gray-800 px-1.5 py-0.5 rounded">Val {formatBRDate(item.validade)}</span>}
                              {item.ordem_compra && <span className="bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded">OC {item.ordem_compra}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase text-gray-500">Saldo</div>
                            <div className="text-white text-sm font-bold">{item.saldo_atual||0} {item.unidade}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setOpenItem(null)}>
          <Card className="w-full max-w-3xl !p-0 overflow-hidden max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900">
              <div className="min-w-0">
                <h3 className="text-white font-bold truncate">{openItem.nome}</h3>
                <p className="text-[10px] text-purple-300 uppercase tracking-wider">{openItem.categoria_fvm || inferCategoriaFVM(openItem.nome)} · {openItem.dna_type || 'DNA Geral'}</p>
              </div>
              <button onClick={()=>setOpenItem(null)} className="text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">SKU</span><span className="text-white font-mono">{openItem.sku}</span></div>
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">Saldo</span><span className="text-white font-bold">{openItem.saldo_atual||0} {openItem.unidade}</span></div>
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">Lote</span><span className="text-yellow-300 font-mono">{openItem.lote||'—'}</span></div>
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">Validade</span><span className="text-gray-200">{formatBRDate(openItem.validade)||'—'}</span></div>
                <div className="col-span-2"><span className="block text-[10px] uppercase font-bold text-gray-500">Fornecedor / NF</span><span className="text-gray-200">{openItem.fornecedor_nf||'—'}</span></div>
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">Ordem de Compra</span><span className="text-blue-300 font-mono">{openItem.ordem_compra||'—'}</span></div>
                <div><span className="block text-[10px] uppercase font-bold text-gray-500">Empreiteira</span><span className="text-gray-200">{openItem.empreiteira||'—'}</span></div>
              </div>
              {openItem.anexo_nf_url && (
                <div className="bg-gray-950 border border-gray-800 rounded p-3 text-xs">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Anexo NF</span>
                  <a href={openItem.anexo_nf_url} target="_blank" rel="noreferrer" className="text-blue-400 underline">📎 {openItem.anexo_nf_nome || 'Documento da NF'}</a>
                </div>
              )}
              <div className="bg-gray-950 border border-gray-800 rounded p-3">
                <span className="block text-[10px] uppercase font-bold text-gray-500 mb-2">Especificações DNA</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                  {Object.entries(openItem.dna_payload||{}).filter(([,v])=>v).map(([k,v])=>(<div key={k}><span className="text-gray-500">{k}:</span> {v}</div>))}
                  {Object.values(openItem.dna_payload||{}).filter(Boolean).length === 0 && <span className="text-gray-600 italic">Nenhum parâmetro extra preenchido.</span>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Histórico de Movimentação</span>
                  <span className="text-[10px] text-gray-500">{movsDoItem(openItem).length} registro(s)</span>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900 sticky top-0"><tr className="text-gray-400"><th className="text-left p-2">Data</th><th className="text-left p-2">Tipo</th><th className="text-right p-2">Qtd</th><th className="text-left p-2">Origem/Destino</th><th className="text-left p-2">Responsável</th></tr></thead>
                    <tbody className="divide-y divide-gray-800">
                      {movsDoItem(openItem).length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-gray-600 italic p-4">Sem movimentações registradas.</td></tr>
                      ) : movsDoItem(openItem).map(m => (
                        <tr key={m.id} className="text-gray-300">
                          <td className="p-2 whitespace-nowrap">{formatBRDate(m.data)}</td>
                          <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.tipo==='ENTRADA'?'bg-green-900/40 text-green-300':'bg-red-900/40 text-red-300'}`}>{m.tipo}</span></td>
                          <td className="p-2 text-right font-bold">{m.qtd}</td>
                          <td className="p-2">{m.destino||m.origem||'—'}</td>
                          <td className="p-2">{m.responsavel||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-800 bg-gray-900 flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={()=>onPrintLabel([openItem])}><PrinterIcon className="w-4 h-4 mr-1"/> Etiqueta</Button>
              <Button variant="outline" onClick={()=>printFVMReport({ produtos, movimentacoes, skuFiltro: openItem.id, showMsg, titulo: `FVM PBQP-H — ${openItem.nome}` })} className="!text-yellow-300 !border-yellow-800"><FileCheck className="w-4 h-4 mr-1"/> FVM do Item</Button>
              <Button onClick={()=>printRastreabilidadeReport({ produtos, movimentacoes, showMsg, itemUnico: openItem })} className="!bg-purple-600 !text-white"><Printer className="w-4 h-4 mr-1"/> Rastreabilidade + Histórico</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};


// ============================================================================
// 17. VIEW: BACKUP E RESTAURAÇÃO
// ============================================================================

const BackupView = ({ produtos, movimentacoes, requisicoes, locacoes, ferramentas, emprestimos, desperdicios, showMsg }) => {
  const handleExport = () => {
    const data = { produtos, movimentacoes_estoque: movimentacoes, requisicoes, locacoes, ferramentas, emprestimos, desperdicios, exportDate: new Date().toISOString(), version: '6.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `backup-rmk1-almox-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if(!await showMsg("Alerta de Restauro", "Esta ação vai APAGAR o banco atual e substituir pelo ficheiro JSON. Continuar?", true)) return;
    try {
      const text = await file.text(); const data = JSON.parse(text);
      const cols = ['produtos', 'movimentacoes_estoque', 'requisicoes', 'locacoes', 'ferramentas', 'emprestimos', 'desperdicios'];
      for (const col of cols) { if (data[col]) { await AppDB.clearAll(col); for (const item of data[col]) { await AppDB.put(col, item); } } }
      await showMsg("Restauro Concluído", "O sistema vai ser recarregado."); window.location.reload();
    } catch (error) { showMsg('Erro no Backup', error.message); }
  };

  return (
    <div className="space-y-6">
      <Card title="Motor Base de Dados (IndexedDB FastSync)" icon={Database}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg text-center"><Package className="w-6 h-6 text-yellow-400 mx-auto mb-2" /><p className="text-xl font-bold text-white">{produtos?.length || 0}</p><p className="text-[10px] uppercase text-gray-400">Produtos</p></div>
          <div className="bg-gray-800 p-4 rounded-lg text-center"><ArrowRightLeft className="w-6 h-6 text-blue-400 mx-auto mb-2" /><p className="text-xl font-bold text-white">{movimentacoes?.length || 0}</p><p className="text-[10px] uppercase text-gray-400">Auditoria Mov.</p></div>
          <div className="bg-gray-800 p-4 rounded-lg text-center"><Building2 className="w-6 h-6 text-green-400 mx-auto mb-2" /><p className="text-xl font-bold text-white">{locacoes?.length || 0}</p><p className="text-[10px] uppercase text-gray-400">Locações Ext.</p></div>
          <div className="bg-gray-800 p-4 rounded-lg text-center"><Wrench className="w-6 h-6 text-purple-400 mx-auto mb-2" /><p className="text-xl font-bold text-white">{ferramentas?.length || 0}</p><p className="text-[10px] uppercase text-gray-400">Ferramentas</p></div>
          <div className="bg-gray-800 p-4 rounded-lg text-center"><AlertOctagon className="w-6 h-6 text-red-400 mx-auto mb-2" /><p className="text-xl font-bold text-white">{desperdicios?.length || 0}</p><p className="text-[10px] uppercase text-gray-400">Desperdícios</p></div>
        </div>
      </Card>

      <Card title="Backup Segurança" icon={Cloud}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center"><Download className="w-12 h-12 text-blue-400 mx-auto mb-4" /><h3 className="text-white font-semibold mb-2">Exportar Imagem Global</h3><p className="text-sm text-gray-400 mb-4">Salvar JSON com integridade estrutural.</p><Button onClick={handleExport} className="w-full !bg-blue-600 !text-white"><Download className="w-4 h-4 mr-2"/> Download DB</Button></div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center"><Upload className="w-12 h-12 text-green-400 mx-auto mb-4" /><h3 className="text-white font-semibold mb-2">Restaurar Ficheiro JSON</h3><p className="text-sm text-gray-400 mb-4">Substituição destrutiva da base atual.</p><label className="cursor-pointer block"><input type="file" accept=".json" onChange={handleImport} className="hidden" /><Button variant="secondary" className="w-full !bg-gray-700 hover:!bg-gray-600"><Upload className="w-4 h-4 mr-2"/> Fazer Upload</Button></label></div>
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// 18. TELA DE LOGIN
// ============================================================================

const PWAInstallButton = () => {
  const [deferred, setDeferred] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else {
      setShowGuide(true);
    }
  };

  if (installed) return (
    <div className="mt-4 w-full py-3 rounded-xl bg-green-900/20 border border-green-700/40 text-green-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
      <CheckCircle size={14}/> App Instalado no Dispositivo
    </div>
  );

  return (
    <>
      <button type="button" onClick={handleInstall} className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-blue-500/30 shadow-lg transition">
        <Smartphone size={14}/> Instalar App no Dispositivo
      </button>
      {showGuide && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowGuide(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 text-gray-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-yellow-400 flex items-center gap-2"><MonitorSmartphone size={20}/> Como Instalar</h3>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                <p className="font-bold text-blue-400 mb-2">📱 Android (Chrome)</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-1 text-xs">
                  <li>Toque no menu ⋮ no canto superior direito</li>
                  <li>Selecione "Adicionar à tela inicial" ou "Instalar app"</li>
                  <li>Confirme tocando em "Instalar"</li>
                </ol>
              </div>
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                <p className="font-bold text-blue-400 mb-2">🍎 iPhone / iPad (Safari)</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-1 text-xs">
                  <li>Toque no botão Compartilhar (quadrado com seta para cima)</li>
                  <li>Role e selecione "Adicionar à Tela de Início"</li>
                  <li>Toque em "Adicionar" no canto superior direito</li>
                </ol>
              </div>
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                <p className="font-bold text-blue-400 mb-2">💻 Windows / macOS (Chrome / Edge)</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-1 text-xs">
                  <li>Procure pelo ícone de instalação ⊕ na barra de endereço</li>
                  <li>Ou abra o menu ⋮ → "Instalar YARIN ALMOX"</li>
                  <li>Clique em "Instalar"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const LoginScreen = ({ onLogin, onGuest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      const appRole = data.user?.app_metadata?.role;
      const role = appRole === 'admin' ? 'admin' : (data.user?.user_metadata?.role === 'admin' ? 'viewer' : (data.user?.user_metadata?.role || 'viewer'));
      onLogin({ name: data.user?.user_metadata?.name || email, role, email });
    } catch (err) {
      setError(err.message || 'Falha na autenticação');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-yellow-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)]"><Package className="w-10 h-10 text-gray-900"/></div>
          <h1 className="text-4xl font-black text-white tracking-tighter">{SYSTEM_NAME}</h1>
          <p className="text-yellow-500 font-mono text-xs tracking-[0.2em] mt-2 uppercase">SaaS Logística & Obras</p>
          <p className="text-gray-500 text-[10px] mt-2 flex items-center justify-center gap-1"><Cloud size={10}/> Sincronização em Nuvem Ativa</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>

          <div className="mb-5 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-bold">Acesso Restrito</p>
            <p className="text-[10px] text-gray-600 mt-1">Novos cadastros desabilitados. Solicite acesso ao administrador.</p>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-950 text-white py-3 px-4 rounded-xl border border-gray-800 focus:border-yellow-500 focus:outline-none" placeholder="voce@empresa.com" />
          </div>
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-950 text-white pl-11 pr-4 py-3 rounded-xl border border-gray-800 focus:border-yellow-500 focus:outline-none" placeholder="••••••" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full py-3 uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(234,179,8,0.2)]">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <LogIn className="w-4 h-4 mr-2"/>}
            Iniciar Sessão
          </Button>
          {error && <p className="text-xs font-bold text-center mt-4 uppercase tracking-wider text-red-400 animate-pulse">{error}</p>}

        </form>
        <PWAInstallButton />
      </div>
    </div>
  );
};

// ============================================================================
// 18.5 AGENDA DE OC (Calendário)
// ============================================================================

const AGENDA_STATUS = {
  PROGRAMADA: { label: 'Programada', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40', dot: 'bg-blue-500' },
  ENTREGUE:   { label: 'Entregue',   cls: 'bg-green-500/15 text-green-300 border-green-500/40', dot: 'bg-green-500' },
  PENDENTE:   { label: 'Pendente',   cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-500' },
  VENCIDA:    { label: 'Vencida',    cls: 'bg-red-500/15 text-red-300 border-red-500/40', dot: 'bg-red-500' },
};

const computeAgendaStatus = (item) => {
  if (item.status === 'ENTREGUE' || item.data_entrega) return 'ENTREGUE';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const prog = item.data_programada ? new Date(item.data_programada + 'T00:00:00') : null;
  if (prog && prog < hoje) return 'VENCIDA';
  if (item.status === 'PROGRAMADA') return 'PROGRAMADA';
  return 'PENDENTE';
};

const AgendaOCForm = ({ item, onSave, onClose, onDelete, isViewer }) => {
  useSuspendRealtime(true);
  const [f, setF] = useState(() => ({
    id: item?.id || `OC-${generateId()}`,
    titulo: item?.titulo || '',
    numero_oc: item?.numero_oc || '',
    fornecedor: item?.fornecedor || '',
    vendedor: item?.vendedor || '',
    telefone_fornecedor: item?.telefone_fornecedor || '',
    email_fornecedor: item?.email_fornecedor || '',
    data_programada: item?.data_programada || '',
    data_entrega: item?.data_entrega || '',
    status: item?.status || '',
    valor: item?.valor || '',
    notas: item?.notas || '',
    anexo_oc_url: item?.anexo_oc_url || '',
    anexo_oc_name: item?.anexo_oc_name || '',
    nf_numero: item?.nf_numero || '',
    nf_anexo_url: item?.nf_anexo_url || '',
    nf_anexo_name: item?.nf_anexo_name || '',
    created_at: item?.created_at || getLocalISOString(),
  }));
  const upd = (k,v) => setF(p => ({...p, [k]: v}));

  const handleAnexo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo muito grande (máx 5MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setF(p => ({ ...p, anexo_oc_url: reader.result, anexo_oc_name: file.name }));
    reader.readAsDataURL(file);
  };

  const handleAnexoNF = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo muito grande (máx 5MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setF(p => ({ ...p, nf_anexo_url: reader.result, nf_anexo_name: file.name }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => { e.preventDefault(); if (!f.titulo.trim()) return; onSave({ ...f, updated_at: getLocalISOString() }); onClose(); };
  const statusPreview = computeAgendaStatus(f);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><CalendarDays className="text-yellow-500" size={20}/>{item ? 'Editar OC' : 'Nova OC na Agenda'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded border inline-flex items-center gap-2 ${AGENDA_STATUS[statusPreview].cls}`}>
              <span className={`w-2 h-2 rounded-full ${AGENDA_STATUS[statusPreview].dot}`}></span>
              Status atual: {AGENDA_STATUS[statusPreview].label}
            </div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-2">Classificar como:</label>
            <select value={f.status||''} onChange={e=>upd('status', e.target.value)} className="bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-white">
              <option value="">— Automático —</option>
              <option value="PROGRAMADA">Programada</option>
              <option value="ENTREGUE">Entregue</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Título / Descrição *</label>
            <input value={f.titulo} onChange={e=>upd('titulo', e.target.value)} required className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="Ex: OC #1023 — Cimento CP-II"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nº OC</label>
              <input value={f.numero_oc} onChange={e=>upd('numero_oc', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fornecedor</label>
              <input value={f.fornecedor} onChange={e=>upd('fornecedor', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendedor / Contato</label>
              <input value={f.vendedor} onChange={e=>upd('vendedor', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="Nome do vendedor"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Telefone / WhatsApp</label>
              <input value={f.telefone_fornecedor} onChange={e=>upd('telefone_fornecedor', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="(00) 00000-0000"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
              <input type="email" value={f.email_fornecedor} onChange={e=>upd('email_fornecedor', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor (R$)</label>
              <input type="number" step="0.01" value={f.valor} onChange={e=>upd('valor', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Data Programada de Entrega</label>
              <input type="date" value={f.data_programada} onChange={e=>upd('data_programada', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
              <p className="text-[9px] text-gray-600 mt-1">Sem data = Pendente • Com data futura = Programada • Vencida automática</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Data de Entrega (real)</label>
              <input type="date" value={f.data_entrega} onChange={e=>upd('data_entrega', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
              <p className="text-[9px] text-gray-600 mt-1">Preencher marca como Entregue</p>
            </div>
          </div>

          <div className="bg-gray-950/60 border border-gray-800 rounded-lg p-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FileText size={12}/> Anexar OC em PDF</label>
            {f.anexo_oc_url ? (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <a href={f.anexo_oc_url} download={f.anexo_oc_name||'oc.pdf'} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold rounded flex items-center gap-1"><Download size={12}/> Baixar</a>
                <a href={f.anexo_oc_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded flex items-center gap-1"><Eye size={12}/> Visualizar</a>
                <span className="text-[11px] text-gray-400 truncate max-w-[200px]">{f.anexo_oc_name||'arquivo.pdf'}</span>
                <button type="button" onClick={()=>setF(p=>({...p, anexo_oc_url:'', anexo_oc_name:''}))} className="ml-auto text-red-400 hover:text-red-300 text-xs font-bold">Remover</button>
              </div>
            ) : (
              <input type="file" accept="application/pdf,image/*" onChange={handleAnexo} disabled={isViewer} className="mt-2 block w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-yellow-500 file:text-gray-900 file:font-bold file:text-xs hover:file:bg-yellow-400"/>
            )}
          </div>

          <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-2"><Check size={12}/> Recebimento — Nota Fiscal</label>
              <span className="text-[9px] text-gray-500">preencher ao receber a OC</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nº da NF</label>
                <input value={f.nf_numero} onChange={e=>upd('nf_numero', e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="Ex: 123456"/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Anexar NF (PDF/Imagem)</label>
                {f.nf_anexo_url ? (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <a href={f.nf_anexo_url} download={f.nf_anexo_name||'nf.pdf'} className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[10px] font-bold rounded flex items-center gap-1"><Download size={10}/> Baixar</a>
                    <a href={f.nf_anexo_url} target="_blank" rel="noreferrer" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-bold rounded flex items-center gap-1"><Eye size={10}/> Ver</a>
                    <button type="button" onClick={()=>setF(p=>({...p, nf_anexo_url:'', nf_anexo_name:''}))} className="text-red-400 hover:text-red-300 text-[10px] font-bold">Remover</button>
                  </div>
                ) : (
                  <input type="file" accept="application/pdf,image/*" onChange={handleAnexoNF} disabled={isViewer} className="mt-1 block w-full text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-600 file:text-white file:font-bold file:text-[10px] hover:file:bg-green-500"/>
                )}
                {f.nf_anexo_name && <div className="mt-1 text-[10px] text-green-400 truncate">📎 {f.nf_anexo_name}</div>}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Notas / Informações</label>
            <textarea value={f.notas} onChange={e=>upd('notas', e.target.value)} rows={4} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="Observações, itens, prazo de pagamento..."/>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={isViewer} className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 font-black py-3 rounded-lg uppercase text-sm tracking-wider flex items-center justify-center gap-2"><Save size={16}/> Salvar</button>
            {item && <button type="button" onClick={()=>{onDelete(item.id); onClose();}} disabled={isViewer} className="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-40 text-red-300 font-bold py-3 px-4 rounded-lg border border-red-500/40"><Trash2 size={16}/></button>}
          </div>
        </form>
      </div>
    </div>
  );
};

const printAgendaReport = (agenda, { mes, ano, statusFiltro, dataInicio, dataFim } = {}) => {
  const w = window.open('', '', 'height=900,width=1200');
  if (!w) return;
  const items = (agenda||[]).map(a => ({...a, _status: computeAgendaStatus(a)}));
  let filtered = items;
  // Campo relevante por status — ENTREGUE=data_entrega; PENDENTE=created_at; PROGRAMADA/VENCIDA=data_programada
  const dateFieldFor = (st) => st === 'ENTREGUE' ? 'data_entrega' : (st === 'PENDENTE' ? 'created_at' : 'data_programada');
  const getDateStr = (it) => {
    const f = dateFieldFor(it._status);
    const v = it[f];
    return v ? String(v).slice(0,10) : null;
  };
  if (dataInicio || dataFim) {
    filtered = filtered.filter(i => {
      const v = getDateStr(i); if (!v) return false;
      if (dataInicio && v < dataInicio) return false;
      if (dataFim && v > dataFim) return false;
      return true;
    });
  } else if (typeof mes === 'number' && typeof ano === 'number') {
    filtered = filtered.filter(i => {
      const v = getDateStr(i); if (!v) return false;
      const d = new Date(v + 'T00:00:00');
      return d.getMonth()===mes && d.getFullYear()===ano;
    });
  } else if (typeof ano === 'number') {
    filtered = filtered.filter(i => {
      const v = getDateStr(i); if (!v) return false;
      return new Date(v + 'T00:00:00').getFullYear() === ano;
    });
  }
  if (statusFiltro && statusFiltro !== 'ALL') filtered = filtered.filter(i => i._status === statusFiltro);
  filtered.sort((a,b)=> (getDateStr(a)||'').localeCompare(getDateStr(b)||''));

  const stats = { PROGRAMADA:0, ENTREGUE:0, PENDENTE:0, VENCIDA:0 };
  filtered.forEach(i => { stats[i._status] = (stats[i._status]||0)+1; });
  const totalValor = filtered.reduce((s,i)=>s + (Number(i.valor)||0), 0);

  const grupos = {};
  filtered.forEach(i => { (grupos[i._status] = grupos[i._status]||[]).push(i); });
  const ordemStatus = ['VENCIDA','PENDENTE','PROGRAMADA','ENTREGUE'];
  const statusLabel = { PROGRAMADA:'Programada', ENTREGUE:'Entregue', PENDENTE:'Pendente', VENCIDA:'Vencida' };
  const statusColor = { PROGRAMADA:'#1e40af', ENTREGUE:'#15803d', PENDENTE:'#a16207', VENCIDA:'#b91c1c' };

  const periodo = (dataInicio || dataFim)
    ? `${dataInicio ? formatBRDate(dataInicio) : '...'} até ${dataFim ? formatBRDate(dataFim) : 'hoje em diante'}`
    : ((typeof mes==='number' && typeof ano==='number')
      ? new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
      : (typeof ano === 'number' ? `Ano ${ano}` : 'Geral (todos os períodos)'));


  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Agenda de OC - ${periodo}</title>
  <style>
    *{box-sizing:border-box;font-family:Arial,sans-serif} body{margin:18px;color:#111}
    h1{margin:0;font-size:18px;text-transform:uppercase;letter-spacing:1px}
    .sub{font-size:11px;color:#555;margin-top:2px}
    .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
    .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
    .stat{border:1px solid #ccc;padding:8px;border-radius:4px}
    .stat .l{font-size:9px;text-transform:uppercase;color:#666;letter-spacing:.5px}
    .stat .v{font-size:18px;font-weight:900;color:#111}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;padding:4px 8px;color:#fff;border-radius:3px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th,td{border:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top}
    th{background:#f3f3f3;text-transform:uppercase;font-size:9px;letter-spacing:.5px}
    .c{text-align:center} .r{text-align:right} .mono{font-family:Consolas,monospace}
    .notas{color:#444;font-style:italic;font-size:9px}
    tfoot td{font-weight:bold;background:#f9f9f9}
    .ft{margin-top:20px;font-size:9px;color:#666;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between}
    @media print { .noprint{display:none} }
  </style></head><body>
  <div class="hdr">
    <div><h1>Agenda de Ordens de Compra</h1><div class="sub">${SYSTEM_NAME} — Relatório: ${periodo}${statusFiltro && statusFiltro!=='ALL'?` • Status: ${statusLabel[statusFiltro]}`:''}</div></div>
    <div style="text-align:right;font-size:10px;color:#555">Emitido em<br/><b>${new Date().toLocaleString('pt-BR')}</b></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="l">Total OCs</div><div class="v">${filtered.length}</div></div>
    <div class="stat"><div class="l">Programadas</div><div class="v" style="color:${statusColor.PROGRAMADA}">${stats.PROGRAMADA}</div></div>
    <div class="stat"><div class="l">Pendentes</div><div class="v" style="color:${statusColor.PENDENTE}">${stats.PENDENTE}</div></div>
    <div class="stat"><div class="l">Vencidas</div><div class="v" style="color:${statusColor.VENCIDA}">${stats.VENCIDA}</div></div>
    <div class="stat"><div class="l">Entregues</div><div class="v" style="color:${statusColor.ENTREGUE}">${stats.ENTREGUE}</div></div>
  </div>
  ${filtered.length===0 ? '<p style="text-align:center;color:#888;padding:30px">Nenhuma OC encontrada para o filtro selecionado.</p>' :
    ordemStatus.filter(s=>grupos[s]&&grupos[s].length).map(s => `
      <h2 style="background:${statusColor[s]}">${statusLabel[s]} (${grupos[s].length})</h2>
      <table>
        <thead><tr>
          <th style="width:70px">Criada em</th>
          <th style="width:70px">Agendada</th>
          <th style="width:60px">OC Nº</th>
          <th>Título</th>
          <th style="width:110px">Fornecedor</th>
          <th style="width:120px">Vendedor / Contato</th>
          <th style="width:70px">Recebida</th>
          <th style="width:70px" class="c">NF Nº</th>
          <th style="width:75px" class="r">Valor (R$)</th>
          <th style="width:55px" class="c">Anexos</th>
          <th>Notas</th>
        </tr></thead>
        <tbody>
          ${grupos[s].map(it => `<tr>
            <td class="c mono">${it.created_at?new Date(it.created_at).toLocaleDateString('pt-BR'):'—'}</td>
            <td class="c mono">${formatBRDate(it.data_programada)||'—'}</td>
            <td class="c mono">${it.numero_oc?'#'+it.numero_oc:'—'}</td>
            <td><b>${(it.titulo||'—').replace(/</g,'&lt;')}</b></td>
            <td>${(it.fornecedor||'—').replace(/</g,'&lt;')}</td>
            <td>${[it.vendedor, it.telefone_fornecedor].filter(Boolean).join(' • ').replace(/</g,'&lt;')||'—'}</td>
            <td class="c mono">${formatBRDate(it.data_entrega)||'—'}</td>
            <td class="c mono"><b>${it.nf_numero?'#'+String(it.nf_numero).replace(/</g,'&lt;'):'—'}</b></td>
            <td class="r mono">${it.valor?Number(it.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—'}</td>
            <td class="c">${[it.anexo_oc_url?'OC':'', it.nf_anexo_url?'NF':''].filter(Boolean).join(' + ')||'—'}</td>
            <td class="notas">${(it.notas||'').replace(/</g,'&lt;')||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `).join('')
  }
  <div style="margin-top:14px;text-align:right;font-size:11px"><b>Valor Total das OCs: R$ ${totalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></div>
  <div class="ft"><span>${SYSTEM_NAME} — Agenda de OC</span><span>Página 1</span></div>
  </body></html>`;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>w.print(), 500);
};

const ReceberOCModal = ({ item, onSave, onClose }) => {
  useSuspendRealtime(true);
  const [data_entrega, setDataEntrega] = useState(item?.data_entrega || getLocalISOString().slice(0,10));
  const [nf_numero, setNfNumero] = useState(item?.nf_numero || '');
  const [nf_anexo_url, setNfUrl] = useState(item?.nf_anexo_url || '');
  const [nf_anexo_name, setNfName] = useState(item?.nf_anexo_name || '');
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo muito grande (máx 5MB).'); return; }
    const r = new FileReader();
    r.onload = () => { setNfUrl(r.result); setNfName(file.name); };
    r.readAsDataURL(file);
  };
  const confirm = () => {
    onSave({ ...item, status:'ENTREGUE', data_entrega, nf_numero, nf_anexo_url, nf_anexo_name, updated_at: getLocalISOString() });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-green-700/40 rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2"><Check className="text-green-400" size={18}/> Receber OC {item?.numero_oc && <span className="text-xs text-gray-400 font-mono">#{item.numero_oc}</span>}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="text-xs text-gray-400 truncate">{item?.titulo}</div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Data do Recebimento</label>
          <input type="date" value={data_entrega} onChange={e=>setDataEntrega(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1"/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nº da NF *</label>
          <input value={nf_numero} onChange={e=>setNfNumero(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1" placeholder="Ex: 123456" autoFocus/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Anexar NF (PDF/Imagem)</label>
          {nf_anexo_url ? (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <a href={nf_anexo_url} target="_blank" rel="noreferrer" className="px-2 py-1 bg-gray-800 text-blue-300 text-[10px] font-bold rounded flex items-center gap-1"><Eye size={10}/> {nf_anexo_name||'NF'}</a>
              <button type="button" onClick={()=>{setNfUrl(''); setNfName('');}} className="text-red-400 text-[10px] font-bold">Remover</button>
            </div>
          ) : (
            <input type="file" accept="application/pdf,image/*" onChange={onFile} className="mt-1 block w-full text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-600 file:text-white file:font-bold file:text-[10px] hover:file:bg-green-500"/>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold uppercase">Cancelar</button>
          <button onClick={confirm} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-2"><Check size={14}/> Confirmar Recebimento</button>
        </div>
      </div>
    </div>
  );
};

const ConcluidasReportModal = ({ onClose, onGenerate }) => {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [escopo, setEscopo] = useState('MES'); // MES | ANO | TUDO
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const anos = []; for (let y = now.getFullYear()+1; y >= 2020; y--) anos.push(y);
  const go = () => {
    if (escopo === 'TUDO') onGenerate({ statusFiltro: 'ENTREGUE' });
    else if (escopo === 'ANO') onGenerate({ statusFiltro: 'ENTREGUE', ano: Number(ano) });
    else onGenerate({ statusFiltro: 'ENTREGUE', mes: Number(mes), ano: Number(ano) });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-teal-700/40 rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2"><FileBarChart className="text-teal-400" size={18}/> Relatório de OCs Concluídas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18}/></button>
        </div>
        <p className="text-xs text-gray-400">Gera relatório profissional com rastreio completo (criação, agendamento, recebimento, NF) das OCs entregues.</p>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Período</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[{k:'MES',l:'Mês'},{k:'ANO',l:'Ano'},{k:'TUDO',l:'Geral'}].map(o => (
              <button key={o.k} onClick={()=>setEscopo(o.k)} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase ${escopo===o.k?'bg-teal-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{o.l}</button>
            ))}
          </div>
        </div>
        {escopo !== 'TUDO' && (
          <div className="grid grid-cols-2 gap-2">
            {escopo === 'MES' && (
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mês</label>
                <select value={mes} onChange={e=>setMes(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1">
                  {meses.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            )}
            <div className={escopo==='ANO'?'col-span-2':''}>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ano</label>
              <select value={ano} onChange={e=>setAno(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mt-1">
                {anos.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold uppercase">Cancelar</button>
          <button onClick={go} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-2"><Printer size={14}/> Gerar / Imprimir</button>
        </div>
      </div>
    </div>
  );
};

const AgendaOCView = ({ agenda, onSave, onDelete, isViewer }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [showConcluidasReport, setShowConcluidasReport] = useState(false);
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');


  const items = useMemo(() => agenda.map(a => ({...a, _status: computeAgendaStatus(a)})), [agenda]);
  const searchFiltered = useMemo(() => {
    const raw = search.trim().toLowerCase();
    if (!raw) return items;
    const terms = raw.split(/\s+/).filter(Boolean);
    return items.filter(i => {
      const haystack = Object.entries(i)
        .filter(([k]) => !k.startsWith('_') && k !== 'anexo_oc_url' && k !== 'nf_anexo_url' && k !== 'id')
        .map(([, v]) => {
          if (v == null) return '';
          if (typeof v === 'string' || typeof v === 'number') return String(v);
          try { return JSON.stringify(v); } catch { return ''; }
        })
        .join(' ')
        .toLowerCase();
      return terms.every(t => haystack.includes(t));
    });
  }, [items, search]);
  const filtered = useMemo(() => filterStatus==='ALL' ? searchFiltered : searchFiltered.filter(i=>i._status===filterStatus), [searchFiltered, filterStatus]);

  const stats = useMemo(() => {
    const s = { PROGRAMADA: 0, ENTREGUE: 0, PENDENTE: 0, VENCIDA: 0 };
    items.forEach(i => { s[i._status] = (s[i._status]||0) + 1; });
    return s;
  }, [items]);

  // Calendário do mês
  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0);
  const startWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsByDay = useMemo(() => {
    const map = {};
    filtered.forEach(it => {
      if (!it.data_programada) return;
      const key = it.data_programada;
      (map[key] = map[key] || []).push(it);
    });
    return map;
  }, [filtered]);

  const monthName = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (it) => { setEditing(it); setShowForm(true); };

  // Ordem: vencidas, pendentes (sem data), programadas próximas, entregues no fim
  const statusOrd = { VENCIDA: 0, PENDENTE: 1, PROGRAMADA: 2, ENTREGUE: 3 };
  const upcoming = useMemo(() => [...filtered]
    .sort((a,b) => (statusOrd[a._status]-statusOrd[b._status]) || ((a.data_programada||'9999').localeCompare(b.data_programada||'9999')))
    .slice(0, 80), [filtered]);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(AGENDA_STATUS).map(([k,v]) => (
          <button key={k} onClick={()=>setFilterStatus(filterStatus===k?'ALL':k)} className={`p-4 rounded-xl border text-left transition ${filterStatus===k?'border-yellow-500 bg-yellow-500/5':'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-1"><span className={`w-2 h-2 rounded-full ${v.dot}`}></span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{v.label}</span></div>
            <p className="text-2xl font-black text-white">{stats[k]||0}</p>
          </button>
        ))}
      </div>

      {/* Header / controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"><ChevronLeft size={16}/></button>
            <h3 className="text-base font-black text-white uppercase tracking-tight min-w-[180px] text-center">{monthName}</h3>
            <button onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"><ChevronRight size={16}/></button>
            <button onClick={()=>{ const d=new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase">Hoje</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filterStatus !== 'ALL' && <button onClick={()=>setFilterStatus('ALL')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase flex items-center gap-1"><X size={12}/> Filtro</button>}
            <button onClick={()=>printAgendaReport(agenda, { mes: cursor.getMonth(), ano: cursor.getFullYear(), statusFiltro: filterStatus })} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase flex items-center gap-2"><Printer size={14}/> Imprimir Mês</button>
            <button onClick={()=>printAgendaReport(agenda, { statusFiltro: filterStatus })} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase flex items-center gap-2"><FileBarChart size={14}/> Relatório Geral</button>
            <button onClick={()=>printAgendaReport(agenda, { statusFiltro: 'PENDENTE' })} className="px-3 py-2 bg-yellow-900/30 hover:bg-yellow-800/40 border border-yellow-700/40 rounded-lg text-xs font-bold text-yellow-300 uppercase flex items-center gap-2"><Printer size={14}/> Pendentes</button>
            <button onClick={()=>printAgendaReport(agenda, { statusFiltro: 'PROGRAMADA' })} className="px-3 py-2 bg-blue-900/30 hover:bg-blue-800/40 border border-blue-700/40 rounded-lg text-xs font-bold text-blue-300 uppercase flex items-center gap-2"><Printer size={14}/> Agendadas</button>
            <button onClick={()=>printAgendaReport(agenda, { statusFiltro: 'ENTREGUE' })} className="px-3 py-2 bg-green-900/30 hover:bg-green-800/40 border border-green-700/40 rounded-lg text-xs font-bold text-green-300 uppercase flex items-center gap-2"><Printer size={14}/> Entregues</button>
            <button onClick={()=>setShowConcluidasReport(true)} className="px-3 py-2 bg-teal-900/30 hover:bg-teal-800/40 border border-teal-700/40 rounded-lg text-xs font-bold text-teal-300 uppercase flex items-center gap-2"><FileBarChart size={14}/> Concluídas (Mês/Ano)</button>
            <button onClick={()=>printAgendaReport(agenda, { statusFiltro: 'VENCIDA' })} className="px-3 py-2 bg-red-900/30 hover:bg-red-800/40 border border-red-700/40 rounded-lg text-xs font-bold text-red-300 uppercase flex items-center gap-2"><Printer size={14}/> Vencidas</button>
            <button onClick={openNew} disabled={isViewer} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 font-black rounded-lg text-xs uppercase tracking-wider flex items-center gap-2"><Plus size={14}/> Nova OC</button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por palavras-chave (nº OC, título, fornecedor, obs, etc.)..." className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-gray-500 focus:border-yellow-500 outline-none"/>
          {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"><X size={14}/></button>}
        </div>

        {/* Filtro por data (dia) — imprime relatório do período selecionado */}
        <div className="mt-3 flex flex-wrap items-end gap-2 p-3 bg-gray-950/60 border border-gray-800 rounded-lg">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-yellow-500 outline-none"/>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Fim (opcional)</label>
            <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-yellow-500 outline-none"/>
          </div>
          <button
            onClick={()=>{
              if (!dataInicio && !dataFim) { alert('Selecione ao menos a Data Início.'); return; }
              printAgendaReport(agenda, { statusFiltro: filterStatus, dataInicio: dataInicio||null, dataFim: dataFim||null });
            }}
            className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-xs font-bold text-gray-900 uppercase flex items-center gap-2"
          ><Printer size={14}/> Imprimir Período</button>
          <button
            onClick={()=>{
              if (!dataInicio && !dataFim) { alert('Selecione ao menos a Data Início.'); return; }
              printAgendaReport(agenda, { statusFiltro: 'ALL', dataInicio: dataInicio||null, dataFim: dataFim||null });
            }}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white uppercase flex items-center gap-2"
            title="Relatório completo de todas as OCs (Programadas, Entregues, Pendentes e Vencidas) no período"
          ><FileBarChart size={14}/> Geral do Período</button>
          {(dataInicio || dataFim) && (
            <button onClick={()=>{ setDataInicio(''); setDataFim(''); }} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase flex items-center gap-1"><X size={12}/> Limpar</button>
          )}
          <span className="text-[10px] text-gray-500 ml-auto">Preencha apenas a Data Início para gerar relatório "deste dia em diante". Geral inclui todos os status.</span>
        </div>



        {/* Calendar grid */}
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square bg-gray-950/30 rounded-md"/>;
            const key = d.toISOString().slice(0,10);
            const today = new Date(); today.setHours(0,0,0,0);
            const isToday = d.getTime() === today.getTime();
            const dayItems = itemsByDay[key] || [];
            return (
              <div key={i} className={`aspect-square min-h-[68px] rounded-md p-1 border ${isToday?'border-yellow-500 bg-yellow-500/5':'border-gray-800 bg-gray-950/50'} flex flex-col gap-0.5 overflow-hidden`}>
                <div className={`text-[10px] font-bold ${isToday?'text-yellow-400':'text-gray-400'}`}>{d.getDate()}</div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayItems.slice(0,3).map(it => (
                    <button key={it.id} onClick={()=>openEdit(it)} className={`text-[9px] truncate text-left px-1 py-0.5 rounded border ${AGENDA_STATUS[it._status].cls}`} title={it.titulo}>
                      {it.numero_oc?`#${it.numero_oc} `:''}{it.titulo}
                    </button>
                  ))}
                  {dayItems.length > 3 && <span className="text-[9px] text-gray-500">+{dayItems.length-3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista detalhada */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <h3 className="text-sm font-black text-white uppercase tracking-tight mb-3 flex items-center gap-2"><ListTodo size={16} className="text-yellow-500"/> Próximas OCs {filterStatus!=='ALL' && <span className="text-[10px] text-gray-500 normal-case font-normal">(filtrado: {AGENDA_STATUS[filterStatus].label})</span>}</h3>
        {upcoming.length === 0 ? <p className="text-xs text-gray-500 text-center py-8">Nenhuma OC na agenda. Clique em "Nova OC" para começar.</p> : (
          <div className="space-y-2">
            {upcoming.map(it => (
              <div key={it.id} className="w-full bg-gray-950/50 hover:bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-lg p-3 flex items-start gap-3 transition">
                <div className={`w-1 self-stretch rounded-full ${AGENDA_STATUS[it._status].dot}`}/>
                <button onClick={()=>openEdit(it)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white truncate">{it.titulo}</span>
                    {it.numero_oc && <span className="text-[10px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">OC #{it.numero_oc}</span>}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${AGENDA_STATUS[it._status].cls}`}>{AGENDA_STATUS[it._status].label}</span>
                    {it.anexo_oc_url && <span className="text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded flex items-center gap-1"><FileText size={9}/>OC</span>}
                    {it.nf_numero && <span className="text-[9px] font-bold bg-green-500/15 text-green-300 border border-green-500/40 px-1.5 py-0.5 rounded flex items-center gap-1"><FileText size={9}/>NF #{it.nf_numero}</span>}
                    {!it.nf_numero && it.nf_anexo_url && <span className="text-[9px] font-bold bg-green-500/15 text-green-300 border border-green-500/40 px-1.5 py-0.5 rounded flex items-center gap-1"><FileText size={9}/>NF</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><CalendarDays size={11}/> {it.data_programada ? formatBRDate(it.data_programada) : 'Sem data'}</span>
                    {it.fornecedor && <span className="flex items-center gap-1"><Truck size={11}/> {it.fornecedor}</span>}
                    {it.vendedor && <span className="flex items-center gap-1"><User size={11}/> {it.vendedor}</span>}
                    {it.telefone_fornecedor && <span className="text-gray-300">📞 {it.telefone_fornecedor}</span>}
                    {it.valor && <span className="text-green-400 font-bold">R$ {Number(it.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  </div>
                  {it.notas && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{it.notas}</p>}
                </button>
                <div className="flex flex-col gap-1 shrink-0">
                  {it.anexo_oc_url && (
                    <>
                      <a href={it.anexo_oc_url} target="_blank" rel="noreferrer" title="Visualizar PDF" className="p-1.5 bg-gray-800 hover:bg-gray-700 text-blue-300 rounded"><Eye size={12}/></a>
                      <a href={it.anexo_oc_url} download={it.anexo_oc_name||`OC-${it.numero_oc||it.id}.pdf`} title="Baixar PDF" className="p-1.5 bg-gray-800 hover:bg-gray-700 text-green-300 rounded"><Download size={12}/></a>
                    </>
                  )}
                  {!isViewer && it._status !== 'PROGRAMADA' && it._status !== 'ENTREGUE' && (
                    <button onClick={()=>onSave({...it, status:'PROGRAMADA', updated_at: getLocalISOString()})} title="Marcar como Programada" className="p-1.5 bg-blue-900/30 hover:bg-blue-800/40 text-blue-300 rounded"><CalendarClock size={12}/></button>
                  )}
                  {!isViewer && it._status !== 'ENTREGUE' && (
                    <button onClick={()=>setReceiving(it)} title="Receber (anexar NF)" className="p-1.5 bg-green-900/30 hover:bg-green-800/40 text-green-300 rounded"><Check size={12}/></button>
                  )}
                  {it._status === 'ENTREGUE' && it.nf_anexo_url && (
                    <a href={it.nf_anexo_url} target="_blank" rel="noreferrer" title="Ver NF" className="p-1.5 bg-green-900/30 hover:bg-green-800/40 text-green-200 rounded"><FileText size={12}/></a>
                  )}
                  <button onClick={()=>openEdit(it)} title="Editar" className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"><Edit size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && <AgendaOCForm item={editing} onSave={onSave} onDelete={onDelete} onClose={()=>setShowForm(false)} isViewer={isViewer}/>}
      {receiving && <ReceberOCModal item={receiving} onSave={onSave} onClose={()=>setReceiving(null)}/>}
      {showConcluidasReport && <ConcluidasReportModal onClose={()=>setShowConcluidasReport(false)} onGenerate={(opts)=>printAgendaReport(agenda, opts)}/>}
    </div>
  );
};

// ============================================================================
// 18.5 BLOCO DE ANOTAÇÕES
// ============================================================================
const NOTE_COLORS = [
  { id: 'yellow', label: 'Amarelo', cls: 'bg-yellow-500/10 border-yellow-500/40', dot: 'bg-yellow-500' },
  { id: 'blue',   label: 'Azul',    cls: 'bg-blue-500/10 border-blue-500/40',     dot: 'bg-blue-500' },
  { id: 'green',  label: 'Verde',   cls: 'bg-green-500/10 border-green-500/40',   dot: 'bg-green-500' },
  { id: 'red',    label: 'Vermelho',cls: 'bg-red-500/10 border-red-500/40',       dot: 'bg-red-500' },
  { id: 'purple', label: 'Roxo',    cls: 'bg-purple-500/10 border-purple-500/40', dot: 'bg-purple-500' },
  { id: 'gray',   label: 'Cinza',   cls: 'bg-gray-700/30 border-gray-600',        dot: 'bg-gray-500' },
];
const noteColor = (id) => NOTE_COLORS.find(c=>c.id===id) || NOTE_COLORS[0];

// Imprime etiquetas em A4: 2 colunas × 3 linhas = 6 etiquetas/página.
// Cada etiqueta tem o MESMO tamanho independente da quantidade
// (uma etiqueta sozinha ocupa exatamente o espaço de 1 das 6).
const printAnotacoes = (notas) => {
  const w = window.open('', '', 'height=900,width=900');
  if (!w) return;
  const ordered = [...(notas||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0) || (b.updated_at||'').localeCompare(a.updated_at||''));
  const colorMap = { yellow:'#fde68a', blue:'#bfdbfe', green:'#bbf7d0', red:'#fecaca', purple:'#e9d5ff', gray:'#e5e7eb' };
  const borderMap = { yellow:'#ca8a04', blue:'#2563eb', green:'#16a34a', red:'#dc2626', purple:'#9333ea', gray:'#6b7280' };
  // A4 útil: 210×297mm com margens de 10mm → 190×277mm.
  // Grade 2×3 com gaps de 4mm: largura = (190-4)/2 = 93mm; altura = (277-8)/3 ≈ 89.6mm.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas — Anotações</title>
  <style>
    @page { size: A4; margin: 10mm; }
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{margin:0;color:#111;background:#fff}
    .sheet{display:grid;grid-template-columns:repeat(2,93mm);grid-auto-rows:89.6mm;gap:4mm;align-content:start;justify-content:start;page-break-after:always}
    .sheet:last-child{page-break-after:auto}
    .lbl{width:93mm;height:89.6mm;border:1.2mm solid #555;border-radius:3mm;padding:5mm;display:flex;flex-direction:column;gap:2mm;overflow:hidden;page-break-inside:avoid}
    .lbl h3{margin:0;font-size:14pt;font-weight:900;text-transform:uppercase;letter-spacing:.3pt;line-height:1.15;border-bottom:.4mm solid rgba(0,0,0,.25);padding-bottom:2mm;word-break:break-word}
    .lbl .body{font-size:10.5pt;line-height:1.35;white-space:pre-wrap;flex:1;overflow:hidden;color:#1f2937;word-break:break-word}
    .lbl .ft{font-size:8pt;color:#374151;display:flex;justify-content:space-between;border-top:.3mm solid rgba(0,0,0,.2);padding-top:1.5mm;margin-top:auto}
    .pin{display:inline-block;background:#111;color:#fff;font-size:7.5pt;padding:.5mm 2mm;border-radius:2mm;margin-left:2mm;font-weight:bold;text-transform:uppercase;vertical-align:middle}
    @media screen { body{padding:10mm;background:#e5e7eb} .sheet{background:#fff;padding:10mm;box-shadow:0 0 6px rgba(0,0,0,.2);margin-bottom:10mm} }
  </style></head><body>
  ${ordered.length===0
    ? '<div style="padding:30mm;text-align:center;color:#666">Sem anotações para imprimir.</div>'
    : (() => {
        const pages = [];
        for (let i = 0; i < ordered.length; i += 6) pages.push(ordered.slice(i, i+6));
        return pages.map(group => `<section class="sheet">${group.map(n => {
          const bg = colorMap[n.cor]||colorMap.yellow;
          const bd = borderMap[n.cor]||borderMap.yellow;
          const when = n.updated_at ? new Date(n.updated_at).toLocaleDateString('pt-BR') : '';
          return `<article class="lbl" style="background:${bg};border-color:${bd}">
            <h3>${(n.titulo||'(sem título)').replace(/</g,'&lt;')}${n.pinned?'<span class="pin">★</span>':''}</h3>
            <div class="body">${(n.conteudo||'').replace(/</g,'&lt;')}</div>
            <div class="ft"><span>${SYSTEM_NAME}</span><span>${when}</span></div>
          </article>`;
        }).join('')}</section>`).join('');
      })()
  }
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
  </body></html>`;
  w.document.write(html); w.document.close(); w.focus();
};

const KANBAN_COLUMNS = [
  { id: 'IDEIAS',  label: 'Ideias',   cls: 'border-purple-500/40 bg-purple-500/5', dot: 'bg-purple-500' },
  { id: 'FAZER',   label: 'A Fazer',  cls: 'border-yellow-500/40 bg-yellow-500/5', dot: 'bg-yellow-500' },
  { id: 'FAZENDO', label: 'Fazendo',  cls: 'border-blue-500/40 bg-blue-500/5',     dot: 'bg-blue-500' },
  { id: 'FEITO',   label: 'Feito',    cls: 'border-green-500/40 bg-green-500/5',   dot: 'bg-green-500' },
];
const kanbanIndex = (id) => Math.max(0, KANBAN_COLUMNS.findIndex(c => c.id === id));

const AnotacoesView = ({ anotacoes, onSave, onDelete, isViewer }) => {
  const [editing, setEditing] = useState(null);
  const [busca, setBusca] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'lista'
  const [lightbox, setLightbox] = useState(null);

  const openNew = (kanban_status='IDEIAS') => setEditing({ id: 'NOTA-'+Date.now(), titulo:'', conteudo:'', cor:'yellow', pinned:false, kanban_status, fotos:[], updated_at: new Date().toISOString() });
  const openEdit = (n) => setEditing({ ...n, kanban_status: n.kanban_status||'IDEIAS', fotos: Array.isArray(n.fotos)?n.fotos:[] });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.titulo?.trim() && !editing.conteudo?.trim() && !(editing.fotos||[]).length) { setEditing(null); return; }
    const payload = { ...editing, updated_at: new Date().toISOString() };
    await onSave(payload);
    setEditing(null);
  };

  const togglePin = async (n) => { await onSave({ ...n, pinned: !n.pinned, updated_at: new Date().toISOString() }); };
  const moveNote = async (n, dir) => {
    const i = kanbanIndex(n.kanban_status||'IDEIAS');
    const next = Math.min(KANBAN_COLUMNS.length-1, Math.max(0, i+dir));
    if (next === i) return;
    await onSave({ ...n, kanban_status: KANBAN_COLUMNS[next].id, updated_at: new Date().toISOString() });
  };

  const addFotos = async (files) => {
    if (!editing) return;
    const arr = Array.from(files||[]);
    const ok = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 4 * 1024 * 1024) { alert(`"${f.name}" excede 4MB.`); continue; }
      const url = await new Promise((res, rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
      ok.push({ url, name: f.name });
    }
    if (ok.length) setEditing(e => ({ ...e, fotos: [...(e.fotos||[]), ...ok] }));
  };
  const removeFoto = (idx) => setEditing(e => ({ ...e, fotos: (e.fotos||[]).filter((_,i)=>i!==idx) }));

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let arr = anotacoes||[];
    if (q) arr = arr.filter(n => (n.titulo||'').toLowerCase().includes(q) || (n.conteudo||'').toLowerCase().includes(q));
    return [...arr].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0) || (b.updated_at||'').localeCompare(a.updated_at||''));
  }, [anotacoes, busca]);

  const pinned = filtered.filter(n => n.pinned);
  const others = filtered.filter(n => !n.pinned);

  const renderCard = (n, opts={}) => {
    const c = noteColor(n.cor);
    const fotos = Array.isArray(n.fotos) ? n.fotos : [];
    const colIdx = kanbanIndex(n.kanban_status||'IDEIAS');
    return (
      <div key={n.id} className={`rounded-xl border ${c.cls} p-3 flex flex-col gap-2 group`}>
        <div className="flex items-start justify-between gap-2">
          <button onClick={()=>openEdit(n)} className="flex-1 text-left">
            <h4 className="font-black text-white text-sm uppercase tracking-tight line-clamp-2">{n.titulo||'(sem título)'}</h4>
          </button>
          <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition">
            <button onClick={()=>printAnotacoes([n])} title="Imprimir etiqueta" className="p-1 rounded text-gray-400 hover:text-white"><Printer size={12}/></button>
            <button onClick={()=>togglePin(n)} disabled={isViewer} title={n.pinned?'Desafixar':'Fixar'} className={`p-1 rounded ${n.pinned?'text-yellow-400':'text-gray-500 hover:text-white'}`}><Tag size={12}/></button>
            <button onClick={()=>onDelete(n.id)} disabled={isViewer} title="Excluir" className="p-1 rounded text-gray-500 hover:text-red-400"><Trash2 size={12}/></button>
          </div>
        </div>
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {fotos.slice(0,3).map((f,i) => (
              <button key={i} onClick={()=>setLightbox(f)} className="aspect-square rounded overflow-hidden border border-white/10 bg-black/30">
                <img src={f.url} alt={f.name||'foto'} className="w-full h-full object-cover"/>
              </button>
            ))}
            {fotos.length > 3 && <div className="aspect-square rounded bg-black/40 text-[10px] text-gray-300 flex items-center justify-center font-bold">+{fotos.length-3}</div>}
          </div>
        )}
        <button onClick={()=>openEdit(n)} className="text-left">
          <p className="text-xs text-gray-300 whitespace-pre-wrap line-clamp-5">{n.conteudo||'—'}</p>
        </button>
        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-white/5 gap-2">
          <span className="flex items-center gap-1 truncate"><span className={`w-2 h-2 rounded-full ${c.dot}`}></span>{c.label}{fotos.length>0 && <span className="ml-2 flex items-center gap-1"><ImageIcon size={10}/>{fotos.length}</span>}{n.lembrete_at && <span className={`ml-2 flex items-center gap-1 ${n.lembrete_notificado?'text-gray-500':'text-yellow-400'}`}><Bell size={10}/>{new Date(n.lembrete_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}</span>
          <span>{n.updated_at ? new Date(n.updated_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}</span>
        </div>
        {opts.showMove && !isViewer && (
          <div className="flex items-center gap-1 pt-1">
            <button onClick={()=>moveNote(n,-1)} disabled={colIdx===0} className="flex-1 px-1 py-1 bg-gray-800/70 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-200 flex items-center justify-center gap-1"><ChevronLeft size={10}/></button>
            <button onClick={()=>moveNote(n,1)} disabled={colIdx===KANBAN_COLUMNS.length-1} className="flex-1 px-1 py-1 bg-gray-800/70 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-200 flex items-center justify-center gap-1"><ChevronRight size={10}/></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar anotação..." className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 outline-none"/>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="inline-flex rounded-lg border border-gray-800 overflow-hidden">
            <button onClick={()=>setViewMode('kanban')} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${viewMode==='kanban'?'bg-yellow-500 text-gray-900':'bg-gray-800 text-gray-300'}`}><LayoutDashboard size={12}/> Kanban</button>
            <button onClick={()=>setViewMode('lista')} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${viewMode==='lista'?'bg-yellow-500 text-gray-900':'bg-gray-800 text-gray-300'}`}><ListTodo size={12}/> Lista</button>
          </div>
          <span className="px-3 py-2 bg-gray-800/50 rounded-lg text-xs text-gray-400 flex items-center gap-2"><MessageSquare size={12}/> {filtered.length} {filtered.length===1?'anotação':'anotações'}</span>
          <button onClick={()=>printAnotacoes(filtered)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 uppercase flex items-center gap-2" title="6 etiquetas por folha A4"><Printer size={14}/> Etiquetas</button>
          <button onClick={()=>openNew()} disabled={isViewer} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 font-black rounded-lg text-xs uppercase tracking-wider flex items-center gap-2"><Plus size={14}/> Nova</button>
        </div>
      </div>

      {filtered.length===0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <MessageSquare size={36} className="text-gray-700 mx-auto mb-3"/>
          <p className="text-sm text-gray-500">Nenhuma anotação. Clique em "Nova" para começar.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {KANBAN_COLUMNS.map(col => {
            const colNotes = filtered.filter(n => (n.kanban_status||'IDEIAS') === col.id);
            return (
              <div key={col.id} className={`rounded-2xl border ${col.cls} p-3 flex flex-col gap-3 min-h-[200px]`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${col.dot}`}/>{col.label} <span className="text-gray-400 font-bold">({colNotes.length})</span></h3>
                  <button onClick={()=>openNew(col.id)} disabled={isViewer} title="Adicionar nesta coluna" className="p-1 rounded bg-black/30 hover:bg-black/60 text-gray-200 disabled:opacity-30"><Plus size={12}/></button>
                </div>
                <div className="space-y-2">
                  {colNotes.length === 0 ? <p className="text-[10px] text-gray-500 text-center py-4">Vazio</p> : colNotes.map(n => renderCard(n, { showMove: true }))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {pinned.length > 0 && (
            <section>
              <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Tag size={12}/> Fixadas ({pinned.length})</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{pinned.map(n=>renderCard(n))}</div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              {pinned.length > 0 && <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare size={12}/> Outras ({others.length})</h3>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{others.map(n=>renderCard(n))}</div>
            </section>
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={()=>setLightbox(null)}>
          <button onClick={()=>setLightbox(null)} className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full"><X size={18}/></button>
          <img src={lightbox.url} alt={lightbox.name||'foto'} className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl" onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setEditing(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-xl space-y-3 max-h-[92vh] overflow-y-auto custom-scrollbar" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><MessageSquare size={18} className="text-yellow-500"/>{anotacoes.some(n=>n.id===editing.id)?'Editar Anotação':'Nova Anotação'}</h3>
              <button onClick={()=>setEditing(null)} className="text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <input value={editing.titulo||''} onChange={e=>setEditing({...editing, titulo:e.target.value})} placeholder="Título" disabled={isViewer} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 outline-none font-bold"/>
            <textarea value={editing.conteudo||''} onChange={e=>setEditing({...editing, conteudo:e.target.value})} placeholder="Escreva sua anotação..." rows={6} disabled={isViewer} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 outline-none resize-y"/>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Bell size={12}/> Lembrete (notificação)</label>
              <div className="mt-1 flex gap-2 items-center">
                <input type="datetime-local" value={editing.lembrete_at||''} onChange={e=>setEditing({...editing, lembrete_at: e.target.value, lembrete_notificado: false})} disabled={isViewer} className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-500 outline-none"/>
                {editing.lembrete_at && !isViewer && (
                  <button type="button" onClick={()=>setEditing({...editing, lembrete_at:'', lembrete_notificado:false})} className="px-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[10px] font-bold uppercase">Limpar</button>
                )}
              </div>
              <p className="text-[9px] text-gray-600 mt-1">Você receberá uma notificação na barra do sistema na data/hora escolhida (mantenha o app aberto ou instalado como PWA).</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Coluna do Kanban</label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {KANBAN_COLUMNS.map(c => (
                  <button key={c.id} type="button" onClick={()=>setEditing({...editing, kanban_status:c.id})} className={`px-2 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${(editing.kanban_status||'IDEIAS')===c.id ? 'bg-yellow-500 text-gray-900 border-yellow-500' : 'bg-gray-950 text-gray-300 border-gray-800 hover:border-gray-600'}`}>{c.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><ImageIcon size={12}/> Fotos / Anexos ({(editing.fotos||[]).length})</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(editing.fotos||[]).map((f,i)=>(
                  <div key={i} className="relative w-20 h-20 rounded border border-gray-700 overflow-hidden group">
                    <img src={f.url} alt={f.name||'foto'} className="w-full h-full object-cover cursor-pointer" onClick={()=>setLightbox(f)}/>
                    {!isViewer && <button type="button" onClick={()=>removeFoto(i)} className="absolute top-0.5 right-0.5 p-0.5 bg-red-600/90 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100"><X size={10}/></button>}
                  </div>
                ))}
                {!isViewer && (
                  <label className="w-20 h-20 rounded border-2 border-dashed border-gray-700 hover:border-yellow-500 text-gray-500 hover:text-yellow-500 flex flex-col items-center justify-center cursor-pointer text-[10px] gap-1">
                    <Camera size={16}/>
                    Adicionar
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{addFotos(e.target.files); e.target.value='';}}/>
                  </label>
                )}
              </div>
              <p className="text-[9px] text-gray-600 mt-1">Imagens até 4MB cada. Clique numa foto para ampliar.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map(c => (
                  <button key={c.id} type="button" onClick={()=>setEditing({...editing, cor:c.id})} title={c.label} className={`w-6 h-6 rounded-full ${c.dot} ${editing.cor===c.id?'ring-2 ring-white ring-offset-2 ring-offset-gray-900':''}`}/>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={!!editing.pinned} onChange={e=>setEditing({...editing, pinned:e.target.checked})} disabled={isViewer} className="accent-yellow-500"/>
                Fixar no topo
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold uppercase">Cancelar</button>
              <button onClick={handleSave} disabled={isViewer} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 rounded-lg text-xs font-black uppercase flex items-center gap-2"><Save size={14}/> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



// ============================================================================
// 19. COMPONENTE PRINCIPAL APP
// ============================================================================



export default function App() {
  const [user, setUser] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [isLoading, setIsLoading] = useState(true);
  const [dbData, setDbData] = useState({ produtos: [], ferramentas: [], emprestimos: [], movimentacoes_estoque: [], requisicoes: [], locacoes: [], desperdicios: [], agenda_oc: [], anotacoes: [], cronograma_atividades: [] });

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [dialogContext, setDialogContext] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const hasLoadedDataRef = useRef(false);

  const showMsg = useCallback((title, message, isConfirm = false) => {
      return new Promise((resolve) => { setDialogContext({ title, message, isConfirm, resolve }); });
  }, []);

  const loadInitialData = useCallback(async () => {
    // Não bloqueia a UI: cada coleção carrega em paralelo e atualiza seu próprio slice.
    setIsLoading(false);
    const cols = ['produtos','ferramentas','emprestimos','movimentacoes_estoque','requisicoes','locacoes','desperdicios','agenda_oc','anotacoes','cronograma_atividades'];
    await Promise.all(cols.map(async (col) => {
      try {
        const rows = await AppDB.getAll(col);
        setDbData(prev => ({ ...prev, [col]: rows || [] }));
      } catch (err) { console.error(`Load ${col}`, err); }
    }));
    hasLoadedDataRef.current = true;
  }, []);

  // Auth: sessão persistente via Supabase + realtime entre dispositivos
  useEffect(() => {
    const mapUser = (sess) => {
      if (!sess?.user) return null;
      const u = sess.user;
      // Somente app_metadata pode conceder admin (não pode ser alterado pelo usuário).
      const appRole = u.app_metadata?.role;
      const umRole = u.user_metadata?.role;
      const role = appRole === 'admin' ? 'admin' : (umRole === 'admin' ? 'viewer' : (umRole || 'viewer'));
      return { name: u.user_metadata?.name || u.email, role, email: u.email };
    };
    supabase.auth.getSession().then(({ data }) => { setUser(mapUser(data.session)); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => setUser(mapUser(sess)));
    return () => subscription.unsubscribe();
  }, []);

  // Usuário efetivo: prioriza login real; senão, modo visitante (somente Borderô)
  const effectiveUser = user || (guestMode ? { name: 'Visitante', role: 'guest', email: 'guest' } : null);
  const isGuest = effectiveUser?.role === 'guest';

  useEffect(() => {
    if (user && !isGuest) loadInitialData();
    else if (isGuest) { setIsLoading(false); setActiveTab('BODEROS'); }
  }, [user, isGuest, loadInitialData]);

  // Realtime: só atualiza a tela quando NÃO há formulário aberto.
  // Enquanto houver, marca pending=true e dispara o flush ao fechar o último modal.
  useEffect(() => {
    if (!user || isGuest) return;
    const unsub = subscribeRealtime(() => {
      if (REALTIME_GUARD.suspended > 0) {
        REALTIME_GUARD.pending = true;
        return;
      }
      loadInitialData();
    });
    const onFlush = () => loadInitialData();
    window.addEventListener('almox-realtime-flush', onFlush);
    return () => { unsub(); window.removeEventListener('almox-realtime-flush', onFlush); };
  }, [user, isGuest, loadInitialData]);

  useEffect(() => { document.title = SYSTEM_NAME; }, []);

  // ============= Notificações nativas =============
  const [notifPerm, setNotifPerm] = useState(notificationPermission());
  const activateNotifications = useCallback(async () => {
    const p = await ensureNotificationPermission();
    setNotifPerm(p);
    if (p === 'granted') {
      showAppNotification({ title: 'Notificações ativadas', body: 'Você receberá lembretes de OC vencidas e anotações agendadas.', tag: 'welcome-'+Date.now() });
    }
  }, []);

  // Loop: verifica OCs vencidas e lembretes de anotações a cada 60s (e imediatamente ao carregar dados)
  useEffect(() => {
    if (!user || isGuest) return;
    if (notifPerm !== 'granted') return;

    const check = async () => {
      // 1) OCs vencidas — dedupe por dia (tag inclui data ISO curta)
      const hojeIso = new Date().toISOString().slice(0,10);
      for (const item of dbData.agenda_oc || []) {
        try {
          const st = computeAgendaStatus(item);
          if (st !== 'VENCIDA') continue;
          const tag = `oc-vencida-${item.id}-${hojeIso}`;
          if (wasNotified(tag)) continue;
          await showAppNotification({
            tag,
            title: '⚠️ OC Vencida',
            body: `${item.numero_oc || 'OC'} — ${item.fornecedor || 'fornecedor'} venceu em ${item.data_programada || 's/data'}.`,
            requireInteraction: true,
          });
        } catch (e) { console.warn(e); }
      }
      // 2) Anotações com lembrete_at atingido
      const agora = new Date();
      for (const nota of dbData.anotacoes || []) {
        if (!nota.lembrete_at || nota.lembrete_notificado) continue;
        const t = new Date(nota.lembrete_at);
        if (isNaN(t.getTime()) || t > agora) continue;
        const tag = `nota-lembrete-${nota.id}`;
        if (wasNotified(tag)) continue;
        const ok = await showAppNotification({
          tag,
          title: `🔔 ${nota.titulo || 'Lembrete'}`,
          body: (nota.conteudo || '').slice(0, 180) || 'Lembrete de anotação.',
          requireInteraction: true,
        });
        if (ok) {
          try { await AppDB.put('anotacoes', { ...nota, lembrete_notificado: true }); } catch (e) { console.warn(e); }
        }
      }
    };

    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [user, isGuest, notifPerm, dbData.agenda_oc, dbData.anotacoes]);


  const handleLogin = () => { /* state set via onAuthStateChange */ };
  const handleGuest = () => { setGuestMode(true); setActiveTab('BODEROS'); };
  const handleLogout = async () => {
    if (isGuest) { setGuestMode(false); return; }
    if(await showMsg("Sair", "Terminar a sessão atual?", true)) { await supabase.auth.signOut(); }
  };

  // Handlers Universal Puts — qualquer bloqueio do Modo Visualização vira aviso amigável.
  const handleWriteError = (err) => {
    if (err?.code === 'VIEWER_BLOCKED') {
      showMsg('Modo Visualização', 'Este usuário só pode visualizar e imprimir. Edições, exclusões e cadastros estão bloqueados.');
      return true;
    }
    return false;
  };
  const genericSave = async (col, data) => {
    try { await AppDB.put(col, data); await loadInitialData(); }
    catch (e) { if (!handleWriteError(e)) { console.error(e); showMsg('Erro', e?.message || 'Falha ao salvar.'); } }
  };
  const genericDelete = async (col, id) => {
    try { await AppDB.delete(col, id); await loadInitialData(); }
    catch (e) { if (!handleWriteError(e)) { console.error(e); showMsg('Erro', e?.message || 'Falha ao excluir.'); } }
  };

  const handleSaveProduto = async ({produto, movimentacao}) => {
      try {
        await AppDB.put('produtos', produto);
        if (movimentacao) await AppDB.put('movimentacoes_estoque', movimentacao);
        await loadInitialData();
      } catch (e) { if (!handleWriteError(e)) { console.error(e); showMsg('Erro', e?.message || 'Falha ao salvar produto.'); } }
  };


  const handleXmlImport = async ({ selectedProducts, fornecedor, numeroNF }) => {
    let novos = 0, entradas = 0;
    for (const prod of selectedProducts) {
      if(!prod.descricao) continue;
      const qtd = Number(prod.qtd) || 0;
      const kb = classifyMaterialPBQPH(prod.descricao);
      const categoria = prod.categoria || kb.categoria;
      const categoriaFvm = prod.categoria_fvm || kb.categoria_fvm;
      const dnaType = prod.dna_type || resolveMaterialDNAType(prod, kb);
      if (prod.linkedSkuId && prod.linkedSkuId !== 'NEW') {
        // Vincula a SKU existente: apenas entrada + atualiza saldo (e reforça classificação se faltar)
        const existente = dbData.produtos.find(p => p.id === prod.linkedSkuId);
        if (!existente) continue;
        const atualizado = {
          ...existente,
          saldo_atual: (Number(existente.saldo_atual) || 0) + qtd,
          preco_unitario: prod.valorUnitario || existente.preco_unitario,
          lote: prod.lote || existente.lote,
          validade: prod.validade || existente.validade,
          fornecedor_nf: `${fornecedor} - NF ${numeroNF}`,
          categoria: existente.categoria || categoria,
          categoria_fvm: existente.categoria_fvm || categoriaFvm,
          local_armazenamento: prod.local_armazenamento || existente.local_armazenamento,
          aplicacao: prod.aplicacao || existente.aplicacao,
          empreiteira: prod.empreiteira || existente.empreiteira,
          rastreavel: existente.rastreavel ?? prod.rastreavel ?? kb.rastreavel,
          classe_pbqph: existente.classe_pbqph || prod.classe_pbqph || kb.classe,
          exige_certificado: existente.exige_certificado ?? prod.exige_certificado ?? kb.exigeCertificado,
          exige_fvm: existente.exige_fvm ?? prod.exige_fvm ?? kb.exigeFVM,
          exige_lote: existente.exige_lote ?? prod.exige_lote ?? kb.exigeLote,
          exige_fabricante: existente.exige_fabricante ?? prod.exige_fabricante ?? kb.exigeFabricante,
          dna_type: existente.dna_type || dnaType,
          dna_payload: { ...(existente.dna_payload || {}), ...(prod.dna_payload || {}) },
        };
        await AppDB.put('produtos', atualizado);
        await AppDB.put('movimentacoes_estoque', { id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'ENTRADA', sku: existente.id, qtd, origem: `NF-e ${numeroNF}`, destino: atualizado.local_armazenamento || AREAS_ESTOCAGEM[0], obs: `Entrada via XML (vinculado SKU ${existente.sku}) - Lote ${prod.lote||'-'} - ${fornecedor}` });
        entradas++;
      } else {
        // Novo cadastro com classificação PBQP-H automática
        const novoProduto = {
          id: `PROD-${generateId()}`,
          sku: prod.codigo || `SKU-${generateId()}`,
          nome: prod.descricao,
          categoria,
          categoria_fvm: categoriaFvm,
          classe_pbqph: prod.classe_pbqph || kb.classe,
          unidade: (prod.unidade || kb.unidade || 'UN').toUpperCase(),
          saldo_atual: qtd,
          qtd_inicial: qtd,
          estoque_minimo: prod.estoque_minimo || 5,
          local_armazenamento: prod.local_armazenamento || AREAS_ESTOCAGEM[0],
          aplicacao: prod.aplicacao || '',
          empreiteira: prod.empreiteira || '',
          fornecedor_nf: prod.fornecedor_nf || `${fornecedor} - NF ${numeroNF}`,
          ordem_compra: prod.ordemCompra || '',
          preco_unitario: prod.valorUnitario,
          ativo: true,
          rastreavel: prod.rastreavel ?? kb.rastreavel,
          exige_certificado: prod.exige_certificado ?? kb.exigeCertificado,
          exige_fvm: prod.exige_fvm ?? kb.exigeFVM,
          exige_lote: prod.exige_lote ?? kb.exigeLote,
          exige_fabricante: prod.exige_fabricante ?? kb.exigeFabricante,
          lote: prod.lote || '',
          validade: prod.validade || '',
          dna_type: dnaType,
          dna_payload: prod.dna_payload || {},
          dna: { fabricante: prod.fabricante || fornecedor, marca: prod.fabricante || fornecedor, norma: prod.norma || 'ABNT', certificado: prod.certificado || '', pbqph: prod.rastreavel ?? kb.rastreavel, iso9001: prod.rastreavel ?? kb.rastreavel }
        };
        await AppDB.put('produtos', novoProduto);
        await AppDB.put('movimentacoes_estoque', { id: `MOV-${generateId()}`, data: getLocalISOString(), tipo: 'ENTRADA', sku: novoProduto.id, qtd, origem: `NF-e ${numeroNF}`, destino: novoProduto.local_armazenamento, obs: `Cadastro via XML Nativo [${novoProduto.classe_pbqph}] - ${fornecedor}` });
        novos++;
      }
    }
    await loadInitialData();
    if(novos+entradas>0) showMsg("Sucesso", `${novos} novo(s) item(ns) cadastrado(s) e ${entradas} entrada(s) atualizada(s). Classificação PBQP-H aplicada automaticamente — revise antes de imprimir a FVM.`);
  };



  const handlePrintMovimentacoes = (movs) => {
    const dataForPrint = movs.map(m => {
        const p = dbData.produtos.find(x => x.id === m.sku || x.sku === m.sku);
        return {
            data_fmt: formatBRDate(m.data), tipo: m.tipo, produto: p?.nome || m.sku,
            empreiteira: p?.empreiteira || '-', qtd: m.qtd, origem_destino: m.tipo === 'ENTRADA' ? m.origem : m.destino, obs: m.obs || '-'
        };
    });
    generatePDF('Relatório de Movimentações de Estoque', [
        {header: 'Data', dataKey: 'data_fmt'}, {header: 'Tipo', dataKey: 'tipo'}, {header: 'Produto', dataKey: 'produto'},
        {header: 'Empreiteira', dataKey: 'empreiteira'}, {header: 'Qtd', dataKey: 'qtd'}, {header: 'Origem/Destino', dataKey: 'origem_destino'},
        {header: 'Obs', dataKey: 'obs'}
    ], dataForPrint, showMsg);
  };

  if (!authReady) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-yellow-500 animate-spin"/></div>;
  if (!effectiveUser) return <LoginScreen onLogin={handleLogin} onGuest={handleGuest} />;

  if (isLoading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="relative mb-6"><div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div><Database className="w-6 h-6 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"/></div>
      <p className="text-gray-400 font-mono text-xs uppercase tracking-widest animate-pulse">Sincronizando dados do almoxarifado...</p>
    </div>
  );

  const tabs = [
    { id: 'DASHBOARD', label: 'Painel', icon: LayoutDashboard },
    { id: 'ESTOQUE', label: 'Estoque Central', icon: Package },
    { id: 'MOVIMENTACOES', label: 'Auditoria Mov.', icon: ArrowRightLeft },
    { id: 'DESPERDICIOS', label: 'Perdas & Desperdícios', icon: AlertOctagon },
    { id: 'REQUISICOES', label: 'Requisições', icon: FileText },
    { id: 'LOCACOES', label: 'Maquinário Ext.', icon: Building2 },
    { id: 'FERRAMENTAS', label: 'Almoxarifado', icon: Wrench },
    { id: 'INSUMOS', label: 'Rastreabilidade', icon: ClipboardCheck },
    { id: 'AGENDA', label: 'Agenda de OC', icon: CalendarDays },
    { id: 'NOTAS', label: 'Bloco de Anotações', icon: MessageSquare },
    { id: 'BODEROS', label: 'Arquivos Boderô', icon: Folder },
    { id: 'OBRAS', label: 'Cadastrar Obras', icon: Building2, adminOnly: true },
    { id: 'BACKUP', label: 'DB / Export', icon: Cloud }


  ];

  const isAdminUser = effectiveUser.role === 'admin';
  const adminTabs = isGuest
    ? tabs.filter(t => t.id === 'BODEROS')
    : tabs.filter(t => !t.adminOnly || isAdminUser);
  const isViewerMode = effectiveUser.role === 'viewer' || isGuest;


  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-gray-950 text-gray-100 flex overflow-hidden ${isViewerMode ? 'viewer-mode' : ''}`}>
        {isViewerMode && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-blue-600 text-white text-center text-[11px] font-bold uppercase tracking-widest py-1 shadow-lg">
            <Eye className="inline w-3 h-3 mr-1 -mt-0.5"/> {isGuest ? 'Modo Visitante — somente Borderô (leitura)' : 'Modo Visualização — somente leitura e impressão'}
          </div>
        )}
        {dialogContext && <DialogModal {...dialogContext} onConfirm={() => { dialogContext.resolve(true); setDialogContext(null); }} onCancel={() => { dialogContext.resolve(false); setDialogContext(null); }} />}
        
        {/* Sidebar Edge/Mobile */}
        <div className={`fixed inset-0 bg-black/80 z-40 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
        <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-950 border-r border-gray-800 z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static flex flex-col ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-gray-800 flex justify-center items-center h-20 bg-gray-900/50"><img src={LOGO_URL} onError={(e) => e.target.src = LOGO_FALLBACK} alt="Logo" className="h-10 object-contain filter brightness-0 invert" /></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 mt-2">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3 ml-3 mt-2">Módulos do Sistema</p>
            {adminTabs.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === t.id ? 'bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}>
                <t.icon size={18} className={activeTab === t.id ? 'text-gray-900' : 'opacity-70'}/> {t.label}
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-gray-800 bg-gray-900/30 space-y-2">
            {!isGuest && notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
              <button onClick={activateNotifications} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-lg text-[11px] font-black uppercase tracking-wider">
                <Bell size={13}/> {notifPerm === 'denied' ? 'Notificações bloqueadas' : 'Ativar Notificações'}
              </button>
            )}
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700"><User size={14} className="text-gray-400"/></div>
              <div className="flex-1 min-w-0"><p className="text-xs font-bold text-white truncate">{effectiveUser.name}</p><p className={`text-[10px] flex items-center gap-1 ${isViewerMode?'text-blue-400':'text-green-400'}`}><span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isViewerMode?'bg-blue-500':'bg-green-500'}`}></span> {isGuest?'Visitante':isViewerMode?'Visualização':'PWA Ativo'}</p></div>
              <button onClick={handleLogout} className="text-red-500 hover:text-red-400 p-1"><LogOut size={16}/></button>
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden bg-black/20">
          <header className="lg:hidden bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="text-yellow-500 p-1 bg-gray-800 rounded"><Menu size={24}/></button><span className="font-bold text-white text-lg tracking-tight">{SYSTEM_NAME}</span></div>
            <button onClick={() => { setActiveTab('ESTOQUE'); setIsXmlModalOpen(true); }} className="w-8 h-8 rounded bg-blue-900/30 text-blue-400 flex items-center justify-center border border-blue-800/50"><FileCode size={16}/></button>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32">
            <div className="max-w-[1400px] mx-auto">
              <div className="mb-6 hidden lg:block"><h1 className="text-3xl font-black text-white tracking-tighter uppercase">{adminTabs.find(t=>t.id===activeTab)?.label || 'Sistema'}</h1><div className="h-1 w-16 bg-yellow-500 mt-2 rounded"></div></div>
              
              {activeTab === 'DASHBOARD' && <DashboardView produtos={dbData.produtos} locacoes={dbData.locacoes} ferramentas={dbData.ferramentas} emprestimos={dbData.emprestimos} movimentacoes={dbData.movimentacoes_estoque} desperdicios={dbData.desperdicios} agenda={dbData.agenda_oc} cronograma={dbData.cronograma_atividades} onSaveCronograma={a=>genericSave('cronograma_atividades', a)} onDeleteCronograma={id=>genericDelete('cronograma_atividades', id)} setActiveTab={setActiveTab} isViewer={isViewerMode} showMsg={showMsg} />}
              {activeTab === 'ESTOQUE' && <EstoqueView produtos={dbData.produtos} movimentacoes={dbData.movimentacoes_estoque} onSave={handleSaveProduto} onDelete={id=>genericDelete('produtos', id)} onPrintLowStock={p=>printLowStockReport(p, 'ALL', showMsg)} onPrintLabel={(i,opts)=>printBulkLabels(i, showMsg, opts)} onImportXML={() => setIsXmlModalOpen(true)} showMsg={showMsg} />}
              {activeTab === 'MOVIMENTACOES' && <MovimentacoesView movimentacoes={dbData.movimentacoes_estoque} produtos={dbData.produtos} onSave={m=>genericSave('movimentacoes_estoque', m)} onPrint={handlePrintMovimentacoes} showMsg={showMsg} />}
              {activeTab === 'DESPERDICIOS' && <DesperdiciosView desperdicios={dbData.desperdicios} produtos={dbData.produtos} onSave={d=>genericSave('desperdicios', d)} showMsg={showMsg} />}
              {activeTab === 'REQUISICOES' && <RequisicoesView requisicoes={dbData.requisicoes} produtos={dbData.produtos} onSave={r=>genericSave('requisicoes', r)} onUpdate={r=>genericSave('requisicoes', r)} onDelete={id=>genericDelete('requisicoes', id)} showMsg={showMsg} />}
              {activeTab === 'LOCACOES' && <LocacoesView locacoes={dbData.locacoes} onSave={l=>genericSave('locacoes', l)} onDelete={id=>genericDelete('locacoes', id)} showMsg={showMsg}/>}
              {activeTab === 'FERRAMENTAS' && <FerramentasAlugadasView ferramentas={dbData.ferramentas} emprestimos={dbData.emprestimos} onSaveFerr={f=>genericSave('ferramentas', f)} onDeleteFerr={id=>genericDelete('ferramentas', id)} onSaveEmp={e=>genericSave('emprestimos', e)} onUpdateEmp={(id, st)=>genericSave('emprestimos', {...dbData.emprestimos.find(x=>x.id===id), status: st, data_devolucao: getLocalISOString()})} showMsg={showMsg}/>}
              {activeTab === 'INSUMOS' && <InsumosControladosView produtos={dbData.produtos} movimentacoes={dbData.movimentacoes_estoque} onPrintLabel={(i,opts)=>printBulkLabels(i, showMsg, opts)} showMsg={showMsg}/>}
              {activeTab === 'AGENDA' && <AgendaOCView agenda={dbData.agenda_oc} onSave={a=>genericSave('agenda_oc', a)} onDelete={id=>genericDelete('agenda_oc', id)} isViewer={isViewerMode}/>}
              {activeTab === 'NOTAS' && <AnotacoesView anotacoes={dbData.anotacoes} onSave={n=>genericSave('anotacoes', n)} onDelete={id=>genericDelete('anotacoes', id)} isViewer={isViewerMode}/>}
              {activeTab === 'BODEROS' && <Suspense fallback={<div className="text-gray-400 p-4">Carregando…</div>}><ArquivosBoderoView isViewer={isViewerMode} showMsg={showMsg} /></Suspense>}
              {activeTab === 'OBRAS' && isAdminUser && <Suspense fallback={<div className="text-gray-400 p-4">Carregando…</div>}><ObrasView showMsg={showMsg} /></Suspense>}
              {activeTab === 'BACKUP' && <BackupView produtos={dbData.produtos} movimentacoes={dbData.movimentacoes_estoque} requisicoes={dbData.requisicoes} locacoes={dbData.locacoes} ferramentas={dbData.ferramentas} emprestimos={dbData.emprestimos} desperdicios={dbData.desperdicios} showMsg={showMsg} />}


            </div>
          </div>
        </main>
      </div>
      
      <XMLImportModal isOpen={isXmlModalOpen} onClose={() => setIsXmlModalOpen(false)} onDataExtracted={handleXmlImport} showMsg={showMsg} produtosExistentes={dbData.produtos} />
    </ErrorBoundary>
  );
}