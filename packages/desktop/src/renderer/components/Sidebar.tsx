import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useChat } from '../contexts/ChatContext';

const SidebarContainer = styled.aside`
  width: 240px;
  background-color: ${props => props.theme.colors.backgroundSecondary};
  border-right: 1px solid ${props => props.theme.colors.border};
  display: flex;
  flex-direction: column;
  padding: ${props => props.theme.spacing.lg};
`;

const Logo = styled.div`
  font-size: ${props => props.theme.fontSize.xl};
  font-weight: ${props => props.theme.fontWeight.bold};
  color: ${props => props.theme.colors.primary};
  margin-bottom: ${props => props.theme.spacing.xl};
  text-align: center;
`;

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
`;

const NavItem = styled(Link)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  text-decoration: none;
  color: ${props => props.$isActive ? props.theme.colors.primary : props.theme.colors.text};
  background-color: ${props => props.$isActive ? props.theme.colors.surface : 'transparent'};
  font-weight: ${props => props.$isActive ? props.theme.fontWeight.medium : props.theme.fontWeight.normal};
  transition: ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.surfaceHover};
  }
`;

const NavIcon = styled.span`
  margin-right: ${props => props.theme.spacing.md};
  font-size: ${props => props.theme.fontSize.lg};
`;

const StatusIndicator = styled.div`
  margin-top: auto;
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.md};
  background-color: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
`;

const StatusDot = styled.div<{ $connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.$connected ? props.theme.colors.success : props.theme.colors.error};
  display: inline-block;
  margin-right: ${props => props.theme.spacing.sm};
`;

const StatusText = styled.span`
  font-size: ${props => props.theme.fontSize.sm};
  color: ${props => props.theme.colors.textSecondary};
`;

interface SidebarProps {
  currentRoute: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRoute }) => {
  const location = useLocation();
  const { isConnected } = useChat();

  const navItems = [
    { path: '/chat', label: 'Chat', icon: '💬' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <SidebarContainer>
      <Logo>BIL Assistant</Logo>
      
      <NavList>
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            to={item.path}
            $isActive={location.pathname === item.path}
          >
            <NavIcon>{item.icon}</NavIcon>
            {item.label}
          </NavItem>
        ))}
      </NavList>

      <StatusIndicator>
        <StatusDot $connected={isConnected} />
        <StatusText>
          {isConnected ? 'Connected' : 'Disconnected'}
        </StatusText>
      </StatusIndicator>
    </SidebarContainer>
  );
};

export default Sidebar;