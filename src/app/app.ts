import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { environment } from '../environments/environment';

type Perfil = 'cliente' | 'vendedor' | 'admin';
type Tela = 'home' | 'login' | 'cadastro' | 'perfil' | 'servico' | 'chat';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  passwordHash: string;
  fotoPerfilBase64?: string;
  createdAt: number;
  updatedAt: number;
}

interface Servico {
  id: string;
  vendedorId: string;
  titulo: string;
  categoria: string;
  descricao: string;
  fotoServicoBase64?: string;
  createdAt: number;
  updatedAt: number;
}

interface Conversa {
  id: string;
  clienteId: string;
  vendedorId: string;
  servicoId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}

interface Mensagem {
  id: string;
  remetenteId: string;
  texto: string;
  createdAt: number;
}

interface ConversaResumo {
  conversa: Conversa;
  outroNome: string;
  servicoTitulo: string;
}

type ToastTipo = 'success' | 'error' | 'info';

interface ToastMensagem {
  id: number;
  tipo: ToastTipo;
  texto: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly tituloApp = 'Boca a Boca';
  protected readonly telaAtual = signal<Tela>('home');
  protected readonly usuarioAtual = signal<Usuario | null>(null);
  protected readonly servicos = signal<Servico[]>([]);
  protected readonly meuServico = signal<Servico | null>(null);
  protected readonly conversas = signal<ConversaResumo[]>([]);
  protected readonly conversaSelecionada = signal<ConversaResumo | null>(null);
  protected readonly mensagens = signal<Mensagem[]>([]);

  protected readonly loadingCount = signal(0);
  protected readonly loading = computed(() => this.loadingCount() > 0);
  protected readonly error = signal<string | null>(null);
  protected readonly sucesso = signal<string | null>(null);
  protected readonly toasts = signal<ToastMensagem[]>([]);

  protected readonly cadastroForm = {
    nome: '',
    email: '',
    password: '',
    perfil: 'cliente' as Perfil,
  };

  protected readonly loginForm = {
    email: '',
    password: '',
  };

  protected readonly perfilForm = {
    nome: '',
    perfil: 'cliente' as Perfil,
  };

  protected readonly servicoForm = {
    titulo: '',
    categoria: '',
    descricao: '',
  };

  protected mensagemTexto = '';
  protected fotoPerfilBase64 = '';
  protected fotoServicoBase64 = '';
  private toastSequence = 0;
  private toastTimers = new Map<number, number>();

  private readonly app = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly db = getFirestore(this.app);

  async ngOnInit(): Promise<void> {
    await this.withLoading(async () => {
      await this.restaurarSessao();
      await this.carregarServicos();
    });
  }

  protected irPara(tela: Tela): void {
    this.limparMensagensUi();
    this.telaAtual.set(tela);
  }

  protected get logado(): boolean {
    return !!this.usuarioAtual();
  }

  protected get ehVendedor(): boolean {
    const usuario = this.usuarioAtual();
    return !!usuario && (usuario.perfil === 'vendedor' || usuario.perfil === 'admin');
  }

  protected get ehCliente(): boolean {
    const usuario = this.usuarioAtual();
    return !!usuario && (usuario.perfil === 'cliente' || usuario.perfil === 'admin');
  }

