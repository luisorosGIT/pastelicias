import {
  AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild, computed, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Widget flotante de chat de soporte (esquina inferior derecha).
 * Solo se renderiza si el user está autenticado y es OWNER.
 * Si el plan es Free, el panel muestra un CTA al upgrade en lugar del chat.
 *
 * Polling activo solo cuando el panel está abierto.
 */
@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    @if (visible()) {
      <!-- Botón flotante -->
      <button class="fab" (click)="togglePanel()" [class.open]="isOpen()" aria-label="Soporte">
        @if (!isOpen()) {
          <mat-icon>chat_bubble</mat-icon>
          @if (chat.unreadCount() > 0) {
            <span class="badge">{{ chat.unreadCount() > 9 ? '9+' : chat.unreadCount() }}</span>
          }
        } @else {
          <mat-icon>close</mat-icon>
        }
      </button>

      <!-- Panel -->
      @if (isOpen()) {
        <div class="panel">
          <header class="panel-header">
            <div class="header-info">
              <div class="header-avatar">
                <mat-icon>support_agent</mat-icon>
              </div>
              <div>
                <strong>Soporte Genimatech</strong>
                <span class="header-sub">
                  Te respondemos en horas hábiles (lun-sáb)
                </span>
              </div>
            </div>
          </header>

          <!-- Body -->
          <div class="panel-body" #scrollEl>
            @if (chat.loading()) {
              <div class="loading-state">
                <mat-spinner diameter="36" />
              </div>
            } @else if (chat.upgradeRequired()) {
              <!-- Free plan: bloqueo -->
              <div class="upgrade-state">
                <div class="upgrade-icon">
                  <mat-icon>workspace_premium</mat-icon>
                </div>
                <h3>Chat disponible en Pro y Business</h3>
                <p>
                  Recibe respuestas en horas hábiles directamente desde la app,
                  sin salir a otro canal.
                </p>
                <button class="upgrade-btn" (click)="goUpgrade()">
                  <mat-icon>auto_awesome</mat-icon>
                  <span>Ver planes</span>
                </button>
              </div>
            } @else if (chat.messages().length === 0) {
              <!-- Vacío: hello message -->
              <div class="empty-state">
                <div class="hello-bubble">
                  <strong>👋 ¡Hola!</strong>
                  <p>
                    Soy el equipo de Genimatech. Cuéntanos en qué te podemos
                    ayudar — un agente responderá en horas hábiles.
                  </p>
                </div>
              </div>
            } @else {
              @for (msg of chat.messages(); track msg.id) {
                <div class="message" [class.user]="msg.senderRole === 'USER'"
                     [class.admin]="msg.senderRole === 'ADMIN'">
                  @if (msg.senderRole === 'ADMIN') {
                    <div class="msg-avatar admin">
                      <mat-icon>support_agent</mat-icon>
                    </div>
                  }
                  <div class="msg-bubble">
                    @if (msg.senderRole === 'ADMIN' && msg.senderName) {
                      <span class="msg-sender">{{ msg.senderName }}</span>
                    }
                    <p class="msg-content">{{ msg.content }}</p>
                    <span class="msg-time">{{ msg.createdAt | date: 'HH:mm' }}</span>
                  </div>
                </div>
              }
            }
            @if (chat.error()) {
              <div class="error-banner">
                <mat-icon>error_outline</mat-icon>
                <span>{{ chat.error() }}</span>
              </div>
            }
          </div>

          <!-- Footer (input) -->
          @if (!chat.upgradeRequired()) {
            <form class="panel-footer" (ngSubmit)="send()">
              <textarea
                [(ngModel)]="draft"
                name="draft"
                placeholder="Escribe tu mensaje…"
                rows="1"
                (keydown.enter)="onEnter($event)"
                [disabled]="chat.sending()"
              ></textarea>
              <button type="submit"
                      class="send-btn"
                      [disabled]="!draft.trim() || chat.sending()"
                      aria-label="Enviar">
                @if (chat.sending()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <mat-icon>send</mat-icon>
                }
              </button>
            </form>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pop {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }

    /* ─── FAB ─── */
    .fab {
      position: fixed;
      bottom: 24px; right: 24px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 12px 32px -8px rgba(79, 70, 229, 0.5);
      z-index: 1000;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: pop 0.3s ease-out;
    }
    .fab:hover {
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 16px 40px -8px rgba(79, 70, 229, 0.6);
    }
    .fab mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .fab.open {
      background: #1f2937;
    }
    .badge {
      position: absolute;
      top: 6px; right: 6px;
      min-width: 20px; height: 20px;
      padding: 0 6px;
      background: #ef4444;
      color: #fff;
      border-radius: 100px;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }

    /* ─── Panel ─── */
    .panel {
      position: fixed;
      bottom: 96px; right: 24px;
      width: 380px;
      height: 540px;
      max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.3);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 999;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      animation: slideUp 0.25s ease-out;
    }
    @media (max-width: 480px) {
      .panel {
        bottom: 0; right: 0; left: 0;
        width: 100%;
        height: 80vh;
        border-radius: 20px 20px 0 0;
      }
    }

    /* Header */
    .panel-header {
      padding: 18px 20px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
    }
    .header-info {
      display: flex; align-items: center; gap: 12px;
    }
    .header-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .header-avatar mat-icon { font-size: 22px; width: 22px; height: 22px; color: #fff; }
    .header-info strong {
      display: block;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .header-sub {
      display: block;
      font-size: 12px;
      opacity: 0.85;
      margin-top: 2px;
    }

    /* Body */
    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex; flex-direction: column;
      gap: 12px;
      background: #f8fafc;
    }

    .loading-state, .upgrade-state, .empty-state {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center;
      padding: 16px;
    }
    .upgrade-icon {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .upgrade-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .upgrade-state h3 {
      font-size: 17px; font-weight: 700;
      margin: 0 0 8px 0;
      color: #1f2937;
    }
    .upgrade-state p {
      font-size: 14px; color: #64748b;
      line-height: 1.5; margin: 0 0 20px 0;
    }
    .upgrade-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0 22px; height: 42px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.4);
    }
    .upgrade-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .hello-bubble {
      background: #fff;
      padding: 16px 18px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      max-width: 280px;
    }
    .hello-bubble strong {
      display: block;
      font-size: 15px;
      margin-bottom: 6px;
      color: #1f2937;
    }
    .hello-bubble p {
      font-size: 14px; color: #475569;
      line-height: 1.5; margin: 0;
    }

    /* Mensajes */
    .message {
      display: flex;
      gap: 8px;
      max-width: 85%;
    }
    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .message.admin { align-self: flex-start; }

    .msg-avatar {
      flex-shrink: 0;
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .msg-avatar.admin {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
    }
    .msg-avatar mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .msg-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .message.user .msg-bubble {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
    }
    .msg-sender {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #4f46e5;
      margin-bottom: 4px;
    }
    .msg-content {
      font-size: 14px;
      line-height: 1.45;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg-time {
      display: block;
      font-size: 10.5px;
      opacity: 0.7;
      margin-top: 4px;
      text-align: right;
    }
    .message.user .msg-time { color: rgba(255, 255, 255, 0.9); }
    .message.admin .msg-time { color: #94a3b8; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 10px;
      font-size: 13px;
    }
    .error-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Footer (input) */
    .panel-footer {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 12px 16px;
      background: #fff;
      border-top: 1px solid #e5e7eb;
    }
    .panel-footer textarea {
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      font-size: 14px;
      color: #0f172a;
      font-family: inherit;
      resize: none;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .panel-footer textarea:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }
    .send-btn {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .send-btn:hover:not(:disabled) { transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .send-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `],
})
export class ChatWidgetComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('scrollEl') scrollEl?: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  draft = '';
  private lastMessageCount = 0;

  /** Solo se muestra si user autenticado y OWNER (otros roles no usan soporte). */
  visible = computed(() => {
    if (!this.authService.isAuthenticated()) return false;
    const u = this.authService.user();
    return u?.role === 'OWNER';
  });

  constructor(
    public chat: ChatService,
    private authService: AuthService,
    private router: Router,
  ) {}

  async togglePanel(): Promise<void> {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      // Primera apertura → load. Las siguientes solo activan polling.
      if (!this.chat.conversation() && this.chat.status() !== 'UPGRADE_REQUIRED') {
        await this.chat.loadInitial();
      }
      this.chat.startPolling();
      // Mark all read at open
      await this.chat.markAllRead();
    } else {
      this.chat.stopPolling();
    }
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    if (!content) return;
    this.draft = '';
    await this.chat.send(content);
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }

  goUpgrade(): void {
    this.isOpen.set(false);
    this.chat.stopPolling();
    this.router.navigate(['/app/upgrade']);
  }

  ngAfterViewChecked(): void {
    // Auto-scroll al final cuando lleguen mensajes nuevos
    const count = this.chat.messages().length;
    if (count !== this.lastMessageCount && this.scrollEl) {
      const el = this.scrollEl.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.lastMessageCount = count;
    }
  }

  ngOnDestroy(): void {
    this.chat.stopPolling();
  }
}
