import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions
} from 'react-native';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';

const { width, height } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
  const { contact } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: contact.display_name,
      headerStyle: { backgroundColor: '#4A90E2' },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: { 
        fontSize: 24, 
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
      }
    });

    loadMessages();
    setupMatrixListener();

    return () => {
      MatrixService.setOnMessageReceived(null);
    };
  }, [contact, navigation]);

  const setupMatrixListener = () => {
    MatrixService.setOnMessageReceived((message) => {
      if (message.senderId === contact.id || message.recipientId === contact.id) {
        setMessages(prev => [...prev, message]);
      }
    });
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const loadedMessages = await DatabaseService.getMessages(contact.id);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Could not load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const tempMessage = {
      id: `temp_${Date.now()}`,
      senderId: 'current_user',
      recipientId: contact.id,
      body: messageText,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const matrixResult = await MatrixService.sendMessage(contact.matrix_user_id, messageText);
      
      if (matrixResult.success) {
        const messageData = {
          id: matrixResult.eventId,
          senderId: 'current_user',
          recipientId: contact.id,
          body: messageText,
          timestamp: new Date().toISOString(),
          status: 'sent',
          matrixEventId: matrixResult.eventId
        };

        await DatabaseService.addMessage(messageData);
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id ? messageData : msg
          )
        );
      } else {
        throw new Error(matrixResult.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message');
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === 'current_user';
    const bubbleColor = isCurrentUser ? '#4A90E2' : '#E8F4FD';
    const textColor = isCurrentUser ? '#FFFFFF' : '#333333';
    const statusColor = item.status === 'sent' ? '#4CAF50' : 
                       item.status === 'failed' ? '#F44336' : '#FFA500';

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        <View style={[
          styles.messageBubble,
          { backgroundColor: bubbleColor }
        ]}>
          <Text style={[styles.messageText, { color: textColor }]}>
            {item.body}
          </Text>
          <Text style={[styles.messageTime, { color: textColor }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        {isCurrentUser && item.status !== 'sent' && (
          <Text style={[styles.messageStatus, { color: statusColor }]}>
            {item.status === 'sending' ? '⏳' : '❌'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.messagesContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999999"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { opacity: newMessage.trim() ? 1 : 0.5 }
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  messagesContainer: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  messagesList: {
    flex: 1
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 12
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%'
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start'
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 60
  },
  messageText: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8
  },
  messageStatus: {
    fontSize: 12,
    marginTop: 2
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  textInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  sendButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default ChatScreen;
