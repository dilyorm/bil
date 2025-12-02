import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChatScreen } from '../screens/main/ChatScreen';
import { DevicesScreen } from '../screens/main/DevicesScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';

export type MainTabParamList = {
  Chat: undefined;
  Devices: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e0e0e0',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          // TODO: Add tab bar icon
        }}
      />
      <Tab.Screen 
        name="Devices" 
        component={DevicesScreen}
        options={{
          tabBarLabel: 'Devices',
          // TODO: Add tab bar icon
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          // TODO: Add tab bar icon
        }}
      />
    </Tab.Navigator>
  );
};