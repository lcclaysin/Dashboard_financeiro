// --- 0. CONEXÃO COM A NUVEM (FIREBASE) ---
import { getFirestore, collection, addDoc, getDocs, onSnapshot, deleteDoc, doc, updateDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
// NOVO: Ferramentas do Storage
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";
const firebaseConfig = {
  apiKey: "AIzaSyAHk_Rwev-ZkkzJflzh7l5Ei1EBZwEgntA",
  authDomain: "dashboard-financeiro-911a0.firebaseapp.com",
  projectId: "dashboard-financeiro-911a0",
  storageBucket: "dashboard-financeiro-911a0.firebasestorage.app",
  messagingSenderId: "329815045435",
  appId: "1:329815045435:web:37cbd62ed7fd399fcc731e"
  // Removi o analytics para manter o app focado em performance
};

// Ligando o motor
const app = initializeApp(firebaseConfig);

// Criando o "gancho" para o Banco de Dados, Autenticação e Storage
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // <-- LINHA NOVA

// --- 1. BANCOS DE DADOS ---
let categorias = JSON.parse(localStorage.getItem('categoriasDashboard')) || [];
let coresCategorias = JSON.parse(localStorage.getItem('coresDashboardCores')) || { 'Geral': '#b2bec3' };

// --- 1. PREPARAÇÃO DO BANCO DE DADOS (DEV vs PROD) ---
let transacoes = []; 

// O detetive blindado: Se a URL NÃO contém "github.io", é o seu VS Code.
const rodandoNoComputador = !window.location.hostname.includes("github.io");

//const nomeDaColecao = rodandoNoComputador ? "transacoes_teste" : "transacoes";
const nomeDaColecao = "transacoes_teste";
const transacoesRef = collection(db, nomeDaColecao);

if (rodandoNoComputador) {
    console.warn("🛠️ MODO DESENVOLVIMENTO: Gravando na pasta 'transacoes_teste'");
} else {
    console.log("🚀 MODO PRODUÇÃO: Conectado ao banco oficial!");
}
// --- 2. MÁGICA DO TEMPO REAL (Ouvinte) ---

if (!categorias.includes('Geral')) {
    categorias.unshift('Geral');
    localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
}

// --- 1.1. GESTÃO DO TEMA CLARO/ESCURO ---
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

// --- FUNÇÃO PRINCIPAL DE ATUALIZAÇÃO DA TABELA ---
function atualizarTela() {
    if (!corpoTabela) return;
    corpoTabela.innerHTML = '';
    
    let totalReceitas = 0; 
    let totalDespesas = 0;
    let transacoesFiltradas = [];

    // 1. CAPTURANDO TODOS OS VALORES DOS FILTROS
    const filtroTipo = document.getElementById('filtro-tipo').value;
    const filtroCategoria = document.getElementById('filtro-categoria').value;
    const filtroDataInicio = document.getElementById('filtro-data-inicio').value;
    const filtroDataFim = document.getElementById('filtro-data-fim').value;
    const filtroStatus = document.getElementById('filtro-status') ? document.getElementById('filtro-status').value : 'todos';
    
    // Novos campos avançados
    const buscaTexto = document.getElementById('filtro-busca') ? document.getElementById('filtro-busca').value.toLowerCase().trim() : '';
    const inputMin = document.getElementById('filtro-valor-min') ? document.getElementById('filtro-valor-min').value : '';
    const inputMax = document.getElementById('filtro-valor-max') ? document.getElementById('filtro-valor-max').value : '';
    const valorMin = inputMin !== "" ? parseFloat(inputMin) : 0;
    const valorMax = inputMax !== "" ? parseFloat(inputMax) : Infinity;
    const operadorSelecionado = document.getElementById('filtro-operador') ? document.getElementById('filtro-operador').value : 'todos';

    // 2. APLICANDO A PENEIRA EM CADA TRANSAÇÃO
    transacoes.forEach((transacao) => {
        const valorSeguro = parseFloat(transacao.valor) || 0;
        
        let passaTipo = (filtroTipo === 'todos' || transacao.tipo === filtroTipo);
        let passaCategoria = (filtroCategoria === 'todas' || transacao.categoria === filtroCategoria);
        
        let passaData = true;
        if (filtroDataInicio && transacao.data < filtroDataInicio) passaData = false;
        if (filtroDataFim && transacao.data > filtroDataFim) passaData = false;

        const descricaoNormalizada = (transacao.descricao || "").toLowerCase();
        const categoriaNormalizada = (transacao.categoria || "").toLowerCase();
        const passaBusca = descricaoNormalizada.includes(buscaTexto) || categoriaNormalizada.includes(buscaTexto);
        
        const passaValor = valorSeguro >= valorMin && valorSeguro <= valorMax;
        const passaOperador = (operadorSelecionado === 'todos' || transacao.nomeUsuario === operadorSelecionado);

        const statusDaTransacao = transacao.status || 'pago'; 
        const passaStatus = (filtroStatus === 'todos' || statusDaTransacao === filtroStatus);

        // SE PASSAR EM TODOS OS TESTES, ENTRA NA TABELA:
        if (passaTipo && passaCategoria && passaData && passaBusca && passaValor && passaOperador && passaStatus) {
            transacoesFiltradas.push(transacao);

            // Matemática: Se estiver CANCELADO, vira R$ 0,00 nos cálculos
            const valorParaCalculo = statusDaTransacao === 'cancelado' ? 0 : valorSeguro;

            if(transacao.tipo === 'receita') totalReceitas += valorParaCalculo;
            else totalDespesas += valorParaCalculo;

            // VISUAL DO STATUS (Etiquetas coloridas)
            let corStatusBg = '';
            let corStatusTxt = '';
            let textoStatus = '';
            let iconeStatus = '';
            let estiloLinha = '';

            if (statusDaTransacao === 'pendente') {
                corStatusBg = 'rgba(243, 156, 18, 0.15)';
                corStatusTxt = '#d35400';
                textoStatus = 'Pendente';
                iconeStatus = '<i class="fa-solid fa-clock"></i>';
                estiloLinha = 'opacity: 0.9;'; 
            } else if (statusDaTransacao === 'cancelado') {
                corStatusBg = 'rgba(200, 214, 229, 0.3)';
                corStatusTxt = '#8395a7';
                textoStatus = 'Cancelado';
                iconeStatus = '<i class="fa-solid fa-ban"></i>';
                estiloLinha = 'text-decoration: line-through; opacity: 0.6;'; 
            } else {
                corStatusBg = 'rgba(0, 184, 148, 0.15)';
                corStatusTxt = '#00b894';
                textoStatus = 'Pago';
                iconeStatus = '<i class="fa-solid fa-check-circle"></i>';
            }

            // Variáveis visuais da linha
            let dataFormatada = transacao.data ? transacao.data.split('-').reverse().join('/') : 'Sem Data';
            let catVisual = transacao.categoria || 'Geral'; 
            let corDaTag = coresCategorias[catVisual] || '#b2bec3';
            let corDoTextoIdeal = getCorTextoIdeal(corDaTag);


            // Debug técnico: veja se o link está chegando do banco
            console.log(`Transação ${transacao.descricao}:`, transacao.comprovante);

            let htmlAnexo = '';
            if (transacao.comprovante && transacao.comprovante !== "") {
                htmlAnexo = `
                    <div style="margin-top: 8px;">
                        <a href="${transacao.comprovante}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #0984e3; background: rgba(9, 132, 227, 0.1); padding: 5px 10px; border-radius: 6px; text-decoration: none; font-weight: 700; border: 1px solid rgba(9, 132, 227, 0.2);">
                            <i class="fa-solid fa-paperclip"></i> Ver Comprovante
                        </a>
                    </div>
                `;
            }

            // Cria a linha (tr)
            const tr = document.createElement('tr');
            tr.id = `linha-${transacao.id}`; 
            tr.style = estiloLinha; 
            
            // No innerHTML, certifique-se de que a variável htmlAnexo está aqui:
            tr.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Descrição" style="font-weight: 500;">
                    ${transacao.descricao}
                    ${htmlAnexo}
                </td>
                
                <td data-label="Status">
                    <span style="background: ${corStatusBg}; color: ${corStatusTxt}; padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;">
                        ${iconeStatus} ${textoStatus}
                    </span>
                </td>

                <td data-label="Categoria">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
                        <span style="background: ${corDaTag}; padding: 6px 12px; border-radius: 12px; font-size: 11px; color: ${corDoTextoIdeal}; font-weight: 700; white-space: nowrap;">
                            ${catVisual}
                        </span>
                        ${(auth.currentUser && auth.currentUser.uid === ADMIN_UID && transacao.nomeUsuario) ? 
                          `<span style="background: var(--fundo); border: 1px solid #dfe6e9; padding: 4px 8px; border-radius: 6px; font-size: 10px; color: var(--texto); white-space: nowrap; opacity: 0.85;" title="Lançado por ${transacao.nomeUsuario}">
                              <i class="fa-solid fa-user-pen" style="margin-right: 4px;"></i>${transacao.nomeUsuario}
                          </span>` : ''}
                    </div>
                </td>
                
                <td data-label="Tipo" style="color: ${transacao.tipo === 'receita' ? 'var(--cor-primaria)' : 'var(--cor-alerta)'}; font-weight: 600; font-size: 12px;">${transacao.tipo.toUpperCase()}</td>
                
                <td data-label="Valor" style="font-weight: 700;">R$ ${valorSeguro.toFixed(2)}</td>
                
                <td data-label="Ações">
                    <div style="display: flex; gap: 15px;">
                        <button class="btn-editar" onclick="prepararEdicao('${transacao.id}')" title="Editar" style="background:transparent; border:none; color:#0984e3; cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-excluir" onclick="removerTransacao('${transacao.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            corpoTabela.appendChild(tr);
        }
    });

    // 3. ATUALIZA DISPLAYS E GRÁFICOS COM OS DADOS FILTRADOS
    if (displayReceita) displayReceita.innerText = `R$ ${totalReceitas.toFixed(2)}`;
    if (displayDespesa) displayDespesa.innerText = `R$ ${totalDespesas.toFixed(2)}`;
    
    if (displayLucro) {
        const lucro = totalReceitas - totalDespesas;
        displayLucro.innerText = `R$ ${lucro.toFixed(2)}`;
        displayLucro.style.color = lucro >= 0 ? 'var(--texto)' : 'var(--cor-alerta)';
    }

    if (typeof atualizarProgressoMeta === "function") atualizarProgressoMeta(totalReceitas);
    if (typeof atualizarGrafico === "function") atualizarGrafico(totalReceitas, totalDespesas);
    if (typeof atualizarGraficoBarras === "function") atualizarGraficoBarras(transacoesFiltradas);
}

// --- 13. SISTEMA DE AUTENTICAÇÃO (LOGIN / LOGOUT) ---
const overlayLogin = document.getElementById('login-overlay');
const formLogin = document.getElementById('form-login');
const msgErro = document.getElementById('msg-erro-login');

// Fica vigiando 24h se o usuário está logado ou não
// --- SISTEMA DE HIERARQUIA E AUTENTICAÇÃO ---
// --- SISTEMA DE HIERARQUIA E AUTENTICAÇÃO ---
const ADMIN_UID = "RBEUXYma3kQXTDjK1kT4m1bCQyL2"; // EXATAMENTE igual ao painel do Firebase
let unsubscribeSnapshot = null; 

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (overlayLogin) overlayLogin.style.display = 'none';

        // 1. LÓGICA DO NOME (BEM-VINDO)
        let nomeDoUsuario = user.displayName;
        if (!nomeDoUsuario) {
            // Se for a primeira vez, pergunta o nome
            nomeDoUsuario = prompt("Bem-vindo! Qual é o seu nome ou apelido para o sistema?");
            if (!nomeDoUsuario) nomeDoUsuario = "Operador"; // Nome padrão se a pessoa não digitar nada
            
            // Salva o nome na conta do Google Firebase permanentemente
            await updateProfile(user, { displayName: nomeDoUsuario });
        }
        
        // Mostra o nome na tela COM O BOTÃO DE EDITAR
        const saudacao = document.getElementById('saudacao-usuario');
        if (saudacao) {
            saudacao.innerHTML = `
                <span style="font-weight: 400;">Olá,</span> 
                <strong style="color: var(--cor-primaria);">${nomeDoUsuario}</strong>
                <button onclick="mudarNome()" title="Editar Nome" style="background: transparent; border: none; color: var(--texto); cursor: pointer; opacity: 0.5; font-size: 12px; margin-left: 5px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
            `;
        }

        // MOSTRA A ÁREA DE ADMIN APENAS PARA O MESTRE
        const areaAdmin = document.getElementById('area-admin');
        if (user.uid === ADMIN_UID) {
            areaAdmin.style.display = 'block';
        } else {
            areaAdmin.style.display = 'none';
        }

        if (user.uid === ADMIN_UID) {
            const containerOperador = document.getElementById('container-filtro-operador');
            if (containerOperador) containerOperador.style.display = 'block';
            
            // Opcional: Aqui você pode fazer um loop nas transações para preencher 
            // o select 'filtro-operador' com os nomes únicos que existem no banco.
        }

        // 2. LÓGICA DO BANCO (MESTRE VS OPERADOR)
        let consultaBanco;
        if (user.uid === ADMIN_UID) {
            consultaBanco = transacoesRef; // Você (Mestre) puxa tudo
        } else {
            consultaBanco = query(transacoesRef, where("userId", "==", user.uid)); // Eles puxam só o deles
        }

        if (unsubscribeSnapshot) unsubscribeSnapshot(); 
        
        unsubscribeSnapshot = onSnapshot(consultaBanco, (snapshot) => {
            transacoes = []; 
            const nomesUnicos = new Set(); // Cria uma lista sem repetições
            
            snapshot.forEach((documento) => {
                const dados = documento.data();
                transacoes.push({ id: documento.id, ...dados }); 
                
                // Salva o nome de quem lançou para o filtro
                if (dados.nomeUsuario) {
                    nomesUnicos.add(dados.nomeUsuario);
                }
            });
            
            // Lógica para popular o menu de operadores (Só para o Mestre)
            const containerOperador = document.getElementById('container-filtro-operador');
            const selectOperador = document.getElementById('filtro-operador');
            
            if (user.uid === ADMIN_UID) {
                if (containerOperador) containerOperador.style.display = 'block';
                
                if (selectOperador) {
                    const valorAntigo = selectOperador.value; // Guarda a seleção atual
                    selectOperador.innerHTML = '<option value="todos">Todos os Operadores</option>';
                    
                    nomesUnicos.forEach(nome => {
                        selectOperador.innerHTML += `<option value="${nome}">${nome}</option>`;
                    });
                    
                    selectOperador.value = valorAntigo || "todos"; // Devolve a seleção
                }
            } else {
                if (containerOperador) containerOperador.style.display = 'none';
            }

            atualizarTela(); 
        });

    } else {
        if (overlayLogin) overlayLogin.style.display = 'flex';
        if (unsubscribeSnapshot) unsubscribeSnapshot(); 
        transacoes = []; 
        atualizarTela();
    }

    
});

