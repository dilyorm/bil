import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const Container = styled.div`
  display: flex;
  height: 100vh;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.colors.background};
`;

const Card = styled.div`
  width: 360px;
  padding: ${p => p.theme.spacing.xl};
  background: ${p => p.theme.colors.surface};
  border: 1px solid ${p => p.theme.colors.borderLight};
  border-radius: ${p => p.theme.borderRadius.lg};
  box-shadow: ${p => p.theme.shadows.md};
`;

const Title = styled.h2`
  margin: 0 0 ${p => p.theme.spacing.lg} 0;
`;

const Input = styled.input`
  width: 100%;
  padding: ${p => p.theme.spacing.md};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: ${p => p.theme.borderRadius.md};
  margin-bottom: ${p => p.theme.spacing.md};
`;

const Button = styled.button`
  width: 100%;
  padding: ${p => p.theme.spacing.md};
  background: ${p => p.theme.colors.primary};
  color: #fff;
  border: 0;
  border-radius: ${p => p.theme.borderRadius.md};
  cursor: pointer;
`;

const Helper = styled.div`
  margin-top: ${p => p.theme.spacing.md};
  text-align: center;
`;

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password, name);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    }
  };

  return (
    <Container>
      <Card>
        <Title>Create account</Title>
        <form onSubmit={onSubmit}>
          <Input
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div style={{ color: '#FF3B30', marginBottom: 12 }}>{error}</div>}
          <Button type="submit" disabled={isLoading}>Create account</Button>
        </form>
        <Helper>
          Already have an account? <Link to="/login">Sign in</Link>
        </Helper>
      </Card>
    </Container>
  );
}


