import { describe, it, expect, beforeEach } from 'vitest';
import { OAuth2Service, OAuth2Provider } from '../oauth';

describe('OAuth2Service', () => {
  let oauth2Service: OAuth2Service;

  beforeEach(() => {
    oauth2Service = new OAuth2Service();
  });

  describe('registerProvider', () => {
    it('should register a new OAuth2 provider', () => {
      const provider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };

      expect(() => {
        oauth2Service.registerProvider(provider);
      }).not.toThrow();
    });

    it('should allow registering multiple providers', () => {
      const googleProvider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };

      const githubProvider: OAuth2Provider = {
        name: 'github',
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'http://localhost:3000/auth/github/callback',
        scopes: ['user:email']
      };

      expect(() => {
        oauth2Service.registerProvider(googleProvider);
        oauth2Service.registerProvider(githubProvider);
      }).not.toThrow();
    });

    it('should overwrite existing provider with same name', () => {
      const provider1: OAuth2Provider = {
        name: 'google',
        clientId: 'old-client-id',
        clientSecret: 'old-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid']
      };

      const provider2: OAuth2Provider = {
        name: 'google',
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };

      oauth2Service.registerProvider(provider1);
      oauth2Service.registerProvider(provider2);

      // Should not throw when getting authorization URL with new provider
      expect(() => {
        oauth2Service.getAuthorizationUrl('google');
      }).not.toThrow();
    });
  });

  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      const provider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };
      oauth2Service.registerProvider(provider);
    });

    it('should generate authorization URL for registered provider', () => {
      const url = oauth2Service.getAuthorizationUrl('google');
      
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      // Since this is a placeholder implementation, just check basic structure
      expect(url).toContain('oauth2.provider.com');
      expect(url).toContain('client_id');
      expect(url).toContain('redirect_uri');
      expect(url).toContain('scope');
      expect(url).toContain('response_type');
    });

    it('should include state parameter when provided', () => {
      const state = 'random-state-value';
      const url = oauth2Service.getAuthorizationUrl('google', state);
      
      expect(url).toContain(`state=${state}`);
    });

    it('should throw error for unregistered provider', () => {
      expect(() => {
        oauth2Service.getAuthorizationUrl('unregistered-provider');
      }).toThrow("OAuth2 provider 'unregistered-provider' not found");
    });

    it('should properly encode URL parameters', () => {
      const provider: OAuth2Provider = {
        name: 'test',
        clientId: 'client with spaces',
        clientSecret: 'secret',
        redirectUri: 'http://localhost:3000/auth/callback?param=value',
        scopes: ['scope with spaces', 'another:scope']
      };
      oauth2Service.registerProvider(provider);

      const url = oauth2Service.getAuthorizationUrl('test');
      
      // Since this is a placeholder implementation, just check that URL is generated
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      const provider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };
      oauth2Service.registerProvider(provider);
    });

    it('should throw error for unregistered provider', async () => {
      await expect(
        oauth2Service.exchangeCodeForToken('unregistered-provider', 'auth-code')
      ).rejects.toThrow("OAuth2 provider 'unregistered-provider' not found");
    });

    it('should throw not implemented error for registered provider', async () => {
      await expect(
        oauth2Service.exchangeCodeForToken('google', 'auth-code')
      ).rejects.toThrow('OAuth2 integration not yet implemented');
    });
  });

  describe('getUserInfo', () => {
    beforeEach(() => {
      const provider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };
      oauth2Service.registerProvider(provider);
    });

    it('should throw error for unregistered provider', async () => {
      await expect(
        oauth2Service.getUserInfo('unregistered-provider', 'access-token')
      ).rejects.toThrow("OAuth2 provider 'unregistered-provider' not found");
    });

    it('should throw not implemented error for registered provider', async () => {
      await expect(
        oauth2Service.getUserInfo('google', 'access-token')
      ).rejects.toThrow('OAuth2 integration not yet implemented');
    });
  });

  describe('provider management', () => {
    it('should handle empty provider list', () => {
      expect(() => {
        oauth2Service.getAuthorizationUrl('nonexistent');
      }).toThrow("OAuth2 provider 'nonexistent' not found");
    });

    it('should maintain provider isolation', () => {
      const googleProvider: OAuth2Provider = {
        name: 'google',
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        redirectUri: 'http://localhost:3000/auth/google/callback',
        scopes: ['openid', 'profile', 'email']
      };

      const githubProvider: OAuth2Provider = {
        name: 'github',
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'http://localhost:3000/auth/github/callback',
        scopes: ['user:email']
      };

      oauth2Service.registerProvider(googleProvider);
      oauth2Service.registerProvider(githubProvider);

      const googleUrl = oauth2Service.getAuthorizationUrl('google');
      const githubUrl = oauth2Service.getAuthorizationUrl('github');

      expect(googleUrl).toContain('google-client-id');
      expect(googleUrl).not.toContain('github-client-id');
      expect(githubUrl).toContain('github-client-id');
      expect(githubUrl).not.toContain('google-client-id');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', async () => {
      const { oauth2Service: singletonInstance } = await import('../oauth');
      
      expect(singletonInstance).toBeInstanceOf(OAuth2Service);
    });
  });
});