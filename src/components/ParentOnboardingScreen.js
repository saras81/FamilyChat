import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';
import { AuthContext } from '../context/AuthContext';

const parentPalette = {
  primary: '#1E2A78',
  background: '#F4F6FF',
  panel: '#FFFFFF',
  muted: '#66708A',
  border: '#DDE4FF'
};

const toMatrixUsername = (email) => email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

const ParentOnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentAccount, setParentAccount] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const { logout } = useContext(AuthContext);

  const handleCreateParentAccount = async () => {
    if (!parentName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter your name, email, and password.');
      return;
    }

    setIsCreating(true);
    try {
      await DatabaseService.initialize();

      const parentId = `parent_${Date.now()}`;
      const normalizedEmail = email.trim().toLowerCase();
      let matrixUserId = null;
      let accessToken = `local_parent_${Date.now()}`;
      let deviceId = `local_device_${Date.now()}`;

      try {
        const matrixTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Matrix registration timeout')), 4000);
        });

        const matrixResult = await Promise.race([
          MatrixService.registerDevice(toMatrixUsername(normalizedEmail), password),
          matrixTimeout
        ]);

        if (matrixResult.success) {
          matrixUserId = matrixResult.userId;
          accessToken = matrixResult.accessToken;
          deviceId = matrixResult.deviceId;
          // Bring the parent's Matrix client online now so we can create the
          // family room (and set a display name the child will see) below.
          await MatrixService.initialize(matrixResult.userId, matrixResult.accessToken, matrixResult.deviceId);
          await MatrixService.setDisplayName(parentName.trim());
        }
      } catch (matrixError) {
        console.log('Matrix registration unavailable, continuing with local parent account:', matrixError.message);
      }

      await DatabaseService.addContact({
        id: parentId,
        displayName: parentName.trim(),
        isChild: false,
        isSafeList: true,
        approvalStatus: 'approved',
        handle: normalizedEmail,
        matrixUserId
      });
      await DatabaseService.saveParentAccount(normalizedEmail, password, parentId, parentName.trim());

      setParentAccount({
        userId: parentId,
        accessToken,
        deviceId
      });
      setStep(2);
    } catch (error) {
      console.error('Error creating parent account:', error);
      Alert.alert('Registration Failed', error.message || 'Could not create account. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetupFamily = async () => {
    if (!familyName.trim()) {
      Alert.alert('Missing Family Name', 'Please name your family unit.');
      return;
    }

    try {
      const inviteResult = await DatabaseService.createChildInvite('First child');
      const inviteCode = inviteResult.invite?.code || null;

      // Create the Matrix room the child will join from this code. The code is
      // carried as a room alias, so a child on a different device can resolve it.
      if (inviteCode && MatrixService.isReady()) {
        await MatrixService.getOrCreateRoomForCode(inviteCode);
      }

      await DatabaseService.addFamily({
        id: `family_${Date.now()}`,
        familyName: familyName.trim(),
        parentMatrixUserId: parentAccount?.userId,
        inviteCode
      });

      await DatabaseService.saveLoginDetails(
        parentAccount.userId,
        parentAccount.accessToken,
        parentAccount.deviceId,
        'parent',
        familyName.trim()
      );

      setStep(3);
    } catch (error) {
      console.error('Error saving family:', error);
      Alert.alert('Setup Failed', 'Unable to save your family setup. Please try again.');
    }
  };

  const handleSuccessLogout = async () => {
    await MatrixService.logout();
    await DatabaseService.deleteLoginDetails();
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }]
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepRow}>
      {[1, 2, 3].map(item => (
        <View
          key={item}
          style={[
            styles.stepDot,
            item <= step && { backgroundColor: parentPalette.primary }
          ]}
        />
      ))}
    </View>
  );

  const renderAccountStep = () => (
    <View style={styles.panel}>
      <Text style={styles.stepTitle}>Create Parent Account</Text>
      <Text style={styles.stepSubtitle}>Use an email and password to secure the parent dashboard.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={parentName}
          onChangeText={setParentName}
          placeholder="Parent name"
          placeholderTextColor="#8A8F99"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="parent@example.com"
          placeholderTextColor="#8A8F99"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Create password"
          placeholderTextColor="#8A8F99"
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isCreating && styles.disabledButton]}
        onPress={handleCreateParentAccount}
        disabled={isCreating}
      >
        <Text style={styles.primaryButtonText}>{isCreating ? 'Creating...' : 'Continue'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFamilyStep = () => (
    <View style={styles.panel}>
      <Text style={styles.stepTitle}>Setup Your Family</Text>
      <Text style={styles.stepSubtitle}>Name your family unit. You can invite linked children from the dashboard.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Family Name</Text>
        <TextInput
          style={styles.input}
          value={familyName}
          onChangeText={setFamilyName}
          placeholder="The Johnson Family"
          placeholderTextColor="#8A8F99"
        />
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSetupFamily}>
        <Text style={styles.primaryButtonText}>Finish Setup</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.panel}>
      <View style={styles.successBadge}>
        <Text style={styles.successMark}>✓</Text>
      </View>
      <Text style={styles.stepTitle}>Success!</Text>
      <Text style={styles.stepSubtitle}>
        Your parent account and family unit are ready. Sign in again to initialize parent permissions.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSuccessLogout}>
        <Text style={styles.primaryButtonText}>Return to Login</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parent Setup</Text>
        <Text style={styles.headerSubtitle}>Secure family administration</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <StepIndicator />
        {step === 1 && renderAccountStep()}
        {step === 2 && renderFamilyStep()}
        {step === 3 && renderSuccessStep()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: parentPalette.background
  },
  header: {
    backgroundColor: parentPalette.primary,
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#DDE4FF',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18
  },
  stepDot: {
    width: 34,
    height: 6,
    borderRadius: 3,
    backgroundColor: parentPalette.border
  },
  panel: {
    backgroundColor: parentPalette.panel,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#1B2452',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  stepTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#22283A',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  stepSubtitle: {
    fontSize: 15,
    color: parentPalette.muted,
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
    color: '#22283A',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  input: {
    borderWidth: 1.5,
    borderColor: parentPalette.primary,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1F2430',
    backgroundColor: '#FBFCFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  primaryButton: {
    backgroundColor: parentPalette.primary,
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
  },
  successBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F8EF',
    marginBottom: 18
  },
  successMark: {
    fontSize: 38,
    color: '#15814A',
    fontWeight: '900'
  }
});

export default ParentOnboardingScreen;
