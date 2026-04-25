import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { Camera } from 'expo-camera';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';

const ChildOnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [childName, setChildName] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleScanQRCode = async () => {
    const hasCameraPermission = await requestCameraPermission();
    
    if (!hasCameraPermission) {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required to scan QR codes. Please enable camera access in your device settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Settings',
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return;
    }

    setIsScanning(true);
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    setIsScanning(false);
    
    try {
      const code = data.includes('familychat:') 
        ? data.split(':')[1] 
        : data;
      
      if (await MatrixService.validateDeviceLinkCode(code)) {
        setLinkCode(code);
        setStep(2);
      } else {
        Alert.alert('Invalid Code', 'This is not a valid FamilyChat device link code');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not read QR code. Please try again.');
    }
  };

  const handleJoinFamily = async () => {
    if (!childName.trim()) {
      Alert.alert('Missing Name', 'Please enter your name');
      return;
    }

    if (!linkCode.trim()) {
      Alert.alert('Missing Code', 'Please enter or scan a device link code');
      return;
    }

    setIsJoining(true);

    try {
      await DatabaseService.initialize();
      
      const childId = `child_${Date.now()}`;
      const matrixUsername = `child_${Date.now()}`;
      const matrixPassword = `temp_${Date.now()}`;

      const matrixResult = await MatrixService.registerDevice(
        matrixUsername,
        matrixPassword
      );

      if (matrixResult.success) {
        await DatabaseService.addContact({
          id: childId,
          displayName: childName,
          isChild: true,
          isSafeList: true,
          matrixUserId: matrixResult.userId
        });

        await MatrixService.initialize(
          matrixResult.userId,
          matrixResult.accessToken,
          matrixResult.deviceId
        );

        Alert.alert(
          'Welcome to FamilyChat! 🎉',
          `Hi ${childName}! You've successfully joined your family.\n\nYou can now message people on your Safe List.`,
          [
            {
              text: 'Start Chatting',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'SafeList' }]
                });
              }
            }
          ]
        );
      } else {
        throw new Error(matrixResult.error);
      }
    } catch (error) {
      console.error('Error joining family:', error);
      Alert.alert(
        'Error',
        'Could not join family. Please check your code and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsJoining(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Join My Family</Text>
      <Text style={styles.stepSubtitle}>
        Enter the 6-digit code your parent gave you, or scan their QR code
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={childName}
          onChangeText={setChildName}
          placeholder="Enter your name"
          placeholderTextColor="#999999"
          maxLength={30}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Device Link Code</Text>
        <TextInput
          style={[styles.input, { fontSize: 24, letterSpacing: 4 }]}
          value={linkCode}
          onChangeText={setLinkCode}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#999999"
          maxLength={6}
          autoCapitalize="characters"
          textAlign="center"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { flex: 1, marginRight: 8 }]}
          onPress={handleScanQRCode}
        >
          <Text style={styles.secondaryButtonText}>📷 Scan QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1, marginLeft: 8 }]}
          onPress={() => setStep(2)}
          disabled={!childName.trim() || !linkCode.trim()}
        >
          <Text style={styles.primaryButtonText}>Join Family</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>Need help?</Text>
        <Text style={styles.helpText}>
          Ask your parent for the 6-digit code or QR code from their FamilyChat app
        </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Confirm Your Details</Text>
      <Text style={styles.stepSubtitle}>
        Please check that everything looks correct
      </Text>

      <View style={styles.confirmBox}>
        <Text style={styles.confirmLabel}>Your Name:</Text>
        <Text style={styles.confirmValue}>{childName}</Text>
        
        <Text style={styles.confirmLabel}>Device Link Code:</Text>
        <Text style={styles.confirmValue}>{linkCode}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isJoining && styles.disabledButton]}
        onPress={handleJoinFamily}
        disabled={isJoining}
      >
        <Text style={styles.primaryButtonText}>
          {isJoining ? 'Joining...' : 'Confirm & Join Family'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setStep(1)}
        disabled={isJoining}
      >
        <Text style={styles.secondaryButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQRScanner = () => (
    <View style={styles.scannerContainer}>
      <Camera
        style={styles.scanner}
        type={Camera.Constants.Type.back}
        onBarCodeScanned={isScanning ? handleBarCodeScanned : undefined}
        barCodeScannerSettings={{
          barCodeTypes: ['qr'],
        }}
      />
      
      <View style={styles.scannerOverlay}>
        <View style={styles.scannerFrame} />
        <Text style={styles.scannerText}>
          Position the QR code inside the frame
        </Text>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setIsScanning(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isScanning) {
    return renderQRScanner();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FamilyChat</Text>
        <Text style={styles.headerSubtitle}>Safe family messaging</Text>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
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
  content: {
    flex: 1,
    padding: 20
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  inputGroup: {
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  input: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 24
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center'
  },
  disabledButton: {
    backgroundColor: '#CCCCCC'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  helpBox: {
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 24
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  helpText: {
    fontSize: 14,
    color: '#4A90E2',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  confirmValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
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
    justifyContent: 'center',
    alignItems: 'center'
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#4A90E2',
    borderRadius: 12,
    backgroundColor: 'transparent'
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 40
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default ChildOnboardingScreen;
