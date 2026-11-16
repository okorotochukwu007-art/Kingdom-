import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  Conversation,
  DirectMessage,
  EventAttachment,
  FellowshipRoomId,
  FellowshipRoomMessage,
} from '../src/types/kingdom.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'community_messages.sqlite');

class CommunityMessagesDatabase {
  private db: DatabaseSync;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new DatabaseSync(DB_FILE);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS community_conversations (
        id TEXT PRIMARY KEY,
        participant_one_id TEXT NOT NULL,
        participant_two_id TEXT NOT NULL,
        last_message_text TEXT NOT NULL DEFAULT '',
        last_message_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(participant_one_id, participant_two_id)
      );

      CREATE TABLE IF NOT EXISTS community_messages (
        id TEXT PRIMARY KEY,
        message_scope TEXT NOT NULL CHECK(message_scope IN ('room', 'direct')),
        room_id TEXT,
        conversation_id TEXT,
        sender_id TEXT NOT NULL,
        sender_full_name TEXT NOT NULL DEFAULT '',
        sender_username TEXT NOT NULL DEFAULT '',
        sender_location TEXT NOT NULL DEFAULT '',
        recipient_id TEXT,
        content TEXT NOT NULL DEFAULT '',
        attachment_json TEXT,
        amen_user_ids_json TEXT NOT NULL DEFAULT '[]',
        is_read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cm_room_created
        ON community_messages(message_scope, room_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_cm_conv_created
        ON community_messages(message_scope, conversation_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_cm_sender_created
        ON community_messages(sender_id, created_at DESC);
    `);
  }

  private parseAttachment(raw: unknown): EventAttachment | undefined {
    if (typeof raw !== 'string' || !raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as EventAttachment) : undefined;
    } catch {
      return undefined;
    }
  }

  private parseStringArray(raw: unknown): string[] {
    if (typeof raw !== 'string' || !raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  public backfillFromLegacyStore(params: {
    roomMessages: FellowshipRoomMessage[];
    conversations: Conversation[];
    directMessages: DirectMessage[];
  }): void {
    const insertConv = this.db.prepare(`
      INSERT OR IGNORE INTO community_conversations (
        id, participant_one_id, participant_two_id, last_message_text, last_message_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertRoomMsg = this.db.prepare(`
      INSERT OR IGNORE INTO community_messages (
        id, message_scope, room_id, conversation_id,
        sender_id, sender_full_name, sender_username, sender_location,
        recipient_id, content, attachment_json, amen_user_ids_json,
        is_read, read_at, created_at
      ) VALUES (?, 'room', ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 1, NULL, ?)
    `);

    const insertDm = this.db.prepare(`
      INSERT OR IGNORE INTO community_messages (
        id, message_scope, room_id, conversation_id,
        sender_id, sender_full_name, sender_username, sender_location,
        recipient_id, content, attachment_json, amen_user_ids_json,
        is_read, read_at, created_at
      ) VALUES (?, 'direct', NULL, ?, ?, '', '', '', ?, ?, ?, '[]', ?, ?, ?)
    `);

    for (const c of params.conversations || []) {
      insertConv.run(
        c.id,
        c.participant_one_id,
        c.participant_two_id,
        c.last_message_text || '',
        c.last_message_at || new Date().toISOString(),
        c.last_message_at || new Date().toISOString()
      );
    }

    for (const rm of params.roomMessages || []) {
      insertRoomMsg.run(
        rm.id,
        rm.room_id,
        rm.user_id,
        rm.user_full_name || 'Believer',
        rm.user_username || 'member',
        rm.user_location || 'Nigeria',
        rm.content || '',
        rm.attachment ? JSON.stringify(rm.attachment) : null,
        JSON.stringify(rm.amen_user_ids || []),
        rm.created_at || new Date().toISOString()
      );
    }

    for (const dm of params.directMessages || []) {
      const conv = (params.conversations || []).find((c) => c.id === dm.conversation_id);
      const recipientId = conv
        ? conv.participant_one_id === dm.sender_id
          ? conv.participant_two_id
          : conv.participant_one_id
        : null;
      insertDm.run(
        dm.id,
        dm.conversation_id,
        dm.sender_id,
        recipientId,
        dm.content || '',
        dm.attachment ? JSON.stringify(dm.attachment) : null,
        dm.is_read ? 1 : 0,
        dm.read_at || null,
        dm.created_at || new Date().toISOString()
      );
    }
  }

  public insertRoomMessage(msg: FellowshipRoomMessage): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO community_messages (
        id, message_scope, room_id, conversation_id,
        sender_id, sender_full_name, sender_username, sender_location,
        recipient_id, content, attachment_json, amen_user_ids_json,
        is_read, read_at, created_at
      ) VALUES (?, 'room', ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 1, NULL, ?)
    `);

    stmt.run(
      msg.id,
      msg.room_id,
      msg.user_id,
      msg.user_full_name,
      msg.user_username,
      msg.user_location || '',
      msg.content || '',
      msg.attachment ? JSON.stringify(msg.attachment) : null,
      JSON.stringify(msg.amen_user_ids || []),
      msg.created_at
    );
  }

  public getRoomMessages(roomId: FellowshipRoomId, limit = 100): FellowshipRoomMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM (
        SELECT * FROM community_messages
        WHERE message_scope = 'room' AND room_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      ) sub
      ORDER BY datetime(created_at) ASC
    `);

    const rows = stmt.all(roomId, limit) as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: String(row.id),
      room_id: row.room_id as FellowshipRoomId,
      user_id: String(row.sender_id),
      user_full_name: String(row.sender_full_name || 'Believer'),
      user_username: String(row.sender_username || 'member'),
      user_location: String(row.sender_location || 'Nigeria'),
      content: String(row.content || ''),
      ...(this.parseAttachment(row.attachment_json)
        ? { attachment: this.parseAttachment(row.attachment_json) }
        : {}),
      amen_user_ids: this.parseStringArray(row.amen_user_ids_json),
      created_at: String(row.created_at),
    }));
  }

  public getRoomSummary(validRoomIds: Iterable<FellowshipRoomId>): Record<
    string,
    { count: number; lastMessageAt: string | null }
  > {
    const summary: Record<string, { count: number; lastMessageAt: string | null }> = {};
    for (const roomId of validRoomIds) {
      summary[roomId] = { count: 0, lastMessageAt: null };
    }

    const stmt = this.db.prepare(`
      SELECT room_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
      FROM community_messages
      WHERE message_scope = 'room' AND room_id IS NOT NULL
      GROUP BY room_id
    `);
    const rows = stmt.all() as Array<{ room_id: string; cnt: number; last_at: string | null }>;
    for (const row of rows) {
      if (!summary[row.room_id]) continue;
      summary[row.room_id] = {
        count: Number(row.cnt || 0),
        lastMessageAt: row.last_at || null,
      };
    }
    return summary;
  }

  public toggleRoomMessageAmen(
    roomId: FellowshipRoomId,
    msgId: string,
    userId: string
  ): FellowshipRoomMessage | null {
    const row = this.db
      .prepare(
        `SELECT * FROM community_messages WHERE id = ? AND message_scope = 'room' AND room_id = ? LIMIT 1`
      )
      .get(msgId, roomId) as Record<string, any> | undefined;
    if (!row) return null;

    const amenIds = this.parseStringArray(row.amen_user_ids_json);
    const idx = amenIds.indexOf(userId);
    if (idx >= 0) {
      amenIds.splice(idx, 1);
    } else {
      amenIds.push(userId);
    }

    this.db
      .prepare(`UPDATE community_messages SET amen_user_ids_json = ? WHERE id = ?`)
      .run(JSON.stringify(amenIds), msgId);

    const attachment = this.parseAttachment(row.attachment_json);
    return {
      id: String(row.id),
      room_id: row.room_id as FellowshipRoomId,
      user_id: String(row.sender_id),
      user_full_name: String(row.sender_full_name || 'Believer'),
      user_username: String(row.sender_username || 'member'),
      user_location: String(row.sender_location || 'Nigeria'),
      content: String(row.content || ''),
      ...(attachment ? { attachment } : {}),
      amen_user_ids: amenIds,
      created_at: String(row.created_at),
    };
  }

  public findConversationBetween(userA: string, userB: string): Conversation | null {
    const row = this.db
      .prepare(
        `SELECT * FROM community_conversations
         WHERE (participant_one_id = ? AND participant_two_id = ?)
            OR (participant_one_id = ? AND participant_two_id = ?)
         LIMIT 1`
      )
      .get(userA, userB, userB, userA) as Record<string, any> | undefined;

    if (!row) return null;
    return {
      id: String(row.id),
      participant_one_id: String(row.participant_one_id),
      participant_two_id: String(row.participant_two_id),
      last_message_text: String(row.last_message_text || ''),
      last_message_at: String(row.last_message_at),
      unread_count: 0,
    };
  }

  public upsertConversation(conv: Conversation): void {
    this.db
      .prepare(
        `INSERT INTO community_conversations (
           id, participant_one_id, participant_two_id, last_message_text, last_message_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_message_text = excluded.last_message_text,
           last_message_at = excluded.last_message_at`
      )
      .run(
        conv.id,
        conv.participant_one_id,
        conv.participant_two_id,
        conv.last_message_text || '',
        conv.last_message_at,
        conv.last_message_at
      );
  }

  public getUserConversations(userId: string): Array<Conversation & { unread_count: number }> {
    const rows = this.db
      .prepare(
        `SELECT c.*,
           (
             SELECT COUNT(*)
             FROM community_messages m
             WHERE m.message_scope = 'direct'
               AND m.conversation_id = c.id
               AND m.sender_id != ?
               AND m.is_read = 0
           ) AS unread_cnt
         FROM community_conversations c
         WHERE c.participant_one_id = ? OR c.participant_two_id = ?
         ORDER BY datetime(c.last_message_at) DESC`
      )
      .all(userId, userId, userId) as Array<Record<string, any>>;

    return rows.map((row) => ({
      id: String(row.id),
      participant_one_id: String(row.participant_one_id),
      participant_two_id: String(row.participant_two_id),
      last_message_text: String(row.last_message_text || ''),
      last_message_at: String(row.last_message_at),
      unread_count: Number(row.unread_cnt || 0),
    }));
  }

  public markDirectMessagesRead(conversationId: string, senderId: string): boolean {
    const nowIso = new Date().toISOString();
    const res = this.db
      .prepare(
        `UPDATE community_messages
         SET is_read = 1, read_at = ?
         WHERE message_scope = 'direct'
           AND conversation_id = ?
           AND sender_id = ?
           AND is_read = 0`
      )
      .run(nowIso, conversationId, senderId);
    return Number(res.changes || 0) > 0;
  }

  public getDirectMessages(conversationId: string, limit = 200): DirectMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT * FROM community_messages
           WHERE message_scope = 'direct' AND conversation_id = ?
           ORDER BY datetime(created_at) DESC
           LIMIT ?
         ) sub
         ORDER BY datetime(created_at) ASC`
      )
      .all(conversationId, limit) as Array<Record<string, any>>;

    return rows.map((row) => {
      const attachment = this.parseAttachment(row.attachment_json);
      return {
        id: String(row.id),
        conversation_id: String(row.conversation_id),
        sender_id: String(row.sender_id),
        content: String(row.content || ''),
        ...(attachment ? { attachment } : {}),
        is_read: Boolean(row.is_read),
        ...(row.read_at ? { read_at: String(row.read_at) } : {}),
        created_at: String(row.created_at),
      };
    });
  }

  public insertDirectMessage(params: {
    message: DirectMessage;
    recipientId: string;
    senderFullName: string;
    senderUsername: string;
    senderLocation: string;
  }): void {
    const { message, recipientId, senderFullName, senderUsername, senderLocation } = params;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO community_messages (
           id, message_scope, room_id, conversation_id,
           sender_id, sender_full_name, sender_username, sender_location,
           recipient_id, content, attachment_json, amen_user_ids_json,
           is_read, read_at, created_at
         ) VALUES (?, 'direct', NULL, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`
      )
      .run(
        message.id,
        message.conversation_id,
        message.sender_id,
        senderFullName,
        senderUsername,
        senderLocation || '',
        recipientId,
        message.content || '',
        message.attachment ? JSON.stringify(message.attachment) : null,
        message.is_read ? 1 : 0,
        message.read_at || null,
        message.created_at
      );
  }
}

export const communityMessagesDb = new CommunityMessagesDatabase();
