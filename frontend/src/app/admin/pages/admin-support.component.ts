import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, SupportMessage } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

interface ConversationRow {
  id: string;
  businessId: string;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  business: { id: string; name: string; plan: 'FREE' | 'PRO' | 'BUSINESS' };
  user: { id: string; fullName: string; email: string };
  messages: SupportMessage[]; // último mensaje (preview)
  _count: { messages: number };
}

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MatIconModule, MatProgressSpinnerModule],
  template: `
    <header class="page-head">
      <h1>Soporte</h1>
      <p>Conversaciones con clientes de planes Pro y Business.</p>
    </header>

    <div class="layout">
      <!-- Lista de conversaciones -->
      <aside class="convs">
        @if (loading()) {
          <div class="loading"><mat-spinner diameter="28" /></div>
        } @else if (conversations().length === 0) {
          <div class="empty-list">Sin conversaciones aún.</div>
        } @else {
          @for (c of conversations(); track c.id) {
            <button class="conv-item" [class.active]="selected()?.id === c.id"
                    (click)="openConv(c)" type="button">
              <div class="conv-head">
                <strong>{{ c.business.name }}</strong>
                @if (c._count.messages > 0) {
                  <span class="unread-badge">{{ c._count.messages }}</span>
                }
              </div>
              <span class="conv-user">{{ c.user.fullName }}</span>
              @if (c.messages[0]; as last) {
                <p class="conv-preview">
                  @if (last.senderRole === 'ADMIN') {
                    <span class="muted">Tú:</span>
                  }
                  {{ last.content }}
                </p>
              }
              <span class="conv-time">{{ c.updatedAt | date:'dd/MM HH:mm' }}</span>
            </button>
          }
        }
      </aside>

      <!-- Detalle / chat -->
      <section class="chat">
        @if (!selected()) {
          <div class="empty-chat">
            <mat-icon>chat</mat-icon>
            <p>Selecciona una conversación para responder.</p>
          </div>
        } @else {
          <header class="chat-head">
            <div>
              <strong>{{ selected()!.business.name }}</strong>
              <span class="plan-tag" [class.pro]="selected()!.business.plan === 'PRO'"
                    [class.business]="selected()!.business.plan === 'BUSINESS'">
                {{ selected()!.business.plan }}
              </span>
            </div>
            <span class="muted">{{ selected()!.user.fullName }} · {{ selected()!.user.email }}</span>
          </header>

          <div class="messages" #scrollEl>
            @if (loadingMessages()) {
              <div class="loading"><mat-spinner diameter="28" /></div>
            } @else {
              @for (m of messages(); track m.id) {
                <div class="msg" [class.user]="m.senderRole === 'USER'"
                     [class.admin]="m.senderRole === 'ADMIN'">
                  <div class="msg-bubble">
                    <p>{{ m.content }}</p>
                    <span class="msg-time">{{ m.createdAt | date:'dd/MM HH:mm' }}</span>
                  </div>
                </div>
              }
            }
          </div>

          <form class="reply" (ngSubmit)="send()">
            <textarea
              [(ngModel)]="draft"
              name="draft"
              placeholder="Escribe tu respuesta…"
              rows="2"
              (keydown.enter)="onEnter($event)"
              [disabled]="sending()">
            </textarea>
            <button type="submit"
                    [disabled]="!draft.trim() || sending()"
                    class="send-btn">
              @if (sending()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-icon>send</mat-icon>
              }
            </button>
          </form>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page-head h1 { margin: 0 0 4px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; }
    .page-head p { margin: 0 0 24px; color: #64748b; font-size: 14.5px; }

    .layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 16px;
      height: calc(100vh - 200px);
      min-height: 480px;
    }
    @media (max-width: 1024px) {
      .layout { grid-template-columns: 1fr; height: auto; }
    }

    /* Lista de convs */
    .convs {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 8px;
      overflow-y: auto;
    }
    .loading { display: flex; justify-content: center; padding: 24px; }
    .empty-list { padding: 24px; text-align: center; color: #94a3b8; font-style: italic; }
    .conv-item {
      width: 100%;
      display: flex; flex-direction: column;
      align-items: flex-start;
      padding: 12px;
      background: transparent;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      gap: 4px;
      transition: background 0.15s;
      font-family: inherit;
    }
    .conv-item:hover { background: #f8fafc; }
    .conv-item.active { background: #eef2ff; }
    .conv-head {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%;
    }
    .conv-head strong { font-size: 14px; color: #0f172a; }
    .unread-badge {
      background: #ef4444;
      color: #fff;
      border-radius: 100px;
      padding: 1px 8px;
      font-size: 11px;
      font-weight: 700;
    }
    .conv-user { font-size: 12px; color: #64748b; }
    .conv-preview {
      font-size: 12.5px;
      color: #475569;
      margin: 4px 0 0;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conv-preview .muted { color: #94a3b8; font-style: italic; }
    .conv-time {
      font-size: 10.5px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* Chat */
    .chat {
      display: flex; flex-direction: column;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .empty-chat {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: #94a3b8;
      padding: 48px;
      gap: 12px;
    }
    .empty-chat mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .empty-chat p { margin: 0; }

    .chat-head {
      padding: 14px 18px;
      border-bottom: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .chat-head strong { font-size: 15px; color: #0f172a; margin-right: 6px; }
    .plan-tag {
      padding: 2px 8px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .plan-tag.pro { background: #eef2ff; color: #4f46e5; }
    .plan-tag.business { background: #f3e8ff; color: #9333ea; }
    .muted { color: #94a3b8; font-size: 12.5px; }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex; flex-direction: column;
      gap: 10px;
      background: #f8fafc;
    }
    .msg { display: flex; max-width: 75%; }
    .msg.user { align-self: flex-start; }
    .msg.admin { align-self: flex-end; }
    .msg-bubble {
      padding: 10px 14px;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .msg.admin .msg-bubble {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
    }
    .msg-bubble p {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
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
    .msg.admin .msg-time { color: rgba(255,255,255,0.9); }
    .msg.user .msg-time { color: #94a3b8; }

    .reply {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .reply textarea {
      flex: 1;
      min-height: 50px;
      max-height: 140px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
    }
    .reply textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); }
    .send-btn {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s, opacity 0.15s;
    }
    .send-btn:hover:not(:disabled) { transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .send-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `],
})
export class AdminSupportComponent implements OnInit {
  loading = signal(true);
  loadingMessages = signal(false);
  sending = signal(false);

