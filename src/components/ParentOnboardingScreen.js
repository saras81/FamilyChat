import React, { useState } from 'react';
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

const ParentOnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deviceLinkCode, setDeviceLinkCode] = useState('');

  const handleCreateFamily = async () => {
    if (!familyName.trim() || !parentName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    setIsCreating(true);
    
    try {
      const matrixResult = await MatrixService.registerDevice(
        email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
        password
      );

      if (matrixResult.success) {
        await DatabaseService.initialize();
        
        const familyId = `family_${Date.now()}`;
        await DatabaseService.addContact({
          id: `parent_${Date.now()}`,
          displayName: parentName,
          isChild: false,
          isSafeList: false,
          matrixUserId: matrixResult.userId
        });

        setStep(2);
        generateDeviceLinkCode();
      } else {
        throw new Error(matrixResult.error);
      }
    } catch (error) {
      console.error('Error creating family:', error);
      Alert.alert('Error', 'Could not create family. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const generateDeviceLinkCode = () => {
    const code = MatrixService.generateDeviceLinkCode();
    setDeviceLinkCode(code);
  };

  const handleAddChild = () => {
    Alert.alert(
      'Add Child Device',
      `Share this code with your child's device:\n\n${deviceLinkCode}\n\nOr show them the QR code (TODO: Generate QR code)`,
      [
        {
          text: 'Copy Code',
          onPress: () => {
            Alert.alert('Code Copied', 'Device link code copied to clipboard');
          }
        },
        {
          text: 'Generate New Code',
          onPress: generateDeviceLinkCode
        },
        {
          text: 'Done',
          style: 'default'
        }
      ]
    );
  };

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'SafeList' }]
    });
  };

  const renderStep1 = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.activeStep]} />
        <View style={styles.stepLine} />
        <View style={styles.stepDot} />
        <View style={styles.stepLine} />
        <View style={styles.stepDot} />
      </View>

      <Text style={styles.stepTitle}>Create Your Family</Text>
      <Text style={styles.stepSubtitle}>
        Set up your family account to manage your children's messaging
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Family Name</Text>
          <TextInput
            style={styles.input}
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="The Johnson Family"
            placeholderTextColor="#999999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={parentName}
            onChangeText={setParentName}
            placeholder="Mom/Dad Name"
            placeholderTextColor="#999999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="parent@example.com"
            placeholderTextColor="#999999"
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
            placeholder="Create a secure password"
            placeholderTextColor="#999999"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            isCreating && styles.disabledButton
          ]}
          onPress={handleCreateFamily}
          disabled={isCreating}
        >
          <Text style={styles.primaryButtonText}>
            {isCreating ? 'Creating...' : 'Create Family'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.completedStep]} />
        <View style={[styles.stepLine, styles.completedLine]} />
        <View style={[styles.stepDot, styles.activeStep]} />
        <View style={styles.stepLine} />
        <View style={styles.stepDot} />
      </View>

      <Text style={styles.stepTitle}>Add Your Children</Text>
      <Text style={styles.stepSubtitle}>
        Generate codes to link your children's devices to your family
      </Text>

      <View style={styles.codeSection}>
        <Text style={styles.codeTitle}>Device Link Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{deviceLinkCode}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={generateDeviceLinkCode}
        >
          <Text style={styles.secondaryButtonText}>Generate New Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddChild}
        >
          <Text style={styles.primaryButtonText}>Add Child Device</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          1. Your child installs the FamilyChat app
        </Text>
        <Text style={styles.infoText}>
          2. They select "Join my family"
        </Text>
        <Text style={styles.infoText}>
          3. They enter this 6-digit code
        </Text>
        <Text style={styles.infoText}>
          4. Their device is securely linked to your family
        </Text>
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setStep(3)}
      >
        <Text style={styles.secondaryButtonText}>Continue to Safe List</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep3 = () => (
    <View style={styles.content}>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.completedStep]} />
        <View style={[styles.stepLine, styles.completedLine]} />
        <View style={[styles.stepDot, styles.completedStep]} />
        <View style={[styles.stepLine, styles.completedLine]} />
        <View style={[styles.stepDot, styles.activeStep]} />
      </View>

      <Text style={styles.stepTitle}>Family Created! 🎉</Text>
      <Text style={styles.stepSubtitle}>
        Your family is ready. You can now:
      </Text>

      <View style={styles.featuresList}>
        <Text style={styles.featureItem}>✓ Manage your children's Safe List</Text>
        <Text style={styles.featureItem}>✓ Monitor messaging activity</Text>
        <Text style={styles.featureItem}>✓ Use Parental Purge when needed</Text>
        <Text style={styles.featureItem}>✓ Add more family members anytime</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleContinue}
      >
        <Text style={styles.primaryButtonText}>Go to Safe List</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family Setup</Text>
        <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    backgroundColor: '#FF6B6B',
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
    color: '#FFE0E0',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0'
  },
  activeStep: {
    backgroundColor: '#FF6B6B',
    width: 16,
    height: 16,
    borderRadius: 8
  },
  completedStep: {
    backgroundColor: '#4CAF50'
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8
  },
  completedLine: {
    backgroundColor: '#4CAF50'
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
  form: {
    flex: 1
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
  primaryButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24
  },
  disabledButton: {
    backgroundColor: '#CCCCCC'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12
  },
  secondaryButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  codeSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  codeContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 20
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  infoBox: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  infoText: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  featuresList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32
  },
  featureItem: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default ParentOnboardingScreen;
