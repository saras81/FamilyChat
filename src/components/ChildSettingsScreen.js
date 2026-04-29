import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import DatabaseService from '../database/DatabaseService';

const ChildSettingsScreen = ({ navigation }) => {
  const [childName, setChildName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadChildProfile();
  }, []);

  const loadChildProfile = async () => {
    try {
      const contacts = await DatabaseService.getAllContacts();
      const childContact = contacts.find(contact => contact.is_child);

      if (childContact) {
        setChildName(childContact.display_name);
        setNewName(childContact.display_name);
      }
    } catch (error) {
      console.error('Error loading child profile:', error);
    }
  };

  const saveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a valid name');
      return;
    }

    setIsLoading(true);
    try {
      const contacts = await DatabaseService.getAllContacts();
      const childContact = contacts.find(contact => contact.is_child);

      if (childContact) {
        // Update the contact name
        await DatabaseService.addContact({
          ...childContact,
          displayName: newName.trim()
        });

        setChildName(newName.trim());
        setIsEditing(false);
        Alert.alert('Success', 'Your name has been updated!');
      }
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Could not update your name. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSafeList = () => {
    navigation.navigate('SafeList');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Settings</Text>
        <Text style={styles.headerSubtitle}>{childName}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Profile</Text>

          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {childName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.label}>Name</Text>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Enter your name"
                    maxLength={30}
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={[styles.editButton, styles.cancelButton]}
                      onPress={() => {
                        setNewName(childName);
                        setIsEditing(false);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editButton, styles.saveButton, isLoading && styles.disabledButton]}
                      onPress={saveName}
                      disabled={isLoading}
                    >
                      <Text style={styles.saveButtonText}>
                        {isLoading ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.nameContainer}>
                  <Text style={styles.nameText}>{childName}</Text>
                  <TouchableOpacity
                    style={styles.editNameButton}
                    onPress={() => setIsEditing(true)}
                  >
                    <Text style={styles.editNameText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={navigateToSafeList}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionEmoji}>💬</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Start Messaging</Text>
              <Text style={styles.actionDescription}>
                Chat with your approved family contacts
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Welcome to FamilyChat! You can message approved family members
              and change your display name anytime.
            </Text>
            <Text style={styles.infoText}>
              All your messages are monitored by your parents for safety.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#E8F4FD',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20
  },
  section: {
    marginBottom: 30
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  profileInfo: {
    flex: 1
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  editNameButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  editNameText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  editContainer: {
    gap: 10
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10
  },
  editButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCCCCC'
  },
  cancelButtonText: {
    color: '#666666',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  saveButton: {
    backgroundColor: '#4A90E2'
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  disabledButton: {
    opacity: 0.6
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },
  actionEmoji: {
    fontSize: 24
  },
  actionInfo: {
    flex: 1
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  actionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  actionArrow: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: 'bold'
  },
  infoCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 20,
    gap: 10
  },
  infoText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default ChildSettingsScreen;