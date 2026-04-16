// --- 1. BANCOS DE DADOS ---
let transacoes = JSON.parse(localStorage.getItem('bancoDashboard')) || [];
let categorias = JSON.parse(localStorage.getItem('categoriasDashboard')) || [];
let coresCategorias = JSON.parse(localStorage.getItem('coresDashboardCores')) || { 'Geral': '#b2bec3' };

if (!categorias.includes('Geral')) {
    categorias.unshift('Geral');
    localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
}

// --- 0. GESTÃO DO TEMA CLARO/ESCURO ---
const temaSalvo = localStorage.getItem('temaDashboard');
if (temaSalvo === 'dark' || (!temaSalvo && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
}

function toggleTheme() {
    const body = document.body;
    const btnIcon = document.querySelector('#theme-toggle i');
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        btnIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('temaDashboard', 'dark');
    } else {
        btnIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('temaDashboard', 'light');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const btnIcon = document.querySelector('#theme-toggle i');
    if (document.body.classList.contains('dark-theme')) {
        btnIcon.classList.replace('fa-moon', 'fa-sun');
    }
});

let metaNome = localStorage.getItem('metaNome') || 'Meta do Período';
let metaFinanceira = parseFloat(localStorage.getItem('metaFinanceira')) || 0;
let meuGrafico = null;
let meuGraficoBarras = null;

// --- 2. CAPTURANDO ELEMENTOS ---
const form = document.getElementById('form-transacao');
const corpoTabela = document.getElementById('corpo-tabela');
const displayReceita = document.getElementById('total-receita');
const displayDespesa = document.getElementById('total-despesa');
const displayLucro = document.getElementById('lucro-liquido');

const filtroTipo = document.getElementById('filtro-tipo');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroDataInicio = document.getElementById('filtro-data-inicio');
const filtroDataFim = document.getElementById('filtro-data-fim');

// --- 3. INICIALIZAÇÃO E DATAS ---
function getDataHoje() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

document.getElementById('data').value = getDataHoje();

filtroTipo.addEventListener('change', atualizarTela);
filtroCategoria.addEventListener('change', atualizarTela);
filtroDataInicio.addEventListener('change', atualizarTela);
filtroDataFim.addEventListener('change', atualizarTela);

// --- FUNÇÃO MATEMÁTICA: CONTRASTE AUTOMÁTICO (YIQ) ---
function getCorTextoIdeal(hexColor) {
    if (!hexColor) return '#ffffff';
    hexColor = hexColor.replace('#', '');
    
    // Converte HEX para RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calcula a luminosidade (Fórmula YIQ de percepção humana)
    const luminosidade = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Retorna Preto Chumbo se o fundo for claro, e Branco se o fundo for escuro
    return (luminosidade > 128) ? '#2d3436' : '#ffffff';
}

// --- FUNÇÃO VISUAL: COLORE A CAIXA DE SELEÇÃO ---
function atualizarCorDaCaixaDeSelecao() {
    const select = document.getElementById('categoria');
    const cor = coresCategorias[select.value] || '#b2bec3';
    // Coloca uma borda grossa na esquerda com a cor da categoria
    select.style.borderLeft = `6px solid ${cor}`;
}
document.getElementById('categoria').addEventListener('change', atualizarCorDaCaixaDeSelecao);

// --- 4. GESTÃO DE METAS ---
function definirMeta() {
    const novoNome = prompt("Como se chama esta meta? (ex: Meta de Abril)", metaNome);
    if (novoNome === null) return; 
    
    const novoValor = prompt(`Qual o valor para "${novoNome}"?`, metaFinanceira);
    if (novoValor !== null && !isNaN(novoValor)) {
        metaNome = novoNome;
        metaFinanceira = parseFloat(novoValor);
        localStorage.setItem('metaNome', metaNome);
        localStorage.setItem('metaFinanceira', metaFinanceira);
        atualizarTela(); 
    }
}

function atualizarProgressoMeta(faturamentoTotal) {
    document.getElementById('nome-meta-display').innerText = metaNome;
    document.getElementById('display-meta').innerText = `R$ ${metaFinanceira.toFixed(2)}`;

    const barra = document.getElementById('barra-progresso');
    const texto = document.getElementById('texto-progresso');

    if (metaFinanceira > 0) {
        let porcentagem = (faturamentoTotal / metaFinanceira) * 100;
        if (porcentagem > 100) porcentagem = 100;

        barra.style.width = `${porcentagem}%`;
        barra.style.background = porcentagem >= 100 ? 'linear-gradient(135deg, #00b894, #55efc4)' : 'var(--gradiente-meta)';
        texto.innerText = `${porcentagem.toFixed(1)}% atingido`;
    } else {
        barra.style.width = '0%';
        texto.innerText = 'Defina uma meta';
    }
}

