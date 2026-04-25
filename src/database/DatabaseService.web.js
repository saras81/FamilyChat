// Web-compatible mock database service
// This uses localStorage for web instead of SQLite

class DatabaseService {
  constructor() {
    this.db = null;
    this.isWeb = typeof window !== 'undefined';
  }

  async initialize() {
    try {
      if (this.isWeb) {
        // Initialize localStorage for web
        this.initializeLocalStorage();
        console.log('Web database initialized with localStorage');
      } else {
        // Use real SQLite for mobile
        const SQLite = require('expo-sqlite');
        this.db = await SQLite.openDatabaseAsync('familychat.db');
        await this.createTables();
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  initializeLocalStorage() {
    if (!localStorage.getItem('familychat_contacts')) {
      localStorage.setItem('familychat_contacts', JSON.stringify([]));
    }
    if (!localStorage.getItem('familychat_messages')) {
      localStorage.setItem('familychat_messages', JSON.stringify([]));
    }
    if (!localStorage.getItem('familychat_family')) {
      localStorage.setItem('familychat_family', JSON.stringify([]));
    }
    if (!localStorage.getItem('familychat_devices')) {
      localStorage.setItem('familychat_devices', JSON.stringify([]));
    }
  }

  async createTables() {
    // Tables are created lazily when needed for web
    if (!this.isWeb && this.db) {
      const createContactsTable = `
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          avatar_path TEXT,
          is_child INTEGER DEFAULT 0,
          is_safe_list INTEGER DEFAULT 0,
          matrix_user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const createMessagesTable = `
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          body TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'sent',
          media_path TEXT,
          matrix_event_id TEXT,
          FOREIGN KEY (sender_id) REFERENCES contacts (id),
          FOREIGN KEY (recipient_id) REFERENCES contacts (id)
        );
      `;

      const createFamilyTable = `
        CREATE TABLE IF NOT EXISTS family (
          id TEXT PRIMARY KEY,
          family_name TEXT NOT NULL,
          parent_matrix_user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const createDeviceTable = `
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          contact_id TEXT NOT NULL,
          matrix_device_id TEXT,
          matrix_access_token TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contact_id) REFERENCES contacts (id)
        );
      `;

      try {
        await this.db.execAsync(createContactsTable);
        await this.db.execAsync(createMessagesTable);
        await this.db.execAsync(createFamilyTable);
        await this.db.execAsync(createDeviceTable);
        console.log('Database tables created successfully');
      } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
      }
    }
  }

  async addContact(contact) {
    const { id, displayName, avatarPath, isChild, isSafeList, matrixUserId } = contact;
    
    try {
      if (this.isWeb) {
        const contacts = JSON.parse(localStorage.getItem('familychat_contacts') || '[]');
        const newContact = {
          id,
          display_name: displayName,
          avatar_path: avatarPath,
          is_child: isChild ? 1 : 0,
          is_safe_list: isSafeList ? 1 : 0,
          matrix_user_id: matrixUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const existingIndex = contacts.findIndex(c => c.id === id);
        if (existingIndex >= 0) {
          contacts[existingIndex] = newContact;
        } else {
          contacts.push(newContact);
        }
        
        localStorage.setItem('familychat_contacts', JSON.stringify(contacts));
        return { success: true };
      } else {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO contacts (id, display_name, avatar_path, is_child, is_safe_list, matrix_user_id) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, displayName, avatarPath, isChild ? 1 : 0, isSafeList ? 1 : 0, matrixUserId]
        );
        return { success: true };
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      return { success: false, error: error.message };
    }
  }

  async getSafeListContacts() {
    try {
      if (this.isWeb) {
        const contacts = JSON.parse(localStorage.getItem('familychat_contacts') || '[]');
        return contacts
          .filter(contact => contact.is_safe_list === 1)
          .map(contact => ({
            ...contact,
            is_child: Boolean(contact.is_child),
            is_safe_list: Boolean(contact.is_safe_list)
          }))
          .sort((a, b) => a.display_name.localeCompare(b.display_name));
      } else {
        const contacts = await this.db.getAllAsync(
          `SELECT * FROM contacts WHERE is_safe_list = 1 ORDER BY display_name`
        );
        return contacts.map(contact => ({
          ...contact,
          is_child: Boolean(contact.is_child),
          is_safe_list: Boolean(contact.is_safe_list)
        }));
      }
    } catch (error) {
      console.error('Error getting safe list contacts:', error);
      return [];
    }
  }

  async addMessage(message) {
    const { id, senderId, recipientId, body, status, mediaPath, matrixEventId } = message;
    
    try {
      if (this.isWeb) {
        const messages = JSON.parse(localStorage.getItem('familychat_messages') || '[]');
        const newMessage = {
          id,
          sender_id: senderId,
          recipient_id: recipientId,
          body,
          status: status || 'sent',
          media_path: mediaPath,
          matrix_event_id: matrixEventId,
          timestamp: new Date().toISOString()
        };
        
        const existingIndex = messages.findIndex(m => m.id === id);
        if (existingIndex >= 0) {
          messages[existingIndex] = newMessage;
        } else {
          messages.push(newMessage);
        }
        
        localStorage.setItem('familychat_messages', JSON.stringify(messages));
        return { success: true };
      } else {
        await this.db.runAsync(
          `INSERT INTO messages (id, sender_id, recipient_id, body, status, media_path, matrix_event_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, senderId, recipientId, body, status || 'sent', mediaPath, matrixEventId]
        );
        return { success: true };
      }
    } catch (error) {
      console.error('Error adding message:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessages(contactId, limit = 50) {
    try {
      if (this.isWeb) {
        const messages = JSON.parse(localStorage.getItem('familychat_messages') || '[]');
        return messages
          .filter(m => m.sender_id === contactId || m.recipient_id === contactId)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit)
          .reverse();
      } else {
        const messages = await this.db.getAllAsync(
          `SELECT * FROM messages 
           WHERE (sender_id = ? OR recipient_id = ?) 
           ORDER BY timestamp DESC 
           LIMIT ?`,
          [contactId, contactId, limit]
        );
        return messages.reverse();
      }
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async getLastMessagePerContact() {
    try {
      if (this.isWeb) {
        const messages = JSON.parse(localStorage.getItem('familychat_messages') || '[]');
        const contactMessages = {};
        
        messages.forEach(message => {
          const contactId = message.sender_id === 'current_user' ? message.recipient_id : message.sender_id;
          if (!contactMessages[contactId] || new Date(message.timestamp) > new Date(contactMessages[contactId].timestamp)) {
            contactMessages[contactId] = message;
          }
        });
        
        return Object.values(contactMessages);
      } else {
        const messages = await this.db.getAllAsync(`
          SELECT m.*, 
                 CASE 
                   WHEN m.sender_id = ? THEN m.recipient_id 
                   ELSE m.sender_id 
                 END as contact_id
          FROM messages m
          INNER JOIN (
            SELECT 
              CASE 
                WHEN sender_id = ? THEN recipient_id 
                ELSE sender_id 
              END as contact_id,
              MAX(timestamp) as max_timestamp
            FROM messages 
            WHERE sender_id = ? OR recipient_id = ?
            GROUP BY contact_id
          ) latest ON m.timestamp = latest.max_timestamp
          AND (
            (m.sender_id = ? AND m.recipient_id = latest.contact_id) OR
            (m.recipient_id = ? AND m.sender_id = latest.contact_id)
          )
        `);
        return messages;
      }
    } catch (error) {
      console.error('Error getting last messages:', error);
      return [];
    }
  }

  async parentalPurge() {
    try {
      if (this.isWeb) {
        localStorage.removeItem('familychat_contacts');
        localStorage.removeItem('familychat_messages');
        localStorage.removeItem('familychat_family');
        localStorage.removeItem('familychat_devices');
        this.initializeLocalStorage();
        console.log('Web parental purge completed successfully');
      } else {
        await this.db.runAsync('DELETE FROM messages');
        await this.db.runAsync('DELETE FROM contacts');
        await this.db.runAsync('DELETE FROM family');
        await this.db.runAsync('DELETE FROM devices');
        
        const FileSystem = require('expo-file-system');
        const mediaDir = FileSystem.documentDirectory + 'media/';
        const mediaExists = await FileSystem.getInfoAsync(mediaDir);
        
        if (mediaExists.exists) {
          await FileSystem.deleteAsync(mediaDir, { idempotent: true });
        }
        
        console.log('Mobile parental purge completed successfully');
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
    }
  }
}

export default new DatabaseService();
