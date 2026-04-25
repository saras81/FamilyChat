import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';

const ParentSettingsScreen = ({ navigation }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleParentalPurge = () => {
    Alert.alert(
      'Parental Purge',
      'This will permanently delete:\n\n• All messages\n• All contacts\n• All media files\n• All app data\n\nThis action cannot be undone. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: executeParentalPurge
        }
      ]
    );
  };

  const executeParentalPurge = async () => {
    setIsProcessing(true);
    
    try {
      const result = await DatabaseService.parentalPurge();
      
      if (result.success) {
        await MatrixService.logout();
        
        Alert.alert(
          'Purge Complete',
          'All data has been permanently deleted. The app will now restart.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Onboarding' }]
                });
              }
            }
          ]
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Parental purge error:', error);
      Alert.alert(
        'Error',
        'Could not complete the purge. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSafeList = () => {
    Alert.alert(
      'Manage Safe List',
      'This feature will allow you to:\n\n• Add contacts to your child\'s Safe List\n• Remove contacts from Safe List\n• View current Safe List members\n\nTODO: Implement Safe List management UI',
      [{ text: 'OK' }]
    );
  };

  const handleAddChild = () => {
    Alert.alert(
      'Add Child',
      'This will:\n\n• Create a new child profile\n• Generate a QR code or 6-digit code\n• Allow child device to join your family\n\nTODO: Implement child profile creation',
      [{ text: 'OK' }]
    );
  };

  const handleViewReports = () => {
    Alert.alert(
      'Activity Reports',
      'This will show:\n\n• Message statistics\n• Contact activity\n• Usage patterns\n\nTODO: Implement activity reporting',
      [{ text: 'OK' }]
    );
  };

  const SettingItem = ({ title, subtitle, onPress, destructive = false }) => (
    <TouchableOpacity
      style={[
        styles.settingItem,
        destructive && styles.destructiveItem
      ]}
      onPress={onPress}
      disabled={isProcessing}
      activeOpacity={0.7}
    >
      <View style={styles.settingContent}>
        <Text style={[
          styles.settingTitle,
          destructive && styles.destructiveTitle
        ]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        )}
      </View>
      <Text style={styles.settingArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parent Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your family's safety</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Management</Text>
          
          <SettingItem
            title="Add Child"
            subtitle="Create a new child profile and device link"
            onPress={handleAddChild}
          />
          
          <SettingItem
            title="Manage Safe List"
            subtitle="Control who your child can message"
            onPress={handleManageSafeList}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monitoring</Text>
          
          <SettingItem
            title="Activity Reports"
            subtitle="View messaging and usage statistics"
            onPress={handleViewReports}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          
          <SettingItem
            title="Parental Purge"
            subtitle="Delete all app data permanently"
            onPress={handleParentalPurge}
            destructive={true}
          />
        </View>

        {isProcessing && (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>Deleting data...</Text>
          </View>
        )}
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
    flex: 1
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  destructiveItem: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2'
  },
  settingContent: {
    flex: 1
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  destructiveTitle: {
    color: '#D32F2F'
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666666',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  settingArrow: {
    fontSize: 24,
    color: '#CCCCCC',
    fontWeight: 'bold'
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  processingText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default ParentSettingsScreen;