// --- FUNÇÃO PARA O MESTRE CADASTRAR NOVOS USUÁRIOS ---
const formAdmin = document.getElementById('form-cadastro-admin');
if (formAdmin) {
    formAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('novo-email-admin').value;
        const senha = document.getElementById('nova-senha-admin').value;
        const msg = document.getElementById('msg-sucesso-admin');

        try {
            // Criamos uma instância secundária rápida só para o cadastro
            // Isso evita que o Firebase te deslogue ao criar a conta
            const appSecundario = initializeApp(firebaseConfig, "Secondary");
            const authSecundario = getAuth(appSecundario);
            
            await createUserWithEmailAndPassword(authSecundario, email, senha);
            
            // Limpa a instância secundária para não dar erro de duplicata
            await deleteApp(appSecundario);

            msg.style.display = 'block';
            formAdmin.reset();
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
            
        } catch (error) {
            console.error("Erro ao cadastrar via Admin:", error);
            alert("Erro: " + error.message);
        }
    });
}

// Quando clicar em "Entrar no Sistema"
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede a página de piscar/recarregar
        console.log("TENTATIVA: Enviando dados para a nuvem...");
        
        const email = document.getElementById('email-login').value;
        const senha = document.getElementById('senha-login').value;
        const btn = formLogin.querySelector('button');
        const textoOriginal = btn.innerText;
        
        try {
            msgErro.style.display = 'none'; 
            btn.innerText = "Autenticando..."; // Dá um feedback visual no botão
            
            await signInWithEmailAndPassword(auth, email, senha);
            
            // Se chegou aqui, a senha estava certa! O onAuthStateChanged vai esconder a tela.
            btn.innerText = textoOriginal; 
        } catch (error) {
            console.error("FALHA no login:", error.code);
            msgErro.style.display = 'block';
            msgErro.innerText = "Credenciais inválidas. Verifique o e-mail e a senha.";
            btn.innerText = textoOriginal;
        }
    });
}

