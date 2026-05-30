import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';
import { AuthContext } from '../context/AuthContext';

const toMatrixUsername = (email) => email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

const LoginScreen = ({ navigation }) => {
  const [role, setRole] = useState('parent');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { login, logout } = useContext(AuthContext);

  const isParent = role === 'parent';
  const palette = isParent ? parentPalette : childPalette;

  useEffect(() => {
    const checkUserRole = async () => {
      const storedRole = await DatabaseService.getUserRole();
      if (!storedRole) logout();
    };
    checkUserRole();
  }, [logout]);

  const handleParentLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const matrixTimeout = new Promise((resolve) => {
        setTimeout(() => resolve({ success: false, error: 'Matrix login timeout' }), 4000);
      });
      let response = await Promise.race([
        MatrixService.login(toMatrixUsername(normalizedEmail), password),
        matrixTimeout
      ]);

      if (!response.success) {
        const localLogin = await DatabaseService.validateParentAccount(normalizedEmail, password);
        if (!localLogin.success) {
          Alert.alert('Login Failed', response.error || localLogin.error || 'Invalid credentials');
          return;
        }

        response = {
          success: true,
          userId: localLogin.account.parent_id,
          accessToken: `local_parent_${Date.now()}`,
          deviceId: `local_device_${Date.now()}`
        };
      }

      if (!response.success) {
        Alert.alert('Login Failed', response.error || 'Invalid credentials');
        return;
      }

      // Bring the Matrix client online for real (non-local) sessions so the
      // parent syncs the family room, reconciles the child contact, and can chat.
      if (!String(response.accessToken).startsWith('local_')) {
        await MatrixService.initialize(response.userId, response.accessToken, response.deviceId);
      }

      const family = await DatabaseService.getFamily();
      await DatabaseService.saveLoginDetails(
        response.userId,
        response.accessToken,
        response.deviceId,
        'parent',
        family?.family_name || null
      );

      login('parent', response.userId, family?.family_name || null);
    } catch (error) {
      console.error('Parent login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateChildCode = async (codeOverride) => {
    const normalizedCode = (codeOverride || deviceCode).trim().toUpperCase();

    if (!normalizedCode) {
      Alert.alert('Missing Code', 'Please enter your family link code');
      return;
    }

    if (!(await MatrixService.validateDeviceLinkCode(normalizedCode))) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character code');
      return;
    }

    setIsLoading(true);
    try {
      // Local invite match = same-device flow (offline demo). A miss is normal
      // cross-device — the parent's invite lives in *their* localStorage, not
      // the child's — so we still proceed and let onboarding resolve the code
      // against the homeserver (the code doubles as a family-room alias).
      const validation = await DatabaseService.validateInviteCode(normalizedCode);

      navigation.navigate('ChildOnboarding', {
        deviceCode: normalizedCode,
        inviteId: validation.invite?.id,
        remote: !validation.success
      });
    } catch (error) {
      console.error('Child link validation error:', error);
      Alert.alert('Error', 'Could not validate this code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanQRCode = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera access is required to scan a family QR code.');
        return;
      }
    }

    setIsScanning(true);
  };

  const handleCodeScanned = ({ data }) => {
    const parsedCode = data?.includes('familychat:') ? data.split(':').pop() : data;
    setIsScanning(false);
    setDeviceCode((parsedCode || '').toUpperCase());
    handleValidateChildCode(parsedCode || '');
  };

  if (isScanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.scanner}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleCodeScanned}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>Scan your FamilyChat invite QR</Text>
          <TouchableOpacity style={styles.cancelScanButton} onPress={() => setIsScanning(false)}>
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={palette.primary} />

      <View style={[styles.header, { backgroundColor: palette.primary }]}>
        <Text style={styles.headerTitle}>FamilyChat</Text>
        <Text style={[styles.headerSubtitle, { color: palette.subtle }]}>Secure messaging for families</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.roleCard}>
          <Text style={styles.roleLabel}>Continue as</Text>
          <View style={[styles.toggleContainer, { backgroundColor: palette.toggleBg }]}>
            <TouchableOpacity
              style={[styles.toggleButton, role === 'parent' && { backgroundColor: parentPalette.primary }]}
              onPress={() => setRole('parent')}
            >
              <Text style={[styles.toggleText, role === 'parent' && styles.toggleTextActive]}>Parent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, role === 'child' && { backgroundColor: childPalette.primary }]}
              onPress={() => setRole('child')}
            >
              <Text style={[styles.toggleText, role === 'child' && styles.toggleTextActive]}>Child</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isParent ? (
          <View style={styles.panel}>
            <Text style={styles.formTitle}>Parent Login</Text>
            <Text style={styles.formSubtitle}>Sign in to manage your family, invites, and privacy controls.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.input, { borderColor: palette.primary }]}
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
                style={[styles.input, { borderColor: palette.primary }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#8A8F99"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: palette.primary }, isLoading && styles.disabledButton]}
              onPress={handleParentLogin}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: palette.primary }]}
              onPress={() => navigation.navigate('ParentSetup')}
              disabled={isLoading}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>Create Parent Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.formTitle}>Link to Family</Text>
            <Text style={styles.formSubtitle}>Enter the unique code from your parent before creating your profile.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>6-digit Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput, { borderColor: palette.primary }]}
                value={deviceCode}
                onChangeText={(value) => setDeviceCode(value.toUpperCase())}
                placeholder="A1B2C3"
                placeholderTextColor="#8A8F99"
                maxLength={6}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.childActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.flexButton, { borderColor: palette.primary }]}
                onPress={handleScanQRCode}
              >
                <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>Scan QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.flexButton, { backgroundColor: palette.primary }, isLoading && styles.disabledButton]}
                onPress={() => handleValidateChildCode()}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>{isLoading ? 'Checking...' : 'Validate'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const parentPalette = {
  primary: '#1E2A78',
  background: '#F4F6FF',
  subtle: '#DDE4FF',
  toggleBg: '#E5E9FF'
};

const childPalette = {
  primary: '#40C7A7',
  background: '#F2FFF9',
  subtle: '#D7FFF0',
  toggleBg: '#DFF8EF'
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingTop: 78,
    paddingBottom: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#1B2452',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22283A',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: 'center'
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4A5065',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  toggleTextActive: {
    color: '#FFFFFF'
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#1B2452',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  formTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#22283A',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  formSubtitle: {
    fontSize: 15,
    color: '#636A7D',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
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
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#FBFCFF',
    color: '#1F2430',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  codeInput: {
    fontSize: 23,
    letterSpacing: 4,
    textAlign: 'center'
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  childActions: {
    flexDirection: 'row',
    gap: 12
  },
  flexButton: {
    flex: 1
  },
  disabledButton: {
    opacity: 0.55
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000'
  },
  scanner: {
    flex: 1
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent'
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  cancelScanButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: 28
  },
  cancelScanText: {
    color: '#1E2A78',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default LoginScreen;
