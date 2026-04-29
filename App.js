import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StatusBar, View, Text, StyleSheet } from 'react-native';

import DatabaseService from './src/database/DatabaseService';
import MatrixService from './src/services/MatrixService';
import { AuthProvider, AuthContext } from './src/context/AuthContext';

import LoginScreen from './src/components/LoginScreen';
import ParentOnboardingScreen from './src/components/ParentOnboardingScreen';
import ChildOnboardingScreen from './src/components/ChildOnboardingScreen';
import ParentManagementScreen from './src/components/ParentManagementScreen';
import ChildSettingsScreen from './src/components/ChildSettingsScreen';
import SafeListScreen from './src/components/SafeListScreen';
import ChatScreen from './src/components/ChatScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = ({ isParent }) => {
  const tintColor = isParent ? '#1E2A78' : '#40C7A7';
  const inactiveTintColor = isParent ? '#C8D2FF' : '#CFF8EC';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tintColor,
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
        tabBarInactiveTintColor: inactiveTintColor
      }}
    >
      {isParent && (
        <Tab.Screen
          name="Dashboard"
          component={ParentManagementScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: () => null
          }}
        />
      )}
      <Tab.Screen
        name="SafeList"
        component={SafeListScreen}
        options={{
          tabBarLabel: 'Safe List',
          tabBarIcon: () => null
        }}
      />
      {!isParent && (
        <Tab.Screen
          name="Settings"
          component={ChildSettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: () => null
          }}
        />
      )}
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { isLoggedIn, userRole, login, logout } = useContext(AuthContext);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database initialization timeout')), 10000);
        });

        await Promise.race([
          DatabaseService.initialize(),
          timeoutPromise
        ]);

        // Attempt to load existing session
        const storedDetails = await DatabaseService.getLoginDetails();
        if (storedDetails?.userId && storedDetails?.accessToken && storedDetails?.deviceId && storedDetails?.userRole) {
          if (storedDetails.accessToken.startsWith('local_')) {
            login(storedDetails.userRole, storedDetails.userId, storedDetails.familyName);
            setIsInitialized(true);
            return;
          }

          const matrixInit = await MatrixService.initialize(storedDetails.userId, storedDetails.accessToken, storedDetails.deviceId);
          if (matrixInit.success) {
            login(storedDetails.userRole, storedDetails.userId, storedDetails.familyName);
          } else {
            console.error('Matrix re-initialization failed:', matrixInit.error);
            logout(); // Force logout if Matrix re-init fails
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading FamilyChat...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={userRole === 'parent' ? '#1E2A78' : '#40C7A7'} />

      {isLoggedIn ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="Main"
            component={() => <MainTabNavigator isParent={userRole === 'parent'} />}
          />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ParentSetup" component={ParentOnboardingScreen} />
          <Stack.Screen name="ChildOnboarding" component={ChildOnboardingScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
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
  }
});

export default App;
