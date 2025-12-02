import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${props => props.theme.colors.background};
`;

const Header = styled.header`
  padding: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background-color: ${props => props.theme.colors.surface};
`;

const Title = styled.h1`
  font-size: ${props => props.theme.fontSize.xl};
  font-weight: ${props => props.theme.fontWeight.semibold};
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.lg};
`;

const Section = styled.section`
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const SectionTitle = styled.h2`
  font-size: ${props => props.theme.fontSize.lg};
  font-weight: ${props => props.theme.fontWeight.semibold};
  color: ${props => props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${props => props.theme.spacing.md} 0;
  border-bottom: 1px solid ${props => props.theme.colors.borderLight};

  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.div`
  display: flex;
  flex-direction: column;
`;

const SettingName = styled.span`
  font-size: ${props => props.theme.fontSize.md};
  font-weight: ${props => props.theme.fontWeight.medium};
  color: ${props => props.theme.colors.text};
`;

const SettingDescription = styled.span`
  font-size: ${props => props.theme.fontSize.sm};
  color: ${props => props.theme.colors.textSecondary};
  margin-top: ${props => props.theme.spacing.xs};
`;

const Toggle = styled.input.attrs({ type: 'checkbox' })`
  width: 44px;
  height: 24px;
  appearance: none;
  background-color: ${props => props.checked ? props.theme.colors.primary : props.theme.colors.textTertiary};
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: ${props => props.theme.transitions.fast};

  &::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: white;
    top: 2px;
    left: ${props => props.checked ? '22px' : '2px'};
    transition: ${props => props.theme.transitions.fast};
  }
`;

const Select = styled.select`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  background-color: ${props => props.theme.colors.backgroundTertiary};
  font-size: ${props => props.theme.fontSize.md};
  color: ${props => props.theme.colors.text};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const Button = styled.button`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: ${props => props.theme.fontSize.md};
  font-weight: ${props => props.theme.fontWeight.medium};
  cursor: pointer;
  transition: ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.primaryHover};
  }
`;

const SecondaryButton = styled(Button)`
  background-color: ${props => props.theme.colors.backgroundSecondary};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};

  &:hover {
    background-color: ${props => props.theme.colors.surfaceHover};
  }
`;

const AppInfo = styled.div`
  background-color: ${props => props.theme.colors.backgroundSecondary};
  padding: ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.lg};
  margin-top: ${props => props.theme.spacing.lg};
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.sm};

  &:last-child {
    margin-bottom: 0;
  }
`;

const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [appVersion, setAppVersion] = useState('');
  const [settings, setSettings] = useState({
    notifications: true,
    autoStart: false,
    minimizeToTray: true,
    globalShortcuts: true,
    voiceActivation: true,
    floatingWindow: false,
    theme: 'system',
    language: 'en',
  });

  useEffect(() => {
    // Get app version from Electron
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem('desktop_settings');
    if (savedSettings) {
      setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    }
  }, []);

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('desktop_settings', JSON.stringify(newSettings));
  };

  const handleShowFloatingWindow = () => {
    if (window.electronAPI) {
      window.electronAPI.showFloatingWindow();
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <SettingsContainer>
      <Header>
        <Title>Settings</Title>
      </Header>

      <Content>
        <Section>
          <SectionTitle>General</SectionTitle>
          
          <SettingRow>
            <SettingLabel>
              <SettingName>Enable Notifications</SettingName>
              <SettingDescription>Show desktop notifications for new messages</SettingDescription>
            </SettingLabel>
            <Toggle
              checked={settings.notifications}
              onChange={(e) => updateSetting('notifications', e.target.checked)}
            />
          </SettingRow>

          <SettingRow>
            <SettingLabel>
              <SettingName>Start with System</SettingName>
              <SettingDescription>Launch BIL Assistant when your computer starts</SettingDescription>
            </SettingLabel>
            <Toggle
              checked={settings.autoStart}
              onChange={(e) => updateSetting('autoStart', e.target.checked)}
            />
          </SettingRow>

          <SettingRow>
            <SettingLabel>
              <SettingName>Minimize to Tray</SettingName>
              <SettingDescription>Keep the app running in the system tray when closed</SettingDescription>
            </SettingLabel>
            <Toggle
              checked={settings.minimizeToTray}
              onChange={(e) => updateSetting('minimizeToTray', e.target.checked)}
            />
          </SettingRow>

          <SettingRow>
            <SettingLabel>
              <SettingName>Theme</SettingName>
              <SettingDescription>Choose your preferred appearance</SettingDescription>
            </SettingLabel>
            <Select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </SettingRow>
        </Section>

        <Section>
          <SectionTitle>Keyboard & Voice</SectionTitle>
          
          <SettingRow>
            <SettingLabel>
              <SettingName>Global Shortcuts</SettingName>
              <SettingDescription>Enable keyboard shortcuts to control BIL from anywhere</SettingDescription>
            </SettingLabel>
            <Toggle
              checked={settings.globalShortcuts}
              onChange={(e) => updateSetting('globalShortcuts', e.target.checked)}
            />
          </SettingRow>

          <SettingRow>
            <SettingLabel>
              <SettingName>Voice Activation</SettingName>
              <SettingDescription>Use voice commands to interact with BIL</SettingDescription>
            </SettingLabel>
            <Toggle
              checked={settings.voiceActivation}
              onChange={(e) => updateSetting('voiceActivation', e.target.checked)}
            />
          </SettingRow>
        </Section>

        <Section>
          <SectionTitle>Desktop Features</SectionTitle>
          
          <SettingRow>
            <SettingLabel>
              <SettingName>Floating Assistant</SettingName>
              <SettingDescription>Show a compact floating window for quick access</SettingDescription>
            </SettingLabel>
            <Button onClick={handleShowFloatingWindow}>
              Show Floating Window
            </Button>
          </SettingRow>
        </Section>

        <Section>
          <SectionTitle>Account</SectionTitle>
          
          <SettingRow>
            <SettingLabel>
              <SettingName>Signed in as</SettingName>
              <SettingDescription>{user?.email}</SettingDescription>
            </SettingLabel>
            <SecondaryButton onClick={handleLogout}>
              Sign Out
            </SecondaryButton>
          </SettingRow>
        </Section>

        <AppInfo>
          <InfoRow>
            <span>Version</span>
            <span>{appVersion || '1.0.0'}</span>
          </InfoRow>
          <InfoRow>
            <span>Platform</span>
            <span>{navigator.platform}</span>
          </InfoRow>
          <InfoRow>
            <span>User Agent</span>
            <span>{navigator.userAgent.split(' ')[0]}</span>
          </InfoRow>
        </AppInfo>
      </Content>
    </SettingsContainer>
  );
};

export default SettingsScreen;