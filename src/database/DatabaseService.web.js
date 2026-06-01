const KEYS = {
  contacts: 'familychat_contacts',
  messages: 'familychat_messages',
  family: 'familychat_family',
  devices: 'familychat_devices',
  invites: 'familychat_child_invites',
  parentAccounts: 'familychat_parent_accounts'
};

const DEVICE_ID = 'current_device';

class DatabaseService {
  constructor() {
    this.isWeb = typeof window !== 'undefined';
  }

  async initialize() {
    Object.values(KEYS).forEach(key => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify([]));
      }
    });
  }

  read(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  normalizeContact(contact) {
    return contact ? {
      ...contact,
      is_child: Boolean(contact.is_child),
      is_safe_list: Boolean(contact.is_safe_list),
      approval_status: contact.approval_status || (contact.is_safe_list ? 'approved' : 'blocked')
    } : null;
  }

  async addContact(contact) {
    try {
      const contacts = this.read(KEYS.contacts);
      const isSafeList = contact.isSafeList ?? Boolean(contact.is_safe_list ?? true);
      const newContact = {
        id: contact.id,
        display_name: contact.displayName ?? contact.display_name,
        avatar_path: contact.avatarPath ?? contact.avatar_path ?? null,
        is_child: (contact.isChild ?? Boolean(contact.is_child)) ? 1 : 0,
        is_safe_list: isSafeList ? 1 : 0,
        approval_status: contact.approvalStatus || contact.approval_status || (isSafeList ? 'approved' : 'blocked'),
        handle: contact.handle || null,
        parent_id: contact.parentId ?? contact.parent_id ?? null,
        matrix_user_id: contact.matrixUserId ?? contact.matrix_user_id ?? null,
        matrix_room_id: contact.matrixRoomId ?? contact.matrix_room_id ?? null,
        created_at: contact.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const existingIndex = contacts.findIndex(item => item.id === newContact.id);
      if (existingIndex >= 0) {
        // Preserve an already-known room/matrix id when this write omits it, so a
        // roomless re-add (e.g. onboarding) can't wipe a reconciled family room.
        contacts[existingIndex] = {
          ...contacts[existingIndex],
          ...newContact,
          matrix_user_id: newContact.matrix_user_id ?? contacts[existingIndex].matrix_user_id,
          matrix_room_id: newContact.matrix_room_id ?? contacts[existingIndex].matrix_room_id
        };
      } else {
        contacts.push(newContact);
      }

      this.write(KEYS.contacts, contacts);
      return { success: true };
    } catch (error) {
      console.error('Error adding contact:', error);
      return { success: false, error: error.message };
    }
  }

  async updateContact(contact) {
    try {
      const contacts = this.read(KEYS.contacts);
      const index = contacts.findIndex(item => item.id === contact.id);
      if (index === -1) return { success: false, error: 'Contact not found' };

      const isSafeList = contact.isSafeList ?? Boolean(contact.is_safe_list);
      const isChild = contact.isChild ?? Boolean(contact.is_child);
      contacts[index] = {
        ...contacts[index],
        display_name: contact.displayName ?? contact.display_name,
        avatar_path: contact.avatarPath ?? contact.avatar_path ?? null,
        is_child: isChild ? 1 : 0,
        is_safe_list: isSafeList ? 1 : 0,
        approval_status: contact.approvalStatus || contact.approval_status || (isSafeList ? 'approved' : 'blocked'),
        handle: contact.handle || contact.handle === '' ? contact.handle : contacts[index].handle,
        parent_id: contact.parentId || contacts[index].parent_id,
        matrix_user_id: contact.matrixUserId ?? contacts[index].matrix_user_id,
        matrix_room_id: contact.matrixRoomId ?? contact.matrix_room_id ?? contacts[index].matrix_room_id,
        updated_at: new Date().toISOString()
      };
      this.write(KEYS.contacts, contacts);
      return { success: true };
    } catch (error) {
      console.error('Error updating contact:', error);
      return { success: false, error: error.message };
    }
  }

  async setContactApproval(contactId, isApproved) {
    try {
      const contacts = this.read(KEYS.contacts);
      const index = contacts.findIndex(item => item.id === contactId);
      if (index === -1) return { success: false, error: 'Contact not found' };

      contacts[index] = {
        ...contacts[index],
        is_safe_list: isApproved ? 1 : 0,
        approval_status: isApproved ? 'approved' : 'blocked',
        updated_at: new Date().toISOString()
      };
      this.write(KEYS.contacts, contacts);
      return { success: true };
    } catch (error) {
      console.error('Error setting contact approval:', error);
      return { success: false, error: error.message };
    }
  }

  async addFamily(family) {
    try {
      const families = this.read(KEYS.family);
      const newFamily = {
        id: family.id,
        family_name: family.familyName,
        parent_matrix_user_id: family.parentMatrixUserId || null,
        invite_code: family.inviteCode || null,
        created_at: new Date().toISOString()
      };

      const existingIndex = families.findIndex(item => item.id === newFamily.id);
      if (existingIndex >= 0) {
        families[existingIndex] = newFamily;
      } else {
        families.push(newFamily);
      }

      this.write(KEYS.family, families);
      return { success: true };
    } catch (error) {
      console.error('Error adding family:', error);
      return { success: false, error: error.message };
    }
  }

  async getFamily() {
    try {
      const families = this.read(KEYS.family);
      return families[families.length - 1] || null;
    } catch (error) {
      console.error('Error getting family:', error);
      return null;
    }
  }

  async saveLoginDetails(userId, accessToken, deviceId, userRole, familyName = null) {
    try {
      const devices = this.read(KEYS.devices).filter(item => item.id !== DEVICE_ID);
      devices.push({
        id: DEVICE_ID,
        contact_id: userId,
        matrix_device_id: deviceId,
        matrix_access_token: accessToken,
        user_role: userRole,
        family_name: familyName,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      this.write(KEYS.devices, devices);
      return { success: true };
    } catch (error) {
      console.error('Error saving login details:', error);
      return { success: false, error: error.message };
    }
  }

  async saveParentAccount(email, password, parentId, displayName) {
    try {
      const accounts = this.read(KEYS.parentAccounts).filter(
        item => item.email !== email.toLowerCase()
      );
      accounts.push({
        email: email.toLowerCase(),
        password,
        parent_id: parentId,
        display_name: displayName,
        created_at: new Date().toISOString()
      });
      this.write(KEYS.parentAccounts, accounts);
      return { success: true };
    } catch (error) {
      console.error('Error saving parent account:', error);
      return { success: false, error: error.message };
    }
  }

  async validateParentAccount(email, password) {
    try {
      const account = this.read(KEYS.parentAccounts).find(
        item => item.email === email.toLowerCase() && item.password === password
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
      const device = this.read(KEYS.devices).find(item => item.id === DEVICE_ID);
      return device ? {
        userId: device.contact_id,
        accessToken: device.matrix_access_token,
        deviceId: device.matrix_device_id,
        userRole: device.user_role,
        familyName: device.family_name
      } : null;
    } catch (error) {
      console.error('Error getting login details:', error);
      return null;
    }
  }

  async deleteLoginDetails() {
    try {
      this.write(KEYS.devices, this.read(KEYS.devices).filter(item => item.id !== DEVICE_ID));
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
    const details = await this.getLoginDetails();
    if (!details?.userId) return null;
    return this.normalizeContact(this.read(KEYS.contacts).find(item => item.id === details.userId));
  }

  async getChildProfiles() {
    return this.read(KEYS.contacts)
      .filter(item => item.is_child === 1)
      .map(item => this.normalizeContact(item))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  async getAllContacts() {
    return this.read(KEYS.contacts)
      .map(item => this.normalizeContact(item))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  async getSafeListContacts() {
    return this.read(KEYS.contacts)
      .filter(item => item.is_safe_list === 1 && (item.approval_status || 'approved') === 'approved')
      .map(item => this.normalizeContact(item))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  async createChildInvite(childName = '') {
    const code = Math.random().toString(36).replace(/[^a-z0-9]/gi, '').padEnd(6, '0').substring(0, 6).toUpperCase();
    const invites = this.read(KEYS.invites);

    if (invites.some(item => item.code === code)) {
      return this.createChildInvite(childName);
    }

    const invite = {
      id: `invite_${Date.now()}`,
      child_name: childName,
      code,
      status: 'open',
      created_at: new Date().toISOString(),
      used_at: null
    };
    invites.unshift(invite);
    this.write(KEYS.invites, invites);
    return { success: true, invite };
  }

  async getChildInvites() {
    return this.read(KEYS.invites);
  }

  async validateInviteCode(code) {
    const invite = this.read(KEYS.invites).find(
      item => item.code === code.toUpperCase() && item.status === 'open'
    );
    return {
      success: Boolean(invite),
      invite,
      error: invite ? null : 'This code was not found or has already been used.'
    };
  }

  async markInviteUsed(code) {
    const invites = this.read(KEYS.invites);
    const index = invites.findIndex(item => item.code === code.toUpperCase());
    if (index >= 0) {
      invites[index] = { ...invites[index], status: 'used', used_at: new Date().toISOString() };
      this.write(KEYS.invites, invites);
    }
    return { success: true };
  }

  async addMessage(message) {
    try {
      const messages = this.read(KEYS.messages);
      const newMessage = {
        id: message.id,
        sender_id: message.senderId,
        recipient_id: message.recipientId,
        body: message.body,
        timestamp: message.timestamp || new Date().toISOString(),
        status: message.status || 'sent',
        media_path: message.mediaPath || null,
        matrix_event_id: message.matrixEventId || null
      };

      const existingIndex = messages.findIndex(item => item.id === newMessage.id);
      if (existingIndex >= 0) {
        messages[existingIndex] = newMessage;
      } else {
        messages.push(newMessage);
      }

      this.write(KEYS.messages, messages);
      return { success: true };
    } catch (error) {
      console.error('Error adding message:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessages(contactId, limit = 50) {
    return this.read(KEYS.messages)
      .filter(item => item.sender_id === contactId || item.recipient_id === contactId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .reverse();
  }

  async getChildActivity(limit = 40) {
    const children = new Set(this.read(KEYS.contacts).filter(item => item.is_child === 1).map(item => item.id));
    return this.read(KEYS.messages)
      .filter(item => children.has(item.sender_id) || children.has(item.recipient_id))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getLastMessagePerContact() {
    const contactMessages = {};
    this.read(KEYS.messages).forEach(message => {
      const contactId = message.sender_id === 'current_user' ? message.recipient_id : message.sender_id;
      if (!contactMessages[contactId] || new Date(message.timestamp) > new Date(contactMessages[contactId].timestamp)) {
        contactMessages[contactId] = { ...message, contact_id: contactId };
      }
    });
    return Object.values(contactMessages);
  }

  async purgeChatHistory() {
    this.write(KEYS.messages, []);
    return { success: true };
  }

  async parentalPurge() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    await this.initialize();
    return { success: true };
  }

  async close() {}
}

export default new DatabaseService();