  protected async cadastrar(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();

      if (!this.cadastroForm.nome || !this.cadastroForm.email || !this.cadastroForm.password) {
        this.showError('Preencha nome, email e senha para cadastrar.');
        return;
      }

      const emailNormalizado = this.normalizarEmail(this.cadastroForm.email);
      const existente = await this.buscarUsuarioPorEmail(emailNormalizado);
      if (existente) {
        this.showError('Ja existe conta com este email.');
        return;
      }

      const passwordHash = await this.hashPassword(this.cadastroForm.password);
      const agora = Date.now();

      const novoUsuario: Omit<Usuario, 'id'> = {
        nome: this.cadastroForm.nome.trim(),
        email: emailNormalizado,
        perfil: this.cadastroForm.perfil,
        passwordHash,
        ...(this.fotoPerfilBase64 ? { fotoPerfilBase64: this.fotoPerfilBase64 } : {}),
        createdAt: agora,
        updatedAt: agora,
      };

      const ref = await addDoc(collection(this.db, 'usuarios'), novoUsuario);
      const usuarioCriado: Usuario = { id: ref.id, ...novoUsuario };

      this.setUsuarioAtual(usuarioCriado);
      this.sincronizarPerfilForm(usuarioCriado);
      this.resetCadastroForm();
      this.showSuccess('Conta criada com sucesso.');
      this.telaAtual.set('home');
    });
  }

  protected async entrar(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();

      if (!this.loginForm.email || !this.loginForm.password) {
        this.showError('Informe email e senha para entrar.');
        return;
      }

      const emailNormalizado = this.normalizarEmail(this.loginForm.email);
      const usuario = await this.buscarUsuarioPorEmail(emailNormalizado);
      if (!usuario) {
        this.showError('Usuario nao encontrado.');
        return;
      }

      const passwordHash = await this.hashPassword(this.loginForm.password);
      if (usuario.passwordHash !== passwordHash) {
        this.showError('Senha invalida.');
        return;
      }

      this.setUsuarioAtual(usuario);
      this.sincronizarPerfilForm(usuario);
      await this.carregarMeuServico();
      await this.carregarConversas();
      this.resetLoginForm();
      this.showSuccess('Login realizado com sucesso.');
      this.telaAtual.set('home');
    });
  }

  protected sair(): void {
    localStorage.removeItem('boca_a_boca_session_user');
    this.usuarioAtual.set(null);
    this.meuServico.set(null);
    this.conversas.set([]);
    this.conversaSelecionada.set(null);
    this.mensagens.set([]);
    this.showSuccess('Voce saiu da sua conta.');
    this.telaAtual.set('home');
  }

  protected async salvarPerfil(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();
      const usuario = this.usuarioAtual();
      if (!usuario) {
        this.showError('Voce precisa estar logado para editar perfil.');
        return;
      }

      if (!this.perfilForm.nome) {
        this.showError('Nome do perfil e obrigatorio.');
        return;
      }

      const novoPerfil = this.perfilForm.perfil === 'admin' ? usuario.perfil : this.perfilForm.perfil;
      const payload: Partial<Usuario> = {
        nome: this.perfilForm.nome.trim(),
        perfil: novoPerfil,
        updatedAt: Date.now(),
      };

      if (this.fotoPerfilBase64) {
        payload.fotoPerfilBase64 = this.fotoPerfilBase64;
      }

      await updateDoc(doc(this.db, 'usuarios', usuario.id), payload);
      const atualizado: Usuario = {
        ...usuario,
        ...payload,
      };

      this.setUsuarioAtual(atualizado);
      this.sincronizarPerfilForm(atualizado);
      await this.carregarMeuServico();
      await this.carregarConversas();
      this.showSuccess('Perfil atualizado com sucesso.');
    });
  }

  protected async salvarServico(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();
      const usuario = this.usuarioAtual();
      if (!usuario || (usuario.perfil !== 'vendedor' && usuario.perfil !== 'admin')) {
        this.showError('Apenas vendedor pode cadastrar servico.');
        return;
      }

      if (!this.servicoForm.titulo || !this.servicoForm.categoria || !this.servicoForm.descricao) {
        this.showError('Preencha titulo, categoria e descricao do servico.');
        return;
      }

      const agora = Date.now();
      const existente = this.meuServico();

      if (!existente) {
        const meusServicosSnap = await getDocs(
          query(collection(this.db, 'servicos'), where('vendedorId', '==', usuario.id))
        );
        if (meusServicosSnap.docs.length >= 1) {
          this.showError('Cada vendedor pode ter somente 1 servico.');
          await this.carregarMeuServico();
          return;
        }

        const novoServico: Omit<Servico, 'id'> = {
          vendedorId: usuario.id,
          titulo: this.servicoForm.titulo.trim(),
          categoria: this.servicoForm.categoria.trim(),
          descricao: this.servicoForm.descricao.trim(),
          ...(this.fotoServicoBase64 ? { fotoServicoBase64: this.fotoServicoBase64 } : {}),
          createdAt: agora,
          updatedAt: agora,
        };

        const ref = await addDoc(collection(this.db, 'servicos'), novoServico);
        this.meuServico.set({ id: ref.id, ...novoServico });
        this.showSuccess('Servico cadastrado com sucesso.');
      } else {
        const payload: Partial<Servico> = {
          titulo: this.servicoForm.titulo.trim(),
          categoria: this.servicoForm.categoria.trim(),
          descricao: this.servicoForm.descricao.trim(),
          updatedAt: agora,
        };
        if (this.fotoServicoBase64) {
          payload.fotoServicoBase64 = this.fotoServicoBase64;
        }

        await updateDoc(doc(this.db, 'servicos', existente.id), payload);
        this.meuServico.set({ ...existente, ...payload });
        this.showSuccess('Servico atualizado com sucesso.');
      }

      this.sincronizarServicoForm();
      await this.carregarServicos();
    });
  }

  protected async excluirMeuServico(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();
      const servico = this.meuServico();
      if (!servico) {
        this.showError('Nenhum servico para excluir.');
        return;
      }

      await deleteDoc(doc(this.db, 'servicos', servico.id));
      this.meuServico.set(null);
      this.servicoForm.titulo = '';
      this.servicoForm.categoria = '';
      this.servicoForm.descricao = '';
      this.fotoServicoBase64 = '';
      await this.carregarServicos();
      this.showSuccess('Servico removido com sucesso.');
    });
  }

  protected async iniciarConversaPorServico(servico: Servico): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();

      const usuario = this.usuarioAtual();
      if (!usuario) {
        this.showError('Entre na conta para enviar mensagem ao vendedor.');
        this.telaAtual.set('login');
        return;
      }

      if (usuario.perfil !== 'cliente' && usuario.perfil !== 'admin') {
        this.showError('Somente cliente pode iniciar conversa com vendedor.');
        return;
      }

      if (servico.vendedorId === usuario.id) {
        this.showError('Nao e possivel iniciar conversa com seu proprio servico.');
        return;
      }

      const conversaId = `${usuario.id}_${servico.id}`;
      const agora = Date.now();
      const conversaRef = doc(this.db, 'conversas', conversaId);
      const conversaSnap = await getDoc(conversaRef);

      if (!conversaSnap.exists()) {
        await setDoc(conversaRef, {
          clienteId: usuario.id,
          vendedorId: servico.vendedorId,
          servicoId: servico.id,
          createdAt: agora,
          updatedAt: agora,
          lastMessageAt: 0,
        } satisfies Omit<Conversa, 'id'>);
      }

      await this.carregarConversas();
      const resumo = this.conversas().find((item) => item.conversa.id === conversaId);
      if (resumo) {
        await this.abrirConversa(resumo);
        this.telaAtual.set('chat');
      }
    });
  }

  protected async abrirConversa(resumo: ConversaResumo): Promise<void> {
    await this.withLoading(async () => {
      this.conversaSelecionada.set(resumo);
      await this.carregarMensagens(resumo.conversa.id);
      this.telaAtual.set('chat');
    });
  }

  protected async enviarMensagem(): Promise<void> {
    await this.withLoading(async () => {
      this.limparMensagensUi();
      const usuario = this.usuarioAtual();
      const conversa = this.conversaSelecionada();

      if (!usuario || !conversa) {
        this.showError('Selecione uma conversa para enviar mensagem.');
        return;
      }

      const textoLimpo = this.mensagemTexto.trim();
      if (!textoLimpo) {
        this.showError('Digite a mensagem antes de enviar.');
        return;
      }

      const agora = Date.now();
      await addDoc(collection(this.db, 'conversas', conversa.conversa.id, 'mensagens'), {
        remetenteId: usuario.id,
        texto: textoLimpo,
        createdAt: agora,
      } satisfies Omit<Mensagem, 'id'>);

      await updateDoc(doc(this.db, 'conversas', conversa.conversa.id), {
        updatedAt: agora,
        lastMessageAt: agora,
      } satisfies Partial<Conversa>);

      this.mensagemTexto = '';
      await this.carregarMensagens(conversa.conversa.id);
      await this.carregarConversas();
    });
  }

  protected async recarregarHome(): Promise<void> {
    await this.withLoading(async () => {
      await this.carregarServicos();
    });
  }

  protected async carregarConversasTela(): Promise<void> {
    await this.withLoading(async () => {
      await this.carregarConversas();
    });
  }

  protected async abrirChat(): Promise<void> {
    await this.carregarConversasTela();
    this.telaAtual.set('chat');
  }

  protected async onFotoPerfilSelecionada(event: Event): Promise<void> {
    const arquivo = this.getArquivo(event);
    if (!arquivo) {
      return;
    }

    try {
      this.fotoPerfilBase64 = await this.gerarImagemLeveBase64(arquivo, 420, 0.72);
    } catch {
      this.showError('Nao foi possivel processar a foto de perfil. Use outra imagem.');
    }
  }

  protected async onFotoServicoSelecionada(event: Event): Promise<void> {
    const arquivo = this.getArquivo(event);
    if (!arquivo) {
      return;
    }

    try {
      this.fotoServicoBase64 = await this.gerarImagemLeveBase64(arquivo, 640, 0.74);
    } catch {
      this.showError('Nao foi possivel processar a foto do servico. Use outra imagem.');
    }
  }

  protected fecharToast(id: number): void {
    this.toasts.set(this.toasts().filter((toast) => toast.id !== id));

    const timer = this.toastTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
  }

  protected previewFotoPerfil(): string {
    return this.fotoPerfilBase64 || this.usuarioAtual()?.fotoPerfilBase64 || '';
  }

  protected previewFotoServico(): string {
    return this.fotoServicoBase64 || this.meuServico()?.fotoServicoBase64 || '';
  }

  protected ehMeuServico(servico: Servico): boolean {
    const usuario = this.usuarioAtual();
    return !!usuario && servico.vendedorId === usuario.id;
  }

  protected podeEnviarMensagemParaServico(servico: Servico): boolean {
    const usuario = this.usuarioAtual();

    if (!usuario) {
      return true;
    }

    if (this.ehMeuServico(servico)) {
      return false;
    }

    return usuario.perfil === 'cliente' || usuario.perfil === 'admin';
  }

  protected nomeRemetente(remetenteId: string): string {
    const usuario = this.usuarioAtual();
    if (!usuario) {
      return 'Usuario';
    }

    return remetenteId === usuario.id ? 'Voce' : this.conversaSelecionada()?.outroNome || 'Contato';
  }

  protected dataMensagem(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  private async restaurarSessao(): Promise<void> {
    const savedId = localStorage.getItem('boca_a_boca_session_user');
    if (!savedId) {
      return;
    }

    const snap = await getDoc(doc(this.db, 'usuarios', savedId));
    if (!snap.exists()) {
      localStorage.removeItem('boca_a_boca_session_user');
      return;
    }

    const usuario = this.usuarioFromDoc(snap.id, snap.data());
    this.setUsuarioAtual(usuario);
    this.sincronizarPerfilForm(usuario);
    await this.carregarMeuServico();
    await this.carregarConversas();
  }

  private async buscarUsuarioPorEmail(email: string): Promise<Usuario | null> {
    const snap = await getDocs(query(collection(this.db, 'usuarios'), where('email', '==', email)));
    const first = snap.docs[0];
    if (!first) {
      return null;
    }

    return this.usuarioFromDoc(first.id, first.data());
  }

  private async carregarServicos(): Promise<void> {
    const snap = await getDocs(collection(this.db, 'servicos'));
    const lista = snap.docs
      .map((docSnap) => this.servicoFromDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    this.servicos.set(lista);

    await this.carregarMeuServico();
  }

  private async carregarMeuServico(): Promise<void> {
    const usuario = this.usuarioAtual();
    if (!usuario || (usuario.perfil !== 'vendedor' && usuario.perfil !== 'admin')) {
      this.meuServico.set(null);
      return;
    }

    const snap = await getDocs(query(collection(this.db, 'servicos'), where('vendedorId', '==', usuario.id)));
    const primeiro = snap.docs[0];
    if (!primeiro) {
      this.meuServico.set(null);
      return;
    }

    this.meuServico.set(this.servicoFromDoc(primeiro.id, primeiro.data()));
    this.sincronizarServicoForm();
  }

  private async carregarConversas(): Promise<void> {
    const usuario = this.usuarioAtual();
    if (!usuario) {
      this.conversas.set([]);
      this.conversaSelecionada.set(null);
      this.mensagens.set([]);
      return;
    }

    const campoFiltro = usuario.perfil === 'vendedor' ? 'vendedorId' : 'clienteId';
    const snap = await getDocs(query(collection(this.db, 'conversas'), where(campoFiltro, '==', usuario.id)));

    const servicosCache = new Map<string, Servico>();
    for (const servico of this.servicos()) {
      servicosCache.set(servico.id, servico);
    }

    const resumoLista: ConversaResumo[] = [];
    for (const item of snap.docs) {
      const conversa = this.conversaFromDoc(item.id, item.data());
      const outroId = usuario.id === conversa.clienteId ? conversa.vendedorId : conversa.clienteId;
      const outroSnap = await getDoc(doc(this.db, 'usuarios', outroId));
      const outroNome = outroSnap.exists() ? (outroSnap.data()['nome'] as string) : 'Contato';

      let servico = servicosCache.get(conversa.servicoId);
      if (!servico) {
        const servicoSnap = await getDoc(doc(this.db, 'servicos', conversa.servicoId));
        if (servicoSnap.exists()) {
          servico = this.servicoFromDoc(servicoSnap.id, servicoSnap.data());
          servicosCache.set(servico.id, servico);
        }
      }

      resumoLista.push({
        conversa,
        outroNome,
        servicoTitulo: servico?.titulo || 'Servico removido',
      });
    }

    resumoLista.sort((a, b) => b.conversa.lastMessageAt - a.conversa.lastMessageAt);
    this.conversas.set(resumoLista);

    const selecionada = this.conversaSelecionada();
    if (selecionada) {
      const atualizada = resumoLista.find((item) => item.conversa.id === selecionada.conversa.id);
      if (atualizada) {
        this.conversaSelecionada.set(atualizada);
      }
    }
  }

  private async carregarMensagens(conversaId: string): Promise<void> {
    const snap = await getDocs(collection(this.db, 'conversas', conversaId, 'mensagens'));
    const lista = snap.docs
      .map((docSnap) => this.mensagemFromDoc(docSnap.id, docSnap.data()))
      .sort((a, b) => a.createdAt - b.createdAt);
    this.mensagens.set(lista);
  }

  private usuarioFromDoc(id: string, data: Record<string, unknown>): Usuario {
    return {
      id,
      nome: (data['nome'] as string) || '',
      email: (data['email'] as string) || '',
      perfil: ((data['perfil'] as Perfil) || 'cliente'),
      passwordHash: (data['passwordHash'] as string) || '',
      fotoPerfilBase64: (data['fotoPerfilBase64'] as string) || '',
      createdAt: Number(data['createdAt'] || Date.now()),
      updatedAt: Number(data['updatedAt'] || Date.now()),
    };
  }

  private servicoFromDoc(id: string, data: Record<string, unknown>): Servico {
    return {
      id,
      vendedorId: (data['vendedorId'] as string) || '',
      titulo: (data['titulo'] as string) || '',
      categoria: (data['categoria'] as string) || '',
      descricao: (data['descricao'] as string) || '',
      fotoServicoBase64: (data['fotoServicoBase64'] as string) || '',
      createdAt: Number(data['createdAt'] || Date.now()),
      updatedAt: Number(data['updatedAt'] || Date.now()),
    };
  }

  private conversaFromDoc(id: string, data: Record<string, unknown>): Conversa {
    return {
      id,
      clienteId: (data['clienteId'] as string) || '',
      vendedorId: (data['vendedorId'] as string) || '',
      servicoId: (data['servicoId'] as string) || '',
      createdAt: Number(data['createdAt'] || Date.now()),
      updatedAt: Number(data['updatedAt'] || Date.now()),
      lastMessageAt: Number(data['lastMessageAt'] || 0),
    };
  }

  private mensagemFromDoc(id: string, data: Record<string, unknown>): Mensagem {
    return {
      id,
      remetenteId: (data['remetenteId'] as string) || '',
      texto: (data['texto'] as string) || '',
      createdAt: Number(data['createdAt'] || Date.now()),
    };
  }

  private resetCadastroForm(): void {
    this.cadastroForm.nome = '';
    this.cadastroForm.email = '';
    this.cadastroForm.password = '';
    this.cadastroForm.perfil = 'cliente';
    this.fotoPerfilBase64 = '';
  }

  private resetLoginForm(): void {
    this.loginForm.email = '';
    this.loginForm.password = '';
  }

  private sincronizarPerfilForm(usuario: Usuario): void {
    this.perfilForm.nome = usuario.nome;
    this.perfilForm.perfil = usuario.perfil;
    this.fotoPerfilBase64 = usuario.fotoPerfilBase64 || '';
  }

  private sincronizarServicoForm(): void {
    const servico = this.meuServico();
    if (!servico) {
      this.servicoForm.titulo = '';
      this.servicoForm.categoria = '';
      this.servicoForm.descricao = '';
      this.fotoServicoBase64 = '';
      return;
    }

    this.servicoForm.titulo = servico.titulo;
    this.servicoForm.categoria = servico.categoria;
    this.servicoForm.descricao = servico.descricao;
    this.fotoServicoBase64 = servico.fotoServicoBase64 || '';
  }

  private setUsuarioAtual(usuario: Usuario): void {
    this.usuarioAtual.set(usuario);
    localStorage.setItem('boca_a_boca_session_user', usuario.id);
  }

  private limparMensagensUi(): void {
    this.error.set(null);
    this.sucesso.set(null);
  }

  private showError(mensagem: string): void {
    const amigavel = this.normalizarMensagemErro(mensagem);
    this.error.set(amigavel);
    this.criarToast('error', amigavel);
  }

  private showSuccess(mensagem: string): void {
    this.sucesso.set(mensagem);
    this.criarToast('success', mensagem);
  }

  private normalizarMensagemErro(mensagem: string): string {
    const texto = (mensagem || '').trim();
    const lower = texto.toLowerCase();

    if (lower.includes('unsupported field value: undefined')) {
      return 'Falha ao salvar os dados. Alguns campos opcionais vieram invalidos.';
    }

    if (lower.includes('permission') || lower.includes('insufficient')) {
      return 'Sem permissao para executar esta acao no Firebase.';
    }

    if (lower.includes('network') || lower.includes('offline')) {
      return 'Falha de conexao. Verifique sua internet e tente novamente.';
    }

    return texto || 'Falha inesperada. Tente novamente.';
  }

  private criarToast(tipo: ToastTipo, texto: string): void {
    if (!texto) {
      return;
    }

    const id = ++this.toastSequence;
    this.toasts.set([...this.toasts(), { id, tipo, texto }]);

    const timerId = window.setTimeout(() => {
      this.fecharToast(id);
    }, 5200);

    this.toastTimers.set(id, timerId);
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async withLoading(run: () => Promise<void>): Promise<void> {
    this.loadingCount.set(this.loadingCount() + 1);
    try {
      await run();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : 'Falha inesperada.');
    } finally {
      this.loadingCount.set(Math.max(0, this.loadingCount() - 1));
    }
  }

  private getArquivo(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] || null;
    if (input) {
      input.value = '';
    }
    return arquivo;
  }

  private async gerarImagemLeveBase64(file: File, maxSize: number, quality: number): Promise<string> {
    const dataUrl = await this.fileToDataUrl(file);
    return this.resizeDataUrl(dataUrl, maxSize, quality);
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo de imagem.'));
      reader.readAsDataURL(file);
    });
  }

  private async resizeDataUrl(dataUrl: string, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.floor(image.width * ratio);
        const height = Math.floor(image.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Nao foi possivel processar a imagem.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = () => reject(new Error('Imagem invalida.'));
      image.src = dataUrl;
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
