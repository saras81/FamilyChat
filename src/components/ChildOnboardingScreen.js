import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';
import { AuthContext } from '../context/AuthContext';

const childPalette = {
  primary: '#40C7A7',
  background: '#F2FFF9',
  panel: '#FFFFFF',
  muted: '#5E716B',
  border: '#CFF8EC'
};

const avatarOptions = ['Sun', 'Star', 'Rocket', 'Heart'];

const ChildOnboardingScreen = ({ route, navigation }) => {
  const validatedCode = route.params?.deviceCode;
  const [childName, setChildName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatarOptions[0]);
  const [isJoining, setIsJoining] = useState(false);
  const [isCodeReady, setIsCodeReady] = useState(false);
  const { login } = useContext(AuthContext);

  useEffect(() => {
    const verifyEntry = async () => {
      if (!validatedCode || !(await MatrixService.validateDeviceLinkCode(validatedCode))) {
        Alert.alert('Family Link Required', 'Please validate your family code before creating a profile.', [
          { text: 'Back to Login', onPress: () => navigation.replace('Login') }
        ]);
        return;
      }

      const validation = await DatabaseService.validateInviteCode(validatedCode);
      if (!validation.success) {
        Alert.alert('Invalid Family Link', validation.error || 'Ask your parent for a fresh invite code.', [
          { text: 'Back to Login', onPress: () => navigation.replace('Login') }
        ]);
        return;
      }

      setIsCodeReady(true);
    };

    verifyEntry();
  }, [navigation, validatedCode]);

  const handleCreateProfile = async () => {
    if (!isCodeReady) {
      Alert.alert('Family Link Required', 'Please validate your family code before creating a profile.');
      return;
    }

    if (!childName.trim()) {
      Alert.alert('Missing Username', 'Please enter a username for your child profile.');
      return;
    }

    setIsJoining(true);
    try {
      const matrixUsername = `child_${Date.now()}`;
      const matrixPassword = `${validatedCode}_${Date.now()}`;
      const matrixResult = await MatrixService.registerDevice(matrixUsername, matrixPassword);

      if (!matrixResult.success) {
        throw new Error(matrixResult.error || 'Could not create child account');
      }

      await MatrixService.initialize(matrixResult.userId, matrixResult.accessToken, matrixResult.deviceId);

      await DatabaseService.addContact({
        id: matrixResult.userId,
        displayName: childName.trim(),
        avatarPath: selectedAvatar,
        isChild: true,
        isSafeList: true,
        approvalStatus: 'approved',
        handle: matrixResult.userId,
        matrixUserId: matrixResult.userId
      });

      await DatabaseService.markInviteUsed(validatedCode);
      await DatabaseService.saveLoginDetails(matrixResult.userId, matrixResult.accessToken, matrixResult.deviceId, 'child');
      login('child', matrixResult.userId, null);
    } catch (error) {
      console.error('Error creating child profile:', error);
      Alert.alert('Setup Failed', error.message || 'Could not create this child profile. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  if (!isCodeReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking family link...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Child Profile</Text>
        <Text style={styles.headerSubtitle}>Family link verified</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.stepTitle}>Choose Your Profile</Text>
          <Text style={styles.stepSubtitle}>Pick a username and avatar for safe family chats.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={childName}
              onChangeText={setChildName}
              placeholder="Your name"
              placeholderTextColor="#8A8F99"
              maxLength={30}
            />
          </View>

          <Text style={styles.inputLabel}>Avatar</Text>
          <View style={styles.avatarGrid}>
            {avatarOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.avatarChip, selectedAvatar === option && styles.avatarChipActive]}
                onPress={() => setSelectedAvatar(option)}
              >
                <Text style={[styles.avatarText, selectedAvatar === option && styles.avatarTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isJoining && styles.disabledButton]}
            onPress={handleCreateProfile}
            disabled={isJoining}
          >
            <Text style={styles.primaryButtonText}>{isJoining ? 'Creating...' : 'Start FamilyChat'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: childPalette.background
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: childPalette.background
  },
  loadingText: {
    fontSize: 17,
    color: childPalette.muted,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  header: {
    backgroundColor: childPalette.primary,
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#D7FFF0',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20
  },
  panel: {
    backgroundColor: childPalette.panel,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#12483A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  stepTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#1F302C',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  stepSubtitle: {
    fontSize: 15,
    color: childPalette.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  inputGroup: {
    marginBottom: 18
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F302C',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  input: {
    borderWidth: 1.5,
    borderColor: childPalette.primary,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1F302C',
    backgroundColor: '#FBFFFD',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20
  },
  avatarChip: {
    borderWidth: 1.5,
    borderColor: childPalette.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF'
  },
  avatarChipActive: {
    backgroundColor: childPalette.primary,
    borderColor: childPalette.primary
  },
  avatarText: {
    color: '#1F302C',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  avatarTextActive: {
    color: '#FFFFFF'
  },
  primaryButton: {
    backgroundColor: childPalette.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  disabledButton: {
    opacity: 0.55
  }
});

export default ChildOnboardingScreen;
