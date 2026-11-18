import { getApps, initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

// Configuração pública do aplicativo; a autorização depende das regras e do token.
const app =
  getApps()[0] ??
  initializeApp({
    projectId: 'homephysio-virtualter',
    appId: '1:103403442423:web:3ca980868a72dd620203f2',
    apiKey: 'AIzaSyDS3mn_hGEaOnqm8SXwmNpF67UTN5HBgBE',
    authDomain: 'homephysio-virtualter.firebaseapp.com',
  });
export const auth = getAuth(app);
// Localiza os e-mails de verificação e recuperação enviados por este cliente.
auth.languageCode = 'pt-BR';

const ready = setPersistence(auth, browserSessionPersistence);

function accessError(code: string | undefined, error: unknown): string {
  const messages: Record<string, string> = {
    'auth/invalid-credential':
      'E-mail ou senha incorretos. Confira os dados ou recupere sua senha.',
    'auth/wrong-password':
      'E-mail ou senha incorretos. Confira os dados ou recupere sua senha.',
    'auth/user-not-found':
      'E-mail ou senha incorretos. Confira os dados ou recupere sua senha.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/email-already-in-use':
      'Não foi possível criar a conta com esse e-mail. Tente entrar ou recuperar a senha.',
    'auth/weak-password':
      'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
    'auth/password-does-not-meet-requirements':
      'A senha não atende aos requisitos de segurança. Use uma senha mais forte.',
    'auth/too-many-requests':
      'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.',
    'auth/network-request-failed':
      'Não foi possível conectar. Confira sua conexão e tente novamente.',
    'auth/operation-not-allowed':
      'O acesso por e-mail está indisponível no momento.',
    'permission-denied':
      'Ação não autorizada. Confirme seu e-mail e confira o vínculo da conta.',
  };
  return code
    ? (messages[code] ??
        'Não foi possível concluir. Tente novamente em instantes.')
    : error instanceof Error
      ? error.message
      : 'Não foi possível concluir. Tente novamente.';
}

/** A mesma tela de conta é usada no painel e no cliente dos jogos. */
class HomephysioAccount extends HTMLElement {
  private unsubscribe?: () => void;
  private pending = false;
  private shownUid: string | null = null;
  private mode: 'login' | 'register' | 'reset' = 'login';
  connectedCallback() {
    if (this.shadowRoot) {
      this.unsubscribe = onAuthStateChanged(auth, () => this.showUser());
      return;
    }
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{display:block;margin:1rem 0;color:#183931;font:15px/1.5 system-ui}*{box-sizing:border-box}
      section{padding:clamp(20px,4vw,32px);border:1px solid #dce9e1;border-radius:16px;background:white}
      section.guest{max-width:460px;margin:32px auto}h2{font-size:27px;line-height:1.2;margin:0 0 8px;letter-spacing:-.6px}
      p{overflow-wrap:anywhere;margin:8px 0 18px}.muted{color:#5d7168;font-size:14px}
      label{display:block;margin:16px 0 6px;font-weight:600}input{padding:12px;border:1px solid #aebfb5;border-radius:8px;width:100%;font:inherit;background:#fff;color:inherit}
      button{padding:11px 16px;border:1px solid #cbded3;border-radius:8px;background:white;color:#245940;font:inherit;cursor:pointer}button.primary{background:#246c52;color:white;border-color:#246c52;width:100%;font-weight:650;margin-top:20px}
      button.link{border:0;padding:8px 0;background:none;text-decoration:underline}button:disabled{opacity:.6;cursor:wait}
      :is(input,button,summary):focus-visible{outline:3px solid #619b7a;outline-offset:3px}.actions{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0}.password{display:flex;gap:8px}.password input{min-width:0}.password button{white-space:nowrap}
      #message:not(:empty){border-radius:8px;padding:12px;background:#edf6ef}#message[data-error=true]{background:#fff0ec;color:#8b3023}#verification{padding:16px;background:#fff8e8;border-radius:10px;margin:16px 0}
      details{margin-top:12px}summary{cursor:pointer;font-weight:600}#identity{margin-bottom:12px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:start}[hidden]{display:none!important}
      </style>
      <section class="guest"><div class="heading"><h2 id="title">Acesse sua conta</h2><button id="logout" hidden>Sair</button></div><p id="identity" class="muted">Verificando acesso...</p>
      <form hidden><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>
      <div id="password-fields"><label for="password">Senha</label><div class="password"><input id="password" name="password" type="password" autocomplete="current-password" required><button type="button" id="toggle-password" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div><small id="password-hint" class="muted" hidden>Use pelo menos 8 caracteres.</small></div>
      <div id="confirmation" hidden><label for="confirm-password">Confirme a senha</label><input id="confirm-password" name="confirmation" type="password" autocomplete="new-password"></div>
      <button class="primary" id="submit" type="submit">Entrar</button><div class="actions"><button class="link" type="button" id="register">Criar uma conta</button><button class="link" type="button" id="reset">Esqueci minha senha</button><button class="link" type="button" id="back" hidden>Voltar para entrar</button></div></form>
      <div id="signed" hidden><div id="verification"><strong>Confirme seu e-mail</strong><p>Abra o link de verificação enviado ao seu e-mail. Depois, volte aqui para confirmar. Verifique também a pasta de spam.</p><div class="actions"><button id="refresh">Já confirmei meu e-mail</button><button id="verify">Reenviar e-mail</button></div></div>
      </div><p role="status" aria-live="polite" id="message" tabindex="-1"></p></section>`;
    const form = root.querySelector('form')!;
    const email = () =>
      (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = () =>
      (form.elements.namedItem('password') as HTMLInputElement).value;
    const run = async (action: () => Promise<unknown>, message = '') => {
      if (this.pending) return;
      this.pending = true;
      const status = root.querySelector<HTMLElement>('#message')!;
      status.dataset['error'] = 'false';
      status.textContent = 'Aguarde...';
      form.setAttribute('aria-busy', 'true');
      root.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        await ready;
        await action();
        this.showUser();
        root.querySelector('#message')!.textContent = message;
      } catch (error) {
        this.showUser();
        const code = (error as { code?: string }).code;
        status.dataset['error'] = 'true';
        status.textContent = accessError(code, error);
      } finally {
        this.pending = false;
        form.setAttribute('aria-busy', 'false');
        root.querySelectorAll('button').forEach((b) => (b.disabled = false));
        this.showUser();
        status.focus();
      }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity() || this.pending) return;
      if (this.mode === 'reset') {
        void run(
          () => sendPasswordResetEmail(auth, email()),
          'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também o spam. Depois, volte para entrar.'
        );
        return;
      }
      if (this.mode === 'login') {
        void run(() => signInWithEmailAndPassword(auth, email(), password()));
        return;
      }
      if (
        password() !==
        (form.elements.namedItem('confirmation') as HTMLInputElement).value
      ) {
        const status = root.querySelector<HTMLElement>('#message')!;
        status.dataset['error'] = 'true';
        status.textContent = 'As senhas precisam ser iguais.';
        (form.elements.namedItem('confirmation') as HTMLInputElement).focus();
        return;
      }
      void run(async () => {
        const result = await createUserWithEmailAndPassword(
          auth,
          email(),
          password()
        );
        try {
          await sendEmailVerification(result.user);
        } catch {
          throw new Error(
            'Conta criada, mas o e-mail de verificação não pôde ser enviado. Use “Reenviar e-mail”.'
          );
        }
      }, 'Conta criada. Abra seu e-mail para confirmar o cadastro.');
    });
    root
      .querySelector('#register')!
      .addEventListener('click', () => this.setMode('register'));
    root
      .querySelector('#reset')!
      .addEventListener('click', () => this.setMode('reset'));
    root
      .querySelector('#back')!
      .addEventListener('click', () => this.setMode('login'));
    root.querySelector('#toggle-password')!.addEventListener('click', () => {
      const input = form.elements.namedItem('password') as HTMLInputElement;
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      const button = root.querySelector('#toggle-password')!;
      button.textContent = visible ? 'Ocultar' : 'Mostrar';
      button.setAttribute(
        'aria-label',
        visible ? 'Ocultar senha' : 'Mostrar senha'
      );
      button.setAttribute('aria-pressed', String(visible));
    });
    root
      .querySelector('#logout')!
      .addEventListener('click', () => void run(() => signOut(auth)));
    root.querySelector('#verify')!.addEventListener(
      'click',
      () =>
        void run(async () => {
          if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        }, 'Verificação solicitada. Confira seu e-mail.')
    );
    root.querySelector('#refresh')!.addEventListener(
      'click',
      () =>
        void run(async () => {
          await auth.currentUser?.reload();
          await auth.currentUser?.getIdToken(true);
          if (!auth.currentUser?.emailVerified)
            throw new Error(
              'Seu e-mail ainda não foi confirmado. Abra o link recebido e tente novamente.'
            );
        }, 'E-mail confirmado.')
    );
    this.unsubscribe = onAuthStateChanged(auth, () => this.showUser());
    void ready.catch(() => {
      root.querySelector('#message')!.textContent =
        'Não foi possível preparar o acesso neste navegador.';
    });
  }
  private setMode(mode: 'login' | 'register' | 'reset') {
    if (this.pending) return;
    this.mode = mode;
    const root = this.shadowRoot!;
    for (const name of ['password', 'confirmation'])
      (root.querySelector(`[name="${name}"]`) as HTMLInputElement).value = '';
    (root.querySelector('[name="password"]') as HTMLInputElement).type =
      'password';
    root.querySelector('#toggle-password')!.textContent = 'Mostrar';
    root
      .querySelector('#toggle-password')!
      .setAttribute('aria-pressed', 'false');
    root
      .querySelector('#toggle-password')!
      .setAttribute('aria-label', 'Mostrar senha');
    root.querySelector('#message')!.textContent = '';
    this.showUser();
    (root.querySelector('#email') as HTMLInputElement).focus();
  }
  private showUser() {
    const root = this.shadowRoot!;
    const user = auth.currentUser;
    if (this.shownUid !== (user?.uid ?? null)) {
      this.shownUid = user?.uid ?? null;
      for (const name of ['password', 'confirmation'])
        (root.querySelector(`[name="${name}"]`) as HTMLInputElement).value = '';
      root.querySelector('#message')!.textContent = '';
      if (!user) this.mode = 'login';
    }
    const register = this.mode === 'register',
      reset = this.mode === 'reset';
    root.querySelector('section')!.classList.toggle('guest', !user);
    root.querySelector('#title')!.textContent = user
      ? 'Sua conta'
      : register
        ? 'Crie sua conta'
        : reset
          ? 'Recupere sua senha'
          : 'Acesse sua conta';
    root.querySelector('#submit')!.textContent = register
      ? 'Criar conta'
      : reset
        ? 'Enviar link de recuperação'
        : 'Entrar';
    (root.querySelector('#register') as HTMLElement).hidden =
      this.mode !== 'login';
    (root.querySelector('#reset') as HTMLElement).hidden =
      this.mode !== 'login';
    (root.querySelector('#back') as HTMLElement).hidden = this.mode === 'login';
    (root.querySelector('#password-fields') as HTMLElement).hidden = reset;
    (root.querySelector('#confirmation') as HTMLElement).hidden = !register;
    (root.querySelector('#password-hint') as HTMLElement).hidden = !register;
    const password = root.querySelector(
      '[name="password"]'
    ) as HTMLInputElement;
    password.disabled = reset;
    password.required = !reset;
    password.autocomplete = register ? 'new-password' : 'current-password';
    if (register) password.minLength = 8;
    else password.removeAttribute('minlength');
    const confirmation = root.querySelector(
      '[name="confirmation"]'
    ) as HTMLInputElement;
    confirmation.disabled = !register;
    confirmation.required = register;
    root.querySelector('form')!.hidden = !!user;
    (root.querySelector('#signed') as HTMLElement).hidden = !user;
    (root.querySelector('#verification') as HTMLElement).hidden =
      !!user?.emailVerified;
    (root.querySelector('#logout') as HTMLElement).hidden = !user;
    root.querySelector('#identity')!.textContent = user
      ? `${user.email} · ${user.emailVerified ? 'E-mail verificado' : 'Verificação pendente'}`
      : register
        ? 'Cadastre seu e-mail e escolha uma senha. Você receberá um link para confirmar o cadastro.'
        : reset
          ? 'Informe seu e-mail para receber um link de recuperação.'
          : 'Entre com seu e-mail e senha para continuar.';
  }
  disconnectedCallback() {
    this.unsubscribe?.();
  }
}
if (!customElements.get('homephysio-account'))
  customElements.define('homephysio-account', HomephysioAccount);