// --- 5. GESTÃO DE CATEGORIAS ---
let sortableInstance = null;

function atualizarListasDeCategorias() {
    const selectForm = document.getElementById('categoria');
    const selectFiltro = document.getElementById('filtro-categoria');
    const listaModal = document.getElementById('lista-categorias');

    const categoriaSelecionadaAntes = selectForm.value || 'Geral';

    selectForm.innerHTML = '';
    selectFiltro.innerHTML = '<option value="todas">Todas as Categorias</option>';
    listaModal.innerHTML = '';

    categorias.forEach((cat) => {
        let corDaCategoria = coresCategorias[cat] || '#b2bec3';
        
        // Pinta o texto da opção no menu
        selectForm.innerHTML += `<option value="${cat}" style="color: ${corDaCategoria}; font-weight: 600;">${cat}</option>`;
        selectFiltro.innerHTML += `<option value="${cat}">${cat}</option>`;
        
        let htmlBolinhaColorida = `<span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${corDaCategoria}; display: inline-block;"></span>`;

        if (cat !== 'Geral') {
            listaModal.innerHTML += `
                <li class="item-categoria drag-item" data-nome="${cat}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-grip-lines drag-handle" title="Arraste para reordenar"></i>
                        ${htmlBolinhaColorida}
                        <span style="font-weight: 500;">${cat}</span>
                    </div>
                    <button class="btn-del-cat" onclick="removerCategoria('${cat}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </li>
            `;
        } else {
            listaModal.innerHTML += `
                <li class="item-categoria fixed-item" data-nome="${cat}">
                    <div style="display: flex; align-items: center; gap: 10px; padding-left: 26px;">
                        ${htmlBolinhaColorida}
                        <span style="font-weight: 500;">${cat}</span>
                    </div>
                    <span style="color: #b2bec3; font-size: 12px; margin-right: 10px;">(Padrão Fixo)</span>
                </li>
            `;
        }
    });

    if (categorias.includes(categoriaSelecionadaAntes)) {
        selectForm.value = categoriaSelecionadaAntes;
    }
    
    atualizarCorDaCaixaDeSelecao(); // Chama a função para já pintar a caixa atual

    if (sortableInstance) sortableInstance.destroy(); 
    sortableInstance = new Sortable(listaModal, {
        animation: 150, handle: '.drag-handle', filter: '.fixed-item',
        onEnd: function () {
            const novaOrdem = [];
            document.querySelectorAll('#lista-categorias .item-categoria').forEach(li => {
                novaOrdem.push(li.getAttribute('data-nome'));
            });
            categorias = novaOrdem;
            localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
            atualizarListasDeCategorias(); 
        }
    });
}

function abrirModal() { document.getElementById('modal-categorias').style.display = 'flex'; }
function fecharModal() { document.getElementById('modal-categorias').style.display = 'none'; }

function adicionarCategoria() {
    const input = document.getElementById('nova-categoria');
    const inputCor = document.getElementById('cor-categoria');
    
    let nome = input.value.trim();
    let corEscolhida = inputCor.value; 

    if (nome) nome = nome.charAt(0).toUpperCase() + nome.slice(1); 

    if (nome !== '' && !categorias.includes(nome)) {
        categorias.push(nome);
        coresCategorias[nome] = corEscolhida; 
        
        localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
        localStorage.setItem('coresDashboardCores', JSON.stringify(coresCategorias)); 
        
        input.value = '';
        atualizarListasDeCategorias();
        atualizarTela(); 
    }
    input.focus();
}

function removerCategoria(nomeCategoria) {
    if (nomeCategoria === 'Geral') return; 
    categorias = categorias.filter(cat => cat !== nomeCategoria);
    
    delete coresCategorias[nomeCategoria];

    localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
    localStorage.setItem('coresDashboardCores', JSON.stringify(coresCategorias));
    atualizarListasDeCategorias();
    atualizarTela();
}

