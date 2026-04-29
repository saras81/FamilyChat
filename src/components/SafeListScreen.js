import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform
} from 'react-native';
import DatabaseService from '../database/DatabaseService';
import { AuthContext } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const SafeListScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const { userRole } = useContext(AuthContext);
  const palette = userRole === 'parent'
    ? { primary: '#1E2A78', background: '#F4F6FF', subtle: '#DDE4FF' }
    : { primary: '#40C7A7', background: '#F2FFF9', subtle: '#D7FFF0' };

  useEffect(() => {
    loadSafeList();
    const unsubscribe = navigation.addListener('focus', loadSafeList);
    return unsubscribe;
  }, [navigation]);

  const loadSafeList = useCallback(async () => {
    try {
      setIsLoading(true);
      const safeListContacts = await DatabaseService.getSafeListContacts();
      setContacts(safeListContacts);
      
      const messages = await DatabaseService.getLastMessagePerContact();
      const messageMap = {};
      messages.forEach(msg => {
        messageMap[msg.contact_id] = msg;
      });
      setLastMessages(messageMap);
    } catch (error) {
      console.error('Error loading safe list:', error);
      Alert.alert('Error', 'Could not load contacts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openChat = useCallback((contact) => {
    navigation.navigate('Chat', { contact });
  }, [navigation]);

  const renderContact = useCallback(({ item }) => {
    const lastMessage = lastMessages[item.id];
    const lastMessageText = lastMessage 
      ? lastMessage.body 
      : 'No messages yet';
    const lastMessageTime = lastMessage
      ? new Date(lastMessage.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : '';

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.avatar_path ? (
            <Image source={{ uri: item.avatar_path }} style={styles.avatar} />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>
                {item.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.display_name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessageText}
          </Text>
        </View>
        
        {lastMessageTime ? (
          <Text style={styles.messageTime}>{lastMessageTime}</Text>
        ) : (
          <View style={styles.newMessageIndicator}>
            <Text style={styles.newMessageText}>NEW</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [lastMessages, openChat, palette.primary]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Loading Safe List...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { backgroundColor: palette.primary }]}>
        <Text style={styles.headerTitle}>Safe List</Text>
        <Text style={[styles.headerSubtitle, { color: palette.subtle }]}>
          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
        </Text>
      </View>
      
      {contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Safe List contacts</Text>
          <Text style={styles.emptySubtitle}>
            Ask your parent to add contacts to your Safe List
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          style={styles.contactsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contactsContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 80, // Approximate height of each contact item
            offset: 80 * index,
            index,
          })}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E8F4FD',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  contactsList: {
    flex: 1
  },
  contactsContent: {
    paddingVertical: 8
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  avatarContainer: {
    marginRight: 16
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  contactInfo: {
    flex: 1
  },
  contactName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  lastMessage: {
    fontSize: 16,
    color: '#666666',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  messageTime: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  newMessageIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12
  },
  newMessageText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default React.memo(SafeListScreen);
