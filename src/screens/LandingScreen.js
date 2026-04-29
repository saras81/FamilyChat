import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Switch } from 'react-native';

const LandingScreen = ({ navigation }) => {
  const [isParent, setIsParent] = useState(false);

  const handleToggle = () => {
    setIsParent(previousState => !previousState);
  };

  const handleContinue = () => {
    if (isParent) {
      // Navigate to Parent Registration
      navigation.navigate('ParentRegistration');
    } else {
      // Navigate to Child Linking
      navigation.navigate('LinkFamily');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to FamilyChat!</Text>
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Are you a Parent?</Text>
        <Switch
          trackColor={{ false: "#81b0ff", true: "#767577" }}
          thumbColor={isParent ? "#00008B" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={handleToggle}
          value={isParent}
        />
      </View>
      <Text style={styles.roleIndicator}>
        {isParent ? 'Parent Mode' : 'Child Mode'}
      </Text>
      <View style={styles.buttonContainer}>
        <Button title="Continue" onPress={handleContinue} color={isParent ? "#00008B" : "#FF69B4"} />
      </View>
    </View>
  );
};

// Define distinct color palettes
const parentColors = {
  primary: '#00008B', // Indigo/Navy
  secondary: '#4682B4', // Steel Blue
  background: '#F0F8FF', // Alice Blue
  text: '#FFFFFF',
};

const childColors = {
  primary: '#FF69B4', // Hot Pink (Pastel/Bright)
  secondary: '#FFB6C1', // Light Pink
  background: '#FFF0F5', // Lavender Blush
  text: '#333333',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: parentColors.background, // Default to parent background
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: parentColors.primary, // Default to parent primary color
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 18,
    marginRight: 10,
    color: '#333333',
  },
  roleIndicator: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 40,
    color: parentColors.secondary, // Default to parent secondary color
  },
  buttonContainer: {
    marginTop: 20,
    width: '80%',
  },
});

export default LandingScreen;