  conversations = signal<ConversationRow[]>([]);
  selected = signal<ConversationRow | null>(null);
  messages = signal<SupportMessage[]>([]);

  draft = '';

  constructor(private http: HttpClient, private snack: MatSnackBar) {}

  async ngOnInit(): Promise<void> {
    await this.loadConversations();
  }

  async loadConversations(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ConversationRow[]>>(
          `${environment.apiUrl}/admin/support/conversations`
        )
      );
      if (res.success && res.data) this.conversations.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }

  async openConv(c: ConversationRow): Promise<void> {
    this.selected.set(c);
    this.loadingMessages.set(true);
    this.messages.set([]);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ messages: SupportMessage[] }>>(
          `${environment.apiUrl}/admin/support/conversations/${c.id}/messages`
        )
      );
      if (res.success && res.data) {
        this.messages.set(res.data.messages);
      }
      // Marca como leído visualmente
      this.conversations.update((list) =>
        list.map((x) => (x.id === c.id ? { ...x, _count: { messages: 0 } } : x))
      );
    } finally {
      this.loadingMessages.set(false);
    }
  }

  async send(): Promise<void> {
    const conv = this.selected();
    const content = this.draft.trim();
    if (!conv || !content) return;
    this.sending.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<SupportMessage>>(
          `${environment.apiUrl}/admin/support/conversations/${conv.id}/messages`,
          { content }
        )
      );
      if (res.success && res.data) {
        this.messages.update((m) => [...m, res.data!]);
        this.draft = '';
      }
    } catch (err: unknown) {
      this.snack.open(getErrorMessage(err, 'No se pudo enviar'), 'OK', { duration: 4000 });
    } finally {
      this.sending.set(false);
    }
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }
}