// --- 6. LÓGICA DE TRANSAÇÕES ---
form.addEventListener('submit', function(evento) {
    evento.preventDefault(); 

    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);
    const tipo = document.getElementById('tipo').value;
    const data = document.getElementById('data').value || getDataHoje();
    const categoriaSelecionada = document.getElementById('categoria').value; 

    transacoes.push({ descricao, valor, tipo, data, categoria: categoriaSelecionada });
    localStorage.setItem('bancoDashboard', JSON.stringify(transacoes));

    atualizarTela();
    form.reset();
    document.getElementById('data').value = getDataHoje();
    document.getElementById('categoria').value = categoriaSelecionada; 
    atualizarCorDaCaixaDeSelecao(); // Garante que a borda continue certa após enviar
});

function removerTransacao(index) {
    transacoes.splice(index, 1);
    localStorage.setItem('bancoDashboard', JSON.stringify(transacoes));
    atualizarTela();
}

function atualizarTela() {
    corpoTabela.innerHTML = '';
    let totalReceitas = 0; let totalDespesas = 0;
    let transacoesFiltradas = [];

    transacoes.forEach((transacao, index) => {
        let passaTipo = (filtroTipo.value === 'todos' || transacao.tipo === filtroTipo.value);
        let passaCategoria = (filtroCategoria.value === 'todas' || transacao.categoria === filtroCategoria.value);
        let passaData = true;

        if (filtroDataInicio.value && transacao.data < filtroDataInicio.value) passaData = false;
        if (filtroDataFim.value && transacao.data > filtroDataFim.value) passaData = false;

        if (passaTipo && passaData && passaCategoria) {
            transacoesFiltradas.push(transacao);

            if(transacao.tipo === 'receita') totalReceitas += transacao.valor;
            else totalDespesas += transacao.valor;

            let dataFormatada = transacao.data ? transacao.data.split('-').reverse().join('/') : 'Sem Data';
            let catVisual = transacao.categoria ? transacao.categoria : 'Geral'; 
            
            let corDaTag = coresCategorias[catVisual] || '#b2bec3';
            let corDoTextoIdeal = getCorTextoIdeal(corDaTag); // Chama o cérebro matemático da cor

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td style="font-weight: 500;">${transacao.descricao}</td>
                <td>
                    <span style="background: ${corDaTag}; padding: 6px 12px; border-radius: 12px; font-size: 11px; color: ${corDoTextoIdeal}; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.1); letter-spacing: 0.5px;">
                        ${catVisual}
                    </span>
                </td>
                <td style="color: ${transacao.tipo === 'receita' ? 'var(--cor-primaria)' : 'var(--cor-alerta)'}; font-weight: 600; font-size: 12px;">${transacao.tipo.toUpperCase()}</td>
                <td style="font-weight: 700;">R$ ${transacao.valor.toFixed(2)}</td>
                <td style="text-align: center;">
                    <button class="btn-excluir" onclick="removerTransacao(${index})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        }
    });

    displayReceita.innerText = `R$ ${totalReceitas.toFixed(2)}`;
    displayDespesa.innerText = `R$ ${totalDespesas.toFixed(2)}`;
    const lucro = totalReceitas - totalDespesas;
    displayLucro.innerText = `R$ ${lucro.toFixed(2)}`;
    displayLucro.style.color = lucro >= 0 ? 'var(--texto)' : 'var(--cor-alerta)';

    atualizarProgressoMeta(totalReceitas);
    atualizarGrafico(totalReceitas, totalDespesas);
    atualizarGraficoBarras(transacoesFiltradas);
}

// --- 7. GRÁFICOS ---
function atualizarGrafico(receitas, despesas) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (meuGrafico) { meuGrafico.destroy(); }
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Receitas', 'Despesas'], datasets: [{ data: [receitas, despesas], backgroundColor: ['#00b894', '#ff7675'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Proporção do Filtro Atual' } }, cutout: '70%' }
    });
}