// Função para deslogar
function fazerLogout() {
    signOut(auth).then(() => {
        // O onAuthStateChanged vai perceber e mostrar a tela de login novamente
        document.getElementById('email-login').value = '';
        document.getElementById('senha-login').value = '';
    }).catch((error) => {
        console.error("Erro ao sair:", error);
    });
}

// --- FUNÇÃO PARA ALTERAR O NOME DE USUÁRIO ---
async function mudarNome() {
    if (!auth.currentUser) return;
    
    const novoNome = prompt("Digite o seu nome correto:", auth.currentUser.displayName);
    
    if (novoNome && novoNome.trim() !== "") {
        try {
            await updateProfile(auth.currentUser, { displayName: novoNome.trim() });
            // Atualiza os lançamentos antigos que já estavam com o nome errado na tela (apenas visualmente até recarregar)
            location.reload(); 
        } catch (erro) {
            console.error("Erro ao atualizar o nome:", erro);
            alert("Não foi possível alterar o nome agora.");
        }
    }
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
// --- 8. EXPORTAR PDF (CORRIGIDO) ---
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
    
    // Captura a caixa com todos os botões novos
    const grupoBotoes = document.getElementById('grupo-botoes'); 
    const areaFiltros = document.querySelector('.filtro-area');
    const colunasAcoes = document.querySelectorAll('th:last-child, td:last-child');
    const tituloOriginal = document.getElementById('titulo-historico'); 

    const body = document.body;
    const estavaEscuro = body.classList.contains('dark-theme');
    if (estavaEscuro) { body.classList.remove('dark-theme'); }

    const dtInicioRaw = document.getElementById('filtro-data-inicio').value;
    const dtFimRaw = document.getElementById('filtro-data-fim').value;
    let textoPeriodo = (!dtInicioRaw && !dtFimRaw) ? "Todo o período" : `${dtInicioRaw ? dtInicioRaw.split('-').reverse().join('/') : '-'} até ${dtFimRaw ? dtFimRaw.split('-').reverse().join('/') : 'Hoje'}`;
    const selTipo = document.getElementById('filtro-tipo'); const selCat = document.getElementById('filtro-categoria');
    const txtTipo = selTipo.options[selTipo.selectedIndex].text; const txtCat = selCat.options[selCat.selectedIndex].text;

    // ESCONDE TUDO PARA A FOTO DO PDF
    if (grupoBotoes) grupoBotoes.style.display = 'none'; 
    if (areaFiltros) areaFiltros.style.display = 'none'; 
    if (tituloOriginal) tituloOriginal.style.display = 'none'; 
    colunasAcoes.forEach(celula => celula.style.display = 'none');
    
    window.scrollTo(0, 0); 
    elemento.style.overflow = 'visible'; 

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
        // MOSTRA OS BOTÕES DE VOLTA DEPOIS DA FOTO
        if (grupoBotoes) grupoBotoes.style.display = 'flex'; 
        if (areaFiltros) areaFiltros.style.display = 'flex'; 
        if (tituloOriginal) tituloOriginal.style.display = 'block'; 
        colunasAcoes.forEach(celula => celula.style.display = '');
        
        document.getElementById('info-impressao').remove(); 
        elemento.style.overflow = 'auto'; 
        if (estavaEscuro) { body.classList.add('dark-theme'); }
    });
}

