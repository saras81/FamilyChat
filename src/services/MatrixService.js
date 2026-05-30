import * as Matrix from 'matrix-js-sdk';
import { AppState } from 'react-native';
import DatabaseService from '../database/DatabaseService';
import { HOMESERVER_URL, roomAliasForCode, roomAliasLocalpart } from '../config';

// A family room is one whose canonical (or alt) alias starts with this prefix.
// Both parent (create) and child (join) derive the alias from the invite code,
// so membership in these rooms is how each device discovers the other party.
const FAMILY_ALIAS_PREFIX = '#familychat-';

class MatrixService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.appStateSubscription = null;
    this.reconcileTimer = null;
  }

  async initialize(userId, accessToken, deviceId) {
    try {
      this.client = Matrix.createClient({
        baseUrl: HOMESERVER_URL,
        userId: userId,
        accessToken: accessToken,
        deviceId: deviceId
      });

      await this.client.startClient();
      this.isInitialized = true;

      this.setupEventListeners();
      this.setupAppStateListener();
      return { success: true };
    } catch (error) {
      console.error('Matrix initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      // Pause/resume syncing with app lifecycle to save battery/sockets. Guard the
      // calls: not every matrix-js-sdk version (or the web build) exposes pause/
      // resume, and an unguarded call throws inside this listener (seen on web when
      // a tab backgrounds), which would otherwise spam errors and skip the resume.
      if (!this.client) return;
      if (nextAppState === 'background' && typeof this.client.pause === 'function') {
        this.client.pause();
      } else if (nextAppState === 'active' && typeof this.client.resume === 'function') {
        this.client.resume();
      }
    });
  }

  setupEventListeners() {
    if (!this.client) return;

    // Persist + surface every room message (incoming and our own echoes).
    this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return; // ignore back-pagination / scrollback
      if (event.getType() === 'm.room.message') {
        this.handleNewMessage(event, room);
      }
    });

    // Whenever membership changes (e.g. the child joins the family room), or the
    // first sync completes, reconcile room membership into the local contact list.
    this.client.on('sync', (state) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        this.scheduleReconcile();
      } else if (state === 'ERROR') {
        console.error('Matrix sync error');
      }
    });

    this.client.on('RoomMember.membership', () => {
      this.scheduleReconcile();
    });
  }

  // Debounce reconciliation so a burst of sync/membership events only triggers
  // one pass over the rooms.
  scheduleReconcile() {
    if (this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcileContacts().catch((e) =>
        console.error('reconcileContacts failed:', e?.message)
      );
    }, 800);
  }

  isFamilyRoom(room) {
    try {
      const canonical = room.getCanonicalAlias?.();
      if (canonical && canonical.startsWith(FAMILY_ALIAS_PREFIX)) return true;
      const alts = room.getAltAliases?.() || [];
      return alts.some((a) => a.startsWith(FAMILY_ALIAS_PREFIX));
    } catch {
      return false;
    }
  }

  // Derive contacts from family-room membership. The other member(s) of each
  // family room become approved Safe List contacts, carrying the roomId so the
  // chat screen knows where to send. This is what makes a contact appear on a
  // device that never created it locally (the whole point of cross-device).
  async reconcileContacts() {
    if (!this.client) return;
    const me = this.client.getUserId();
    const rooms = this.client.getRooms();

    for (const room of rooms) {
      if (!this.isFamilyRoom(room)) continue;
      const members = (room.getJoinedMembers?.() || []).filter((m) => m.userId !== me);
      for (const member of members) {
        const displayName =
          member.name || member.rawDisplayName || member.userId?.split(':')[0]?.replace('@', '') || 'Family';
        await DatabaseService.addContact({
          id: member.userId,
          displayName,
          isChild: false,
          isSafeList: true,
          approvalStatus: 'approved',
          handle: member.userId,
          matrixUserId: member.userId,
          matrixRoomId: room.roomId
        });
      }
    }
  }

  async handleNewMessage(event, room) {
    try {
      const content = event.getContent();
      const sender = event.getSender();
      const roomId = event.getRoomId();
      const eventId = event.getId();
      const isSelf = sender === this.client?.getUserId();

      // Persist keyed by room so both inbound and outbound messages for the same
      // conversation live under the same key. addMessage upserts by id (the Matrix
      // event id), so our own optimistic send and its sync echo collapse to one row.
      await DatabaseService.addMessage({
        id: eventId,
        senderId: isSelf ? 'current_user' : sender,
        recipientId: roomId,
        body: content.body,
        timestamp: new Date(event.getTs()).toISOString(),
        status: isSelf ? 'sent' : 'received',
        matrixEventId: eventId
      });

      this.onMessageReceived?.({
        id: eventId,
        senderId: isSelf ? 'current_user' : sender,
        recipientId: roomId,
        roomId,
        body: content.body,
        timestamp: new Date(event.getTs()).toISOString(),
        matrixEventId: eventId,
        isSelf,
        status: isSelf ? 'sent' : 'received'
      });
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  }

  async sendMessage(roomId, body) {
    if (!this.client) {
      return { success: false, error: 'Matrix client not initialized' };
    }

    try {
      const content = {
        msgtype: 'm.text',
        body: body
      };

      const result = await this.client.sendEvent(roomId, 'm.room.message', content);
      return { success: true, eventId: result.event_id };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  // Parent side: ensure a family room exists for this invite code, aliased so the
  // child can find it from the code alone. Idempotent — re-generating the same
  // code (or a parent re-opening) resolves the existing room instead of erroring.
  async getOrCreateRoomForCode(code) {
    if (!this.client) {
      return { success: false, error: 'Matrix client not initialized' };
    }

    const fullAlias = roomAliasForCode(code);
    const localpart = roomAliasLocalpart(code);

    const resolveExisting = async () => {
      try {
        const res = await this.client.getRoomIdForAlias(fullAlias);
        return res?.room_id || null;
      } catch {
        return null;
      }
    };

    const existing = await resolveExisting();
    if (existing) return { success: true, roomId: existing, alias: fullAlias };

    try {
      const res = await this.client.createRoom({
        room_alias_name: localpart,
        name: `FamilyChat ${String(code).toUpperCase()}`,
        // public_chat => join_rules: public, so anyone who knows the (random) alias
        // can join. visibility: private keeps it OUT of the public room directory,
        // so codes can't be enumerated — the code itself is the shared secret.
        preset: 'public_chat',
        visibility: 'private'
      });
      return { success: true, roomId: res.room_id, alias: fullAlias };
    } catch (error) {
      // Lost a create race (alias already taken) — resolve and use it.
      const raced = await resolveExisting();
      if (raced) return { success: true, roomId: raced, alias: fullAlias };
      console.error('Error creating family room:', error);
      return { success: false, error: error.message };
    }
  }

  // Child side: resolve the alias from the code and join. Returns the roomId so
  // the caller can immediately reconcile + open the chat.
  async joinRoomByCode(code) {
    if (!this.client) {
      return { success: false, error: 'Matrix client not initialized' };
    }

    const fullAlias = roomAliasForCode(code);
    try {
      const room = await this.client.joinRoom(fullAlias);
      const roomId = room?.roomId || room?.room_id;
      return { success: true, roomId };
    } catch (error) {
      console.error('Error joining family room:', error);
      return { success: false, error: error.message };
    }
  }

  async setDisplayName(name) {
    if (!this.client || !name) return { success: false };
    try {
      await this.client.setDisplayName(name);
      return { success: true };
    } catch (error) {
      console.error('Error setting display name:', error);
      return { success: false, error: error.message };
    }
  }

  getUserId() {
    return this.client?.getUserId?.() || null;
  }

  async createDirectRoom(userId) {
    if (!this.client) {
      return { success: false, error: 'Matrix client not initialized' };
    }

    try {
      const room = await this.client.createRoom({
        preset: 'trusted_private_chat',
        invite: [userId],
        is_direct: true
      });

      return { success: true, roomId: room.room_id };
    } catch (error) {
      console.error('Error creating direct room:', error);
      return { success: false, error: error.message };
    }
  }

  async getDirectRooms() {
    if (!this.client) {
      return [];
    }

    try {
      const rooms = this.client.getRooms();
      return rooms.filter(room => room.isDirectMessageForUserId(this.client.getUserId()));
    } catch (error) {
      console.error('Error getting direct rooms:', error);
      return [];
    }
  }

  async login(username, password) {
    try {
      const tempClient = Matrix.createClient({
        baseUrl: HOMESERVER_URL
      });

      const result = await tempClient.login('m.login.password', {
        user: username,
        password,
        initial_device_display_name: 'FamilyChat'
      });

      return {
        success: true,
        userId: result.user_id,
        accessToken: result.access_token,
        deviceId: result.device_id
      };
    } catch (error) {
      console.error('Matrix login error:', error);
      return { success: false, error: error.message };
    }
  }

  async registerDevice(username, password) {
    try {
      const tempClient = Matrix.createClient({
        baseUrl: HOMESERVER_URL
      });

      // matrix-js-sdk signature is register(username, password, sessionId, auth).
      // Most servers accept the dummy stage directly; some first reply 401 with a
      // UIA session id, so retry that single stage carrying the session.
      const attempt = (sessionId) =>
        tempClient.register(username, password, sessionId, {
          type: 'm.login.dummy',
          ...(sessionId ? { session: sessionId } : {})
        });

      let result;
      try {
        result = await attempt(null);
      } catch (err) {
        const session = err?.data?.session;
        if (!session) throw err;
        result = await attempt(session);
      }

      return {
        success: true,
        userId: result.user_id,
        accessToken: result.access_token,
        deviceId: result.device_id
      };
    } catch (error) {
      console.error('Error registering device:', error);
      return { success: false, error: error.message };
    }
  }

  generateDeviceLinkCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return code;
  }

  async validateDeviceLinkCode(code) {
    return code.length === 6 && /^[A-Z0-9]+$/.test(code);
  }

  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.stopClient();
        this.client = null;
        this.isInitialized = false;

        if (this.appStateSubscription) {
          this.appStateSubscription.remove();
          this.appStateSubscription = null;
        }
        if (this.reconcileTimer) {
          clearTimeout(this.reconcileTimer);
          this.reconcileTimer = null;
        }

        return { success: true };
      } catch (error) {
        console.error('Error during logout:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }

  setOnMessageReceived(callback) {
    this.onMessageReceived = callback;
  }

  isReady() {
    return this.isInitialized && this.client;
  }
}

export default new MatrixService();
