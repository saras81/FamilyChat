import * as Matrix from 'matrix-js-sdk';
import { AppState } from 'react-native';

class MatrixService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.appStateSubscription = null;
  }

  async initialize(userId, accessToken, deviceId) {
    try {
      this.client = Matrix.createClient({
        baseUrl: 'https://matrix.org',
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
      if (nextAppState === 'background') {
        // Pause Matrix client when app goes to background
        if (this.client) {
          this.client.pause();
        }
      } else if (nextAppState === 'active') {
        // Resume Matrix client when app becomes active
        if (this.client) {
          this.client.resume();
        }
      }
    });
  }

  setupEventListeners() {
    if (!this.client) return;

    this.client.on('event', (event) => {
      if (event.getType() === 'm.room.message') {
        this.handleNewMessage(event);
      }
    });

    this.client.on('sync', (state, prevState, data) => {
      switch (state) {
        case 'PREPARED':
          break;
        case 'SYNCING':
          break;
        case 'ERROR':
          console.error('Matrix sync error:', data);
          break;
      }
    });
  }

  async handleNewMessage(event) {
    try {
      const content = event.getContent();
      const sender = event.getSender();
      const roomId = event.getRoomId();
      
      const message = {
        id: event.getId(),
        senderId: sender,
        recipientId: roomId,
        body: content.body,
        timestamp: event.getTs(),
        matrixEventId: event.getId(),
        status: 'received'
      };

      this.onMessageReceived?.(message);
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
        baseUrl: 'https://matrix.org'
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
        baseUrl: 'https://matrix.org'
      });

      const result = await tempClient.register('m.login.dummy', {
        username: username,
        password: password,
        device_id: `device_${Date.now()}`
      });

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

        // Clean up app state listener
        if (this.appStateSubscription) {
          this.appStateSubscription.remove();
          this.appStateSubscription = null;
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