// --- 10. REGISTRO DO APLICATIVO (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('App registrado com sucesso!'))
            .catch(err => console.log('Falha ao registrar o App:', err));
    });
}

// VARIÁVEL GLOBAL PARA CONTROLE DE EDIÇÃO
let idEdicao = null;

// --- 6.1 EXCLUSÃO COM CONFIRMAÇÃO ---
/*function removerTransacao(index) {
    if (confirm("Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.")) {
        transacoes.splice(index, 1);
        localStorage.setItem('bancoDashboard', JSON.stringify(transacoes));
        atualizarTela();
    }
}*/

// --- 6.1 EXCLUSÃO NA NUVEM ---
async function removerTransacao(id) {
    if (confirm("Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.")) {
        // Manda o Firebase apagar o documento com este ID
        await deleteDoc(doc(db, nomeDaColecao, id));
        // O onSnapshot deteta a exclusão e limpa a linha da tabela automaticamente!
    }
}

// --- 6.2 LÓGICA DE EDIÇÃO ---
function prepararEdicao(id) {
    // Procura na nossa lista local qual é o item que tem este ID
    const t = transacoes.find(item => item.id === id);
    if (!t) return;

    idEdicao = id;

    document.getElementById('descricao').value = t.descricao;
    document.getElementById('valor').value = t.valor;
    document.getElementById('data').value = t.data;
    document.getElementById('categoria').value = t.categoria;
    document.getElementById('tipo').value = t.tipo;

    atualizarCorDaCaixaDeSelecao();

    const btn = document.getElementById('btn-salvar-transacao');
    btn.innerText = "Salvar Alteração";
    btn.style.background = "linear-gradient(135deg, #f39c12, #e67e22)";
    document.querySelector('.form-container').classList.add('modo-edicao');
    
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (t.comprovante) {
        mostrarPreviewComprovante(t.comprovante);
    } else {
        removerAnexo();
    }
}

