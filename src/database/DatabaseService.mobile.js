import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const DEVICE_ID = 'current_device';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (this.db) return;

    try {
      this.db = await SQLite.openDatabaseAsync('familychat.db');
      await this.createTables();
      await this.migrateTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar_path TEXT,
        is_child INTEGER DEFAULT 0,
        is_safe_list INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'approved',
        handle TEXT,
        parent_id TEXT,
        matrix_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        body TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'sent',
        media_path TEXT,
        matrix_event_id TEXT
      );

      CREATE TABLE IF NOT EXISTS family (
        id TEXT PRIMARY KEY,
        family_name TEXT NOT NULL,
        parent_matrix_user_id TEXT,
        invite_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        matrix_device_id TEXT,
        matrix_access_token TEXT,
        user_role TEXT,
        family_name TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS child_invites (
        id TEXT PRIMARY KEY,
        child_name TEXT,
        code TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS parent_accounts (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        parent_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async migrateTables() {
    await this.ensureColumn('contacts', 'approval_status', "TEXT DEFAULT 'approved'");
    await this.ensureColumn('contacts', 'handle', 'TEXT');
    await this.ensureColumn('contacts', 'parent_id', 'TEXT');
    await this.ensureColumn('devices', 'user_role', 'TEXT');
    await this.ensureColumn('devices', 'family_name', 'TEXT');
    await this.ensureColumn('family', 'invite_code', 'TEXT');
  }

  async ensureColumn(table, column, definition) {
    const columns = await this.db.getAllAsync(`PRAGMA table_info(${table})`);
    if (!columns.some(item => item.name === column)) {
      await this.db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  async addContact(contact) {
    const id = contact.id;
    const displayName = contact.displayName ?? contact.display_name;
    const avatarPath = contact.avatarPath ?? contact.avatar_path ?? null;
    const isChild = contact.isChild ?? Boolean(contact.is_child);
    const isSafeList = contact.isSafeList ?? Boolean(contact.is_safe_list ?? true);
    const approvalStatus = contact.approvalStatus ?? contact.approval_status;
    const handle = contact.handle ?? null;
    const parentId = contact.parentId ?? contact.parent_id ?? null;
    const matrixUserId = contact.matrixUserId ?? contact.matrix_user_id ?? null;

    const status = approvalStatus || (isSafeList ? 'approved' : 'blocked');

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO contacts
          (id, display_name, avatar_path, is_child, is_safe_list, approval_status, handle, parent_id, matrix_user_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, displayName, avatarPath, isChild ? 1 : 0, isSafeList ? 1 : 0, status, handle, parentId, matrixUserId]
      );
      return { success: true };
    } catch (error) {
      console.error('Error adding contact:', error);
      return { success: false, error: error.message };
    }
  }

  async updateContact(contact) {
    const isChild = contact.isChild ?? Boolean(contact.is_child);
    const isSafeList = contact.isSafeList ?? Boolean(contact.is_safe_list);
    const status = contact.approvalStatus || contact.approval_status || (isSafeList ? 'approved' : 'blocked');

    try {
      await this.db.runAsync(
        `UPDATE contacts
         SET display_name = ?, avatar_path = ?, is_child = ?, is_safe_list = ?, approval_status = ?,
             handle = ?, parent_id = ?, matrix_user_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          contact.displayName ?? contact.display_name,
          contact.avatarPath ?? contact.avatar_path ?? null,
          isChild ? 1 : 0,
          isSafeList ? 1 : 0,
          status,
          contact.handle,
          contact.parentId ?? contact.parent_id ?? null,
          contact.matrixUserId ?? contact.matrix_user_id ?? null,
          contact.id
        ]
      );
      return { success: true };
    } catch (error) {
      console.error('Error updating contact:', error);
      return { success: false, error: error.message };
    }
  }

  normalizeContact(contact) {
    return contact ? {
      ...contact,
      is_child: Boolean(contact.is_child),
      is_safe_list: Boolean(contact.is_safe_list),
      approval_status: contact.approval_status || (contact.is_safe_list ? 'approved' : 'blocked')
    } : null;
  }

  async addFamily(family) {
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO family (id, family_name, parent_matrix_user_id, invite_code)
         VALUES (?, ?, ?, ?)`,
        [family.id, family.familyName, family.parentMatrixUserId || null, family.inviteCode || null]
      );
      return { success: true };
    } catch (error) {
      console.error('Error adding family:', error);
      return { success: false, error: error.message };
    }
  }

  async getFamily() {
    try {
      return await this.db.getFirstAsync('SELECT * FROM family ORDER BY created_at DESC LIMIT 1');
    } catch (error) {
      console.error('Error getting family:', error);
      return null;
    }
  }

  async saveLoginDetails(userId, accessToken, deviceId, userRole, familyName = null) {
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO devices
          (id, contact_id, matrix_device_id, matrix_access_token, user_role, family_name, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [DEVICE_ID, userId, deviceId, accessToken, userRole, familyName]
      );
      return { success: true };
    } catch (error) {
      console.error('Error saving login details:', error);
      return { success: false, error: error.message };
    }
  }

  async saveParentAccount(email, password, parentId, displayName) {
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO parent_accounts (email, password, parent_id, display_name)
         VALUES (?, ?, ?, ?)`,
        [email.toLowerCase(), password, parentId, displayName]
      );
      return { success: true };
    } catch (error) {
      console.error('Error saving parent account:', error);
      return { success: false, error: error.message };
    }
  }

  async validateParentAccount(email, password) {
    try {
      const account = await this.db.getFirstAsync(
        'SELECT * FROM parent_accounts WHERE email = ? AND password = ?',
        [email.toLowerCase(), password]
      );

      return account
        ? { success: true, account }
        : { success: false, error: 'Invalid email or password' };
    } catch (error) {
      console.error('Error validating parent account:', error);
      return { success: false, error: error.message };
    }
  }

  async getLoginDetails() {
    try {
      const result = await this.db.getFirstAsync('SELECT * FROM devices WHERE id = ?', [DEVICE_ID]);
      return result ? {
        userId: result.contact_id,
        accessToken: result.matrix_access_token,
        deviceId: result.matrix_device_id,
        userRole: result.user_role,
        familyName: result.family_name
      } : null;
    } catch (error) {
      console.error('Error getting login details:', error);
      return null;
    }
  }

  async deleteLoginDetails() {
    try {
      await this.db.runAsync('DELETE FROM devices WHERE id = ?', [DEVICE_ID]);
      return { success: true };
    } catch (error) {
      console.error('Error deleting login details:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserRole() {
    const details = await this.getLoginDetails();
    return details?.userRole || null;
  }

  async getFamilyName() {
    const details = await this.getLoginDetails();
    return details?.familyName || null;
  }

  async saveFamilyName(familyName) {
    const details = await this.getLoginDetails();
    if (!details) return { success: false, error: 'No active login' };
    return this.saveLoginDetails(details.userId, details.accessToken, details.deviceId, details.userRole, familyName);
  }

  async getUserProfile() {
    try {
      const details = await this.getLoginDetails();
      if (!details?.userId) return null;
      const profile = await this.db.getFirstAsync('SELECT * FROM contacts WHERE id = ?', [details.userId]);
      return this.normalizeContact(profile);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async getChildProfiles() {
    try {
      const children = await this.db.getAllAsync('SELECT * FROM contacts WHERE is_child = 1 ORDER BY display_name');
      return children.map(child => this.normalizeContact(child));
    } catch (error) {
      console.error('Error getting child profiles:', error);
      return [];
    }
  }

  async getAllContacts() {
    try {
      const contacts = await this.db.getAllAsync('SELECT * FROM contacts ORDER BY display_name');
      return contacts.map(contact => this.normalizeContact(contact));
    } catch (error) {
      console.error('Error getting all contacts:', error);
      return [];
    }
  }

  async getSafeListContacts() {
    try {
      const contacts = await this.db.getAllAsync(
        `SELECT * FROM contacts
         WHERE is_safe_list = 1 AND approval_status = 'approved'
         ORDER BY display_name`
      );
      return contacts.map(contact => this.normalizeContact(contact));
    } catch (error) {
      console.error('Error getting safe list contacts:', error);
      return [];
    }
  }

  async setContactApproval(contactId, isApproved) {
    try {
      await this.db.runAsync(
        `UPDATE contacts SET is_safe_list = ?, approval_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [isApproved ? 1 : 0, isApproved ? 'approved' : 'blocked', contactId]
      );
      return { success: true };
    } catch (error) {
      console.error('Error setting contact approval:', error);
      return { success: false, error: error.message };
    }
  }

  async createChildInvite(childName = '') {
    const code = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').padEnd(6, '0').substring(0, 6).toUpperCase();
    const id = `invite_${Date.now()}`;

    try {
      await this.db.runAsync(
        'INSERT INTO child_invites (id, child_name, code, status) VALUES (?, ?, ?, ?)',
        [id, childName, code, 'open']
      );
      return { success: true, invite: { id, child_name: childName, code, status: 'open' } };
    } catch (error) {
      if (error.message?.includes('UNIQUE')) {
        return this.createChildInvite(childName);
      }
      console.error('Error creating child invite:', error);
      return { success: false, error: error.message };
    }
  }

  async getChildInvites() {
    try {
      return await this.db.getAllAsync('SELECT * FROM child_invites ORDER BY created_at DESC');
    } catch (error) {
      console.error('Error getting child invites:', error);
      return [];
    }
  }

  async validateInviteCode(code) {
    try {
      const invite = await this.db.getFirstAsync(
        `SELECT * FROM child_invites WHERE code = ? AND status = 'open'`,
        [code.toUpperCase()]
      );
      return { success: Boolean(invite), invite, error: invite ? null : 'This code was not found or has already been used.' };
    } catch (error) {
      console.error('Error validating invite code:', error);
      return { success: false, error: error.message };
    }
  }

  async markInviteUsed(code) {
    try {
      await this.db.runAsync(
        `UPDATE child_invites SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE code = ?`,
        [code.toUpperCase()]
      );
      return { success: true };
    } catch (error) {
      console.error('Error marking invite used:', error);
      return { success: false, error: error.message };
    }
  }

  async addMessage(message) {
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO messages
          (id, sender_id, recipient_id, body, timestamp, status, media_path, matrix_event_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.senderId,
          message.recipientId,
          message.body,
          message.timestamp || new Date().toISOString(),
          message.status || 'sent',
          message.mediaPath || null,
          message.matrixEventId || null
        ]
      );
      return { success: true };
    } catch (error) {
      console.error('Error adding message:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessages(contactId, limit = 50) {
    try {
      const messages = await this.db.getAllAsync(
        `SELECT * FROM messages
         WHERE sender_id = ? OR recipient_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [contactId, contactId, limit]
      );
      return messages.reverse();
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async getChildActivity(limit = 40) {
    try {
      return await this.db.getAllAsync(
        `SELECT messages.*, contacts.display_name AS child_name
         FROM messages
         LEFT JOIN contacts ON contacts.id = messages.sender_id OR contacts.id = messages.recipient_id
         WHERE contacts.is_child = 1
         ORDER BY messages.timestamp DESC
         LIMIT ?`,
        [limit]
      );
    } catch (error) {
      console.error('Error getting child activity:', error);
      return [];
    }
  }

  async getLastMessagePerContact() {
    try {
      return await this.db.getAllAsync(`
        SELECT m1.*,
               CASE
                 WHEN m1.sender_id = 'current_user' THEN m1.recipient_id
                 ELSE m1.sender_id
               END as contact_id
        FROM messages m1
        WHERE m1.timestamp = (
          SELECT MAX(m2.timestamp)
          FROM messages m2
          WHERE (m2.sender_id = m1.sender_id AND m2.recipient_id = m1.recipient_id)
             OR (m2.sender_id = m1.recipient_id AND m2.recipient_id = m1.sender_id)
        )
        ORDER BY m1.timestamp DESC
      `);
    } catch (error) {
      console.error('Error getting last messages:', error);
      return [];
    }
  }

  async purgeChatHistory() {
    try {
      await this.db.runAsync('DELETE FROM messages');
      const mediaDir = FileSystem.documentDirectory + 'media/';
      const mediaExists = await FileSystem.getInfoAsync(mediaDir);
      if (mediaExists.exists) {
        await FileSystem.deleteAsync(mediaDir, { idempotent: true });
      }
      return { success: true };
    } catch (error) {
      console.error('Error purging chat history:', error);
      return { success: false, error: error.message };
    }
  }

  async parentalPurge() {
    try {
      await this.db.runAsync('DELETE FROM messages');
      await this.db.runAsync('DELETE FROM contacts');
      await this.db.runAsync('DELETE FROM family');
      await this.db.runAsync('DELETE FROM devices');
      await this.db.runAsync('DELETE FROM child_invites');

      const mediaDir = FileSystem.documentDirectory + 'media/';
      const mediaExists = await FileSystem.getInfoAsync(mediaDir);
      if (mediaExists.exists) {
        await FileSystem.deleteAsync(mediaDir, { idempotent: true });
      }

      return { success: true };
    } catch (error) {
      console.error('Error during parental purge:', error);
      return { success: false, error: error.message };
    }
  }

  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export default new DatabaseService();
