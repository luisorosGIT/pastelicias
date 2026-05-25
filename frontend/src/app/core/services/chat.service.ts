import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, SupportConversation, SupportMessage } from '../models';

interface FetchResult {
  conversation: SupportConversation;
  messages: SupportMessage[];
}

interface DeltaResult {
  messages: SupportMessage[];
  unreadCount: number;
}

const POLL_INTERVAL_MS = 4000;

/**
 * Servicio del chat de soporte (Pro/Business).
 *
 * Estrategia: cuando el widget está abierto hacemos polling cada 4s para traer
 * mensajes nuevos desde el último. Cuando el widget está cerrado el polling se
 * detiene para no gastar requests innecesarios.
 *
 * El conteo de mensajes no leídos lo refrescamos en cada poll y también al
 * abrir el widget — así el usuario ve el badge al volver a la app.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly url = `${environment.apiUrl}/support`;

  // ─── State ──────────────────────────────────────────────────────────────────
  private _conversation = signal<SupportConversation | null>(null);
  private _messages = signal<SupportMessage[]>([]);
  private _unreadCount = signal(0);
  private _loading = signal(false);
  private _sending = signal(false);
  /** 'OK' | 'UPGRADE_REQUIRED' | null cuando aún no se intentó. */
  private _status = signal<'OK' | 'UPGRADE_REQUIRED' | null>(null);
  private _error = signal('');

  readonly conversation = this._conversation.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly sending = this._sending.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  readonly upgradeRequired = computed(() => this._status() === 'UPGRADE_REQUIRED');

  // ─── Polling ────────────────────────────────────────────────────────────────
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastFetchAt = 0; // timestamp ms del último mensaje recibido

  constructor(private http: HttpClient) {}

  /** Carga inicial: trae la conversación + todos los mensajes. */
  async loadInitial(): Promise<void> {
    this._loading.set(true);
    this._error.set('');
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<FetchResult>>(`${this.url}/conversation`)
      );
      if (res.success && res.data) {
        this._conversation.set(res.data.conversation);
        this._messages.set(res.data.messages);
        const last = res.data.messages[res.data.messages.length - 1];
        this.lastFetchAt = last ? new Date(last.createdAt).getTime() : Date.now();
        this._status.set('OK');
        // Cuenta los no leídos en el inicial
        this._unreadCount.set(
          res.data.messages.filter((m) => m.senderRole === 'ADMIN' && !m.isReadByUser).length
        );
      }
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 402) {
          this._status.set('UPGRADE_REQUIRED');
        } else {
          this._error.set('No pudimos cargar el chat. Intenta de nuevo.');
        }
      }
    } finally {
      this._loading.set(false);
    }
  }

  /** Envia un mensaje del USER. Optimistic: lo agrega antes de la respuesta. */
  async send(content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed || this._sending()) return;

    this._sending.set(true);
    this._error.set('');
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<SupportMessage>>(`${this.url}/messages`, {
          content: trimmed,
        })
      );
      if (res.success && res.data) {
        // Agrega el mensaje al final
        this._messages.update((list) => [...list, res.data!]);
        this.lastFetchAt = new Date(res.data.createdAt).getTime();
      }
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 402) {
        this._status.set('UPGRADE_REQUIRED');
      } else {
        this._error.set('No pudimos enviar el mensaje.');
      }
    } finally {
      this._sending.set(false);
    }
  }

  /** Marca todos los mensajes ADMIN como leídos por el user. */
  async markAllRead(): Promise<void> {
    if (this._unreadCount() === 0) return;
    try {
      await firstValueFrom(this.http.post(`${this.url}/read`, {}));
      this._unreadCount.set(0);
      this._messages.update((list) =>
        list.map((m) =>
          m.senderRole === 'ADMIN' && !m.isReadByUser ? { ...m, isReadByUser: true } : m
        )
      );
    } catch {
      // Silent — no es crítico
    }
  }

  /** Polling: trae solo mensajes nuevos desde `lastFetchAt`. */
  private async fetchDelta(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<DeltaResult>>(
          `${this.url}/conversation/messages?since=${this.lastFetchAt}`
        )
      );
      if (res.success && res.data) {
        const newMsgs = res.data.messages;
        if (newMsgs.length > 0) {
          this._messages.update((list) => [...list, ...newMsgs]);
          const last = newMsgs[newMsgs.length - 1];
          this.lastFetchAt = new Date(last.createdAt).getTime();
        }
        this._unreadCount.set(res.data.unreadCount);
      }
    } catch {
      // Silent: no spamear errores en polling
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.fetchDelta(), POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Limpia todo (llamado en logout). */
  reset(): void {
    this.stopPolling();
    this._conversation.set(null);
    this._messages.set([]);
    this._unreadCount.set(0);
    this._status.set(null);
    this.lastFetchAt = 0;
  }
}