// Memória temporária para guardar a última categoria e data de inclusão
let ultimaCategoriaAdicionada = 'Geral';
let ultimaDataAdicionada = getDataHoje(); // NOVO: Inicia com a data de hoje

// --- LÓGICA DE SALVAR / EDITAR NA NUVEM ---
form.addEventListener('submit', async function(evento) {
    evento.preventDefault(); 

const dados = {
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        tipo: document.getElementById('tipo').value,
        data: document.getElementById('data').value || getDataHoje(),
        categoria: document.getElementById('categoria').value,
        userId: auth.currentUser.uid, 
        nomeUsuario: auth.currentUser.displayName || "Operador",
        status: document.getElementById('status-lancamento').value,
        comprovante: document.getElementById('url-comprovante').value // <-- NOVA LINHA (Grava o link da foto)
    };

    let indexParaRolar = null; 
    let foiEdicao = (idEdicao !== null); // NOVO: O código memoriza se era edição ANTES de limpar a variável

    try {
        if (idEdicao !== null) {
            // MODO EDIÇÃO: Atualiza o documento específico na nuvem
            const documentoRef = doc(db, nomeDaColecao, idEdicao);
            await updateDoc(documentoRef, dados);
            
            indexParaRolar = idEdicao; 
            idEdicao = null; 
            
            const btn = document.getElementById('btn-salvar-transacao');
            btn.innerText = "Adicionar";
            btn.style.background = "var(--gradiente-btn)";
            document.querySelector('.form-container').classList.remove('modo-edicao');
        } else {
            // MODO NOVO: Cria um documento novo na nuvem
            const novoDoc = await addDoc(transacoesRef, dados);
            indexParaRolar = novoDoc.id; // Guarda o ID gerado para rolar a página depois
            ultimaCategoriaAdicionada = dados.categoria; 
            ultimaDataAdicionada = dados.data; 
        }

        // ATENÇÃO: Repare que já não usamos localStorage aqui! 
        // O onSnapshot lá em cima vai perceber a mudança e atualizar a tela sozinho.

        form.reset();
        removerAnexo();
        document.getElementById('data').value = ultimaDataAdicionada;
        document.getElementById('categoria').value = ultimaCategoriaAdicionada;
        atualizarCorDaCaixaDeSelecao();

// Efeito de Rolagem e Destaque
        setTimeout(() => { 
            const linhaAtualizada = document.getElementById(`linha-${indexParaRolar}`);
            if (linhaAtualizada) {
                // NOVO: Só rola a tela para baixo se foi uma EDIÇÃO
                if (foiEdicao) {
                    linhaAtualizada.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                linhaAtualizada.style.transition = "background-color 0.8s";
                linhaAtualizada.style.backgroundColor = "rgba(9, 132, 227, 0.2)";
                setTimeout(() => { linhaAtualizada.style.backgroundColor = ""; }, 1000);
            }
        }, 500);

    } catch (erro) {
        console.error("Erro ao comunicar com o Firebase:", erro);
        alert("Ocorreu um erro ao guardar os dados na nuvem.");
    }
});

// --- 11. BACKUP E RESTAURAÇÃO ---
function exportarDados() {
    const dadosParaExportar = {
        transacoes: transacoes,
        categorias: categorias,
        cores: coresCategorias,
        meta: { nome: metaNome, valor: metaFinanceira }
    };

    const blob = new Blob([JSON.stringify(dadosParaExportar, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_financeiro_${getDataHoje()}.json`;
    a.click();
}

function importarDados(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            if (confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
                transacoes = dados.transacoes || [];
                categorias = dados.categorias || [];
                coresCategorias = dados.cores || {};
                metaNome = dados.meta?.nome || 'Meta do Período';
                metaFinanceira = dados.meta?.valor || 0;

                localStorage.setItem('bancoDashboard', JSON.stringify(transacoes));
                localStorage.setItem('categoriasDashboard', JSON.stringify(categorias));
                localStorage.setItem('coresDashboardCores', JSON.stringify(coresCategorias));
                localStorage.setItem('metaNome', metaNome);
                localStorage.setItem('metaFinanceira', metaFinanceira);

                location.reload(); // Recarrega para aplicar tudo
            }
        } catch (err) {
            alert("Erro ao ler o arquivo de backup.");
        }
    };
    leitor.readAsText(arquivo);
}

// --- 11.1 EXPORTAR PARA EXCEL (CSV) ---
function exportarExcel() {
    if (transacoes.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    // 1. Criar o cabeçalho das colunas
    let csvContent = "Data;Descricao;Categoria;Tipo;Valor\n";

    // 2. Percorrer as transações e adicionar as linhas
    transacoes.forEach(t => {
        // Formata a data de AAAA-MM-DD para DD/MM/AAAA para o Excel brasileiro
        const dataFormatada = t.data.split('-').reverse().join('/');
        
        // Formata o valor trocando ponto por vírgula para o Excel entender como número
        const valorFormatado = t.valor.toFixed(2).replace('.', ',');

        // Monta a linha separada por ponto e vírgula (padrão brasileiro do Excel)
        const linha = `${dataFormatada};${t.descricao};${t.categoria};${t.tipo.toUpperCase()};${valorFormatado}\n`;
        csvContent += linha;
    });

    // 3. Criar o arquivo para download
    // O prefixo \uFEFF serve para o Excel entender que o arquivo tem acentos (UTF-8)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Financeiro_${getDataHoje()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 14. SISTEMA DE ANEXOS E QR CODE HÍBRIDO ---
let ouvinteUpload = null;
let qrCodeApp = null;

function mostrarPreviewComprovante(url) {
    document.getElementById('url-comprovante').value = url;
    document.getElementById('img-preview').src = url;
    document.getElementById('preview-comprovante').style.display = 'block';
    document.getElementById('botoes-upload').style.display = 'none';
}

function removerAnexo() {
    document.getElementById('url-comprovante').value = '';
    document.getElementById('img-preview').src = '';
    document.getElementById('preview-comprovante').style.display = 'none';
    document.getElementById('botoes-upload').style.display = 'flex';
    document.getElementById('arquivo-upload').value = '';
}

// Upload Tradicional (Pelo Arquivo do PC)
async function uploadTradicional(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const status = document.getElementById('upload-status');
    status.style.display = 'block';
    status.innerText = 'Enviando imagem...';

    try {
        const nomeArquivo = `comprovantes/${Date.now()}_${arquivo.name}`;
        const referenciaStorage = ref(storage, nomeArquivo);
        await uploadBytesResumable(referenciaStorage, arquivo);
        const url = await getDownloadURL(referenciaStorage);
        
        mostrarPreviewComprovante(url);
        status.style.display = 'none';
    } catch (erro) {
        console.error("Erro no upload:", erro);
        status.innerText = 'Erro ao enviar.';
        status.style.color = 'red';
    }
}

// Upload Mágico (Pelo Celular via QR Code)
function abrirModalQR() {
    document.getElementById('modal-qrcode').style.display = 'flex';
    const container = document.getElementById('qrcode-container');
    container.innerHTML = ''; // Limpa QR antigo

    // 1. Cria um ID único para essa sessão
    const sessaoId = 'qr_' + Date.now();
    
    // 2. Monta o link que o celular vai abrir (apontando para o scanner.html)
    let urlBase = window.location.href.split('index.html')[0];
    if (!urlBase.endsWith('/')) urlBase += '/';
    const linkCelular = `${urlBase}scanner.html?id=${sessaoId}`;

    // 3. Desenha o QR Code na tela
    qrCodeApp = new QRCode(container, {
        text: linkCelular,
        width: 200, height: 200,
        colorDark : "#2d3436", colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    document.getElementById('status-qr').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aguardando celular...';

    // 4. O Computador fica "escutando" a sala de espera no banco de dados
    const docRef = doc(db, "temp_uploads", sessaoId);
    if(ouvinteUpload) ouvinteUpload(); // Cancela o anterior se existir

    ouvinteUpload = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const dados = docSnap.data();
            if (dados.url) {
                // O CELULAR MANDOU A FOTO! 🎉
                fecharModalQR();
                mostrarPreviewComprovante(dados.url);
                deleteDoc(docRef); // Limpa o banco de dados
            }
        }
    });
}

function fecharModalQR() {
    document.getElementById('modal-qrcode').style.display = 'none';
    if(ouvinteUpload) {
        ouvinteUpload(); // O PC para de escutar se você fechar a janela
        ouvinteUpload = null;
    }
}

// Caso você tenha as funções de fechar e salvar a categoria direto no HTML, já garantimos elas aqui:
if (typeof fecharModal !== 'undefined') window.fecharModal = fecharModal;
if (typeof salvarCategoria !== 'undefined') window.salvarCategoria = salvarCategoria;

// --- 12. A CHAVE MESTRA: EXPORTANDO FUNÇÕES PARA O HTML ---
window.toggleTheme = toggleTheme;
window.definirMeta = definirMeta;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.adicionarCategoria = adicionarCategoria;
window.removerCategoria = removerCategoria;
window.prepararEdicao = prepararEdicao;
window.removerTransacao = removerTransacao;
window.exportarExcel = exportarExcel;
window.exportarDados = exportarDados;
window.importarDados = importarDados;
window.gerarPDF = gerarPDF;
window.fazerLogout = fazerLogout;
window.mudarNome = mudarNome;
window.atualizarTela = atualizarTela;
window.abrirModalQR = abrirModalQR;
window.fecharModalQR = fecharModalQR;
window.uploadTradicional = uploadTradicional;
window.removerAnexo = removerAnexo;

// --- 9. INICIA O SISTEMA ---
atualizarListasDeCategorias();
atualizarTela();