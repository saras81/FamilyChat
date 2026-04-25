import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StatusBar, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import DatabaseService from './src/database/DatabaseService';
import MatrixService from './src/services/MatrixService';

import ParentOnboardingScreen from './src/components/ParentOnboardingScreen';
import ChildOnboardingScreen from './src/components/ChildOnboardingScreen';
import SafeListScreen from './src/components/SafeListScreen';
import ChatScreen from './src/components/ChatScreen';
import ParentSettingsScreen from './src/components/ParentSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#4A90E2',
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
          height: 80
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#E8F4FD'
      }}
    >
      <Tab.Screen 
        name="SafeList" 
        component={SafeListScreen}
        options={{
          tabBarLabel: 'Safe List',
          tabBarIcon: () => null
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={ParentSettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: () => null
        }}
      />
    </Tab.Navigator>
  );
};

const ChooseRoleScreen = ({ navigation }) => {
  const handleParentSetup = () => {
    navigation.navigate('ParentOnboarding');
  };

  const handleChildSetup = () => {
    navigation.navigate('ChildOnboarding');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FamilyChat</Text>
        <Text style={styles.headerSubtitle}>Safe family messaging</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.question}>How are you using FamilyChat?</Text>
        
        <TouchableOpacity
          style={[styles.roleButton, styles.parentButton]}
          onPress={handleParentSetup}
          activeOpacity={0.8}
        >
          <Text style={styles.roleEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.roleTitle}>I'm a Parent</Text>
          <Text style={styles.roleDescription}>
            Create a family account and manage my children's messaging
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, styles.childButton]}
          onPress={handleChildSetup}
          activeOpacity={0.8}
        >
          <Text style={styles.roleEmoji}>👶</Text>
          <Text style={styles.roleTitle}>I'm a Child</Text>
          <Text style={styles.roleDescription}>
            Join my family with the code from my parent
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initialize();
      
      const contacts = await DatabaseService.getSafeListContacts();
      const hasExistingData = contacts.length > 0;
      
      setNeedsOnboarding(!hasExistingData);
      setIsInitialized(true);
    } catch (error) {
      console.error('App initialization error:', error);
      setNeedsOnboarding(true);
      setIsInitialized(true);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading FamilyChat...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      
      {needsOnboarding ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ChooseRole" component={ChooseRoleScreen} />
          <Stack.Screen name="ParentOnboarding" component={ParentOnboardingScreen} />
          <Stack.Screen name="ChildOnboarding" component={ChildOnboardingScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
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
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#E8F4FD',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center'
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  roleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8
  },
  parentButton: {
    borderWidth: 3,
    borderColor: '#FF6B6B'
  },
  childButton: {
    borderWidth: 3,
    borderColor: '#4A90E2'
  },
  roleEmoji: {
    fontSize: 48,
    marginBottom: 16
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  roleDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  }
});

export default App;
