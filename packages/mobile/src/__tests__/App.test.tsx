import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../../App';

// Mock navigation
jest.mock('../navigation/AppNavigator', () => ({
  AppNavigator: () => null,
}));

describe('App', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<App />);
    expect(toJSON()).toBeDefined();
  });
});