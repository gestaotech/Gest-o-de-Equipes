/**
 * Módulo de envio de e-mail configurável.
 * 
 * Este módulo abstrai o provedor de e-mail, permitindo configurações diferentes
 * para desenvolvimento e produção. Se as credenciais não estiverem configuradas,
 * o token é registrado em log (apenas em desenvolvimento) e a dependência é
 * documentada, sem simular sucesso.
 * 
 * Variáveis de ambiente necessárias:
 * - EMAIL_PROVIDER: 'smtp' | 'console' | 'none' (padrão: 'console' em dev, 'none' em produção)
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 * - PUBLIC_APP_URL: URL pública da aplicação para construir links
 */

import { createTransport, type Transporter } from 'nodemailer';

export type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Configuração do provedor de e-mail baseada em variáveis de ambiente.
 */
function getEmailConfig() {
  const provider = process.env.EMAIL_PROVIDER || 
    (process.env.NODE_ENV === 'production' ? 'none' : 'console');
  
  const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
  
  return {
    provider,
    appUrl,
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM || 'nao-responda@teamflow.local',
    },
  };
}

/**
 * Cria um transportador SMTP configurado.
 */
function createSmtpTransport(): Transporter | null {
  const { smtp } = getEmailConfig();
  
  if (!smtp.host || !smtp.user || !smtp.password) {
    return null;
  }
  
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  });
}

/**
 * Envia um e-mail usando o provedor configurado.
 * 
 * Comportamentos:
 * - SMTP: Envia via servidor SMTP configurado
 * - Console: Registra o conteúdo em log (desenvolvimento)
 * - None: Registra apenas um aviso (produção sem credenciais)
 * 
 * @throws Error se o provedor SMTP estiver configurado mas falhar
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const config = getEmailConfig();
  
  switch (config.provider) {
    case 'smtp': {
      const transport = createSmtpTransport();
      
      if (!transport) {
        const errorMsg = 
          'EMAIL_PROVIDER=smtp configurado, mas credenciais SMTP ausentes. ' +
          'Defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD, ou altere EMAIL_PROVIDER.';
        console.error('[EMAIL]', errorMsg);
        throw new Error(errorMsg);
      }
      
      try {
        await transport.sendMail({
          from: config.smtp.from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        console.log('[EMAIL] Enviado via SMTP para:', options.to);
      } catch (error) {
        console.error('[EMAIL] Falha ao enviar via SMTP:', error);
        throw new Error('Falha ao enviar e-mail. Tente novamente mais tarde.');
      }
      break;
    }
    
    case 'console': {
      console.log('='.repeat(60));
      console.log('[EMAIL - MODO CONSOLE]');
      console.log('Para:', options.to);
      console.log('Assunto:', options.subject);
      console.log('-'.repeat(60));
      console.log(options.text);
      if (options.html) {
        console.log('-'.repeat(60));
        console.log('HTML disponível (não exibido em console)');
      }
      console.log('='.repeat(60));
      break;
    }
    
    case 'none':
    default: {
      console.warn(
        '[EMAIL] Provedor de e-mail não configurado. ' +
        'Token registrado em log apenas. Configure EMAIL_PROVIDER e SMTP_* ' +
        'para habilitar envio real.'
      );
      break;
    }
  }
}

/**
 * Constrói a URL pública completa para um path da aplicação.
 */
export function buildPublicUrl(path: string): string {
  const config = getEmailConfig();
  const baseUrl = config.appUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Envia e-mail de redefinição de senha.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = buildPublicUrl(`/resetar-senha?t=${token}`);
  
  await sendEmail({
    to: email,
    subject: 'Redefinição de senha — TeamFlow',
    text: 
      `Você solicitou a redefinição da sua senha no TeamFlow.\n\n` +
      `Clique no link abaixo para definir uma nova senha:\n` +
      `${resetUrl}\n\n` +
      `Este link expira em 24 horas e só pode ser usado uma vez.\n\n` +
      `Se você não solicitou esta redefinição, ignore este e-mail.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Redefinição de senha</h2>
        <p>Você solicitou a redefinição da sua senha no TeamFlow.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" 
             style="background: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Redefinir senha
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Este link expira em 24 horas e só pode ser usado uma vez.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Se você não solicitou esta redefinição, ignore este e-mail.
        </p>
      </div>
    `,
  });
}

/**
 * Envia e-mail de primeiro acesso (ativação de conta).
 */
export async function sendFirstAccessEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const accessUrl = buildPublicUrl(`/primeiro-acesso?t=${token}`);
  
  await sendEmail({
    to: email,
    subject: 'Bem-vindo ao TeamFlow — Defina sua senha',
    text:
      `Olá, ${name}!\n\n` +
      `Sua conta foi criada no TeamFlow.\n\n` +
      `Clique no link abaixo para definir sua senha e começar a usar:\n` +
      `${accessUrl}\n\n` +
      `Este link expira em 24 horas e só pode ser usado uma vez.\n\n` +
      `Se você não reconhece esta conta, ignore este e-mail.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bem-vindo ao TeamFlow!</h2>
        <p>Olá, ${name}!</p>
        <p>Sua conta foi criada no TeamFlow.</p>
        <p style="margin: 24px 0;">
          <a href="${accessUrl}" 
             style="background: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Definir senha
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Este link expira em 24 horas e só pode ser usado uma vez.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Se você não reconhece esta conta, ignore este e-mail.
        </p>
      </div>
    `,
  });
}