function atualizarGraficoBarras(listaFiltrada) {
    const ctx = document.getElementById('graficoBarras').getContext('2d');
    if (meuGraficoBarras) { meuGraficoBarras.destroy(); }

    const resumoCategorias = {};
    listaFiltrada.forEach(t => {
        const cat = t.categoria || 'Geral';
        if (!resumoCategorias[cat]) { resumoCategorias[cat] = { receita: 0, despesa: 0 }; }
        if (t.tipo === 'receita') { resumoCategorias[cat].receita += t.valor; } 
        else { resumoCategorias[cat].despesa += t.valor; }
    });

    const labels = Object.keys(resumoCategorias);
    const dadosReceitas = labels.map(cat => resumoCategorias[cat].receita);
    const dadosDespesas = labels.map(cat => resumoCategorias[cat].despesa);

    meuGraficoBarras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Receitas', data: dadosReceitas, backgroundColor: '#00b894', borderRadius: 6 },
                { label: 'Despesas', data: dadosDespesas, backgroundColor: '#ff7675', borderRadius: 6 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Desempenho por Categoria' } }, scales: { y: { beginAtZero: true } } }
    });
}

// --- 8. EXPORTAR PDF ---
function gerarPDF() {
    const dataHoje = new Date();
    const dia = String(dataHoje.getDate()).padStart(2, '0');
    const mes = String(dataHoje.getMonth() + 1).padStart(2, '0');
    const ano = dataHoje.getFullYear();
    const nomePadrao = `Relatorio_Financeiro_${dia}-${mes}-${ano}`;

    let nomeArquivo = prompt("Escolha o nome do arquivo para salvar:", nomePadrao);
    if (nomeArquivo === null) return; 
    if (!nomeArquivo.endsWith('.pdf')) nomeArquivo += '.pdf';

    const elemento = document.querySelector(".tabela-container");
    const btnPdf = document.querySelector('.btn-pdf');
    const areaFiltros = document.querySelector('.filtro-area');
    const colunasAcoes = document.querySelectorAll('th:last-child, td:last-child');
    const tituloOriginal = document.querySelector('.tabela-header h3');

    const body = document.body;
    const estavaEscuro = body.classList.contains('dark-theme');
    if (estavaEscuro) { body.classList.remove('dark-theme'); }

    const dtInicioRaw = document.getElementById('filtro-data-inicio').value;
    const dtFimRaw = document.getElementById('filtro-data-fim').value;
    let textoPeriodo = (!dtInicioRaw && !dtFimRaw) ? "Todo o período" : `${dtInicioRaw ? dtInicioRaw.split('-').reverse().join('/') : '-'} até ${dtFimRaw ? dtFimRaw.split('-').reverse().join('/') : 'Hoje'}`;
    const selTipo = document.getElementById('filtro-tipo'); const selCat = document.getElementById('filtro-categoria');
    const txtTipo = selTipo.options[selTipo.selectedIndex].text; const txtCat = selCat.options[selCat.selectedIndex].text;

    btnPdf.style.display = 'none'; areaFiltros.style.display = 'none'; tituloOriginal.style.display = 'none'; 
    colunasAcoes.forEach(celula => celula.style.display = 'none');
    window.scrollTo(0, 0); elemento.style.overflow = 'visible'; 

    const infoPDF = document.createElement('div');
    infoPDF.id = 'info-impressao'; 
    const agora = new Date();
    
    infoPDF.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #dfe6e9; font-family: sans-serif; color: #2d3436;">
            <div>
                <h2 style="margin: 0 0 10px 0; color: #2d3436; font-size: 22px;">Relatório Financeiro</h2>
                <div style="color: #636e72; font-size: 14px;"><strong>Filtro:</strong> ${txtTipo} | ${txtCat}<br><strong>Período:</strong> ${textoPeriodo}</div>
            </div>
            <div style="text-align: right; color: #636e72; font-size: 13px;">
                <span style="display: block; margin-bottom: 4px;">Gerado em:</span>
                <strong style="color: #2d3436; font-size: 15px;">${agora.toLocaleDateString('pt-BR')}</strong><br>
                às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
            </div>
        </div>
    `;
    
    document.querySelector('table').insertAdjacentElement('beforebegin', infoPDF);

    html2pdf().set({
        margin: 10, filename: nomeArquivo, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(elemento).save().then(() => {
        btnPdf.style.display = ''; areaFiltros.style.display = ''; tituloOriginal.style.display = ''; colunasAcoes.forEach(celula => celula.style.display = '');
        document.getElementById('info-impressao').remove(); elemento.style.overflow = 'auto'; 
        if (estavaEscuro) { body.classList.add('dark-theme'); }
    });
}

// --- 9. INICIA O SISTEMA ---
atualizarListasDeCategorias();
atualizarTela();
