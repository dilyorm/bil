# Contributing to BIL

Thank you for your interest in contributing to BIL! This document provides guidelines and instructions for contributing.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker
- Git
- Basic knowledge of TypeScript/React

### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/bil.git
cd bil

# Install dependencies
npm install

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Setup environment
cp packages/backend/.env.example packages/backend/.env
# Add your API keys to .env

# Start development
npm run dev
```

## 📝 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation

### 3. Test Your Changes

```bash
# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run type-check
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add amazing feature"
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🏗️ Project Structure

```
bil/
├── packages/
│   ├── backend/      # Backend API
│   ├── desktop/      # Desktop app
│   ├── mobile/       # Mobile app
│   └── wearable/     # Wearable firmware
├── infrastructure/   # Deployment configs
├── scripts/          # Utility scripts
└── tests/            # Integration tests
```

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No hardcoded values
- [ ] No API keys in code

### PR Description

Include:
- What changes were made
- Why the changes were needed
- How to test the changes
- Screenshots (if UI changes)
- Related issues

### Example PR Description

```markdown
## Description
Added desktop control feature to allow remote command execution.

## Changes
- Added desktop agent service
- Implemented command polling
- Added mobile control screen

## Testing
1. Start backend and desktop app
2. Open mobile app
3. Navigate to Desktop Control
4. Tap "Open Steam"
5. Verify Steam opens on desktop

## Screenshots
[Add screenshots here]

## Related Issues
Closes #123
```

## 🧪 Testing Guidelines

### Unit Tests

```typescript
describe('DesktopAgent', () => {
  it('should open application', async () => {
    const result = await agent.openApplication('steam');
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Desktop Control API', () => {
  it('should send command to desktop', async () => {
    const response = await api.post('/desktop-agent/command', {
      action: 'open_app',
      target: 'steam'
    });
    expect(response.status).toBe(200);
  });
});
```

## 📚 Documentation

### Code Comments

```typescript
/**
 * Opens an application on the desktop
 * @param appName - Name of the application to open
 * @returns Promise with command result
 */
async openApplication(appName: string): Promise<CommandResult> {
  // Implementation
}
```

### README Updates

Update relevant README files when:
- Adding new features
- Changing configuration
- Updating dependencies
- Modifying setup process

## 🎨 Code Style

### TypeScript

```typescript
// Use interfaces for object types
interface User {
  id: string;
  name: string;
  email: string;
}

// Use async/await instead of promises
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  return user;
}

// Use descriptive variable names
const isUserAuthenticated = checkAuth(user);
const hasPermission = checkPermission(user, 'admin');
```

### React/React Native

```typescript
// Use functional components
export const MyComponent: React.FC<Props> = ({ title }) => {
  const [count, setCount] = useState(0);
  
  return (
    <View>
      <Text>{title}</Text>
      <Button onPress={() => setCount(count + 1)}>
        Count: {count}
      </Button>
    </View>
  );
};
```

## 🐛 Bug Reports

### Before Reporting

- Check existing issues
- Try latest version
- Reproduce the bug
- Gather error messages

### Bug Report Template

```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Windows 11
- Node.js: 18.0.0
- Package version: 1.0.0

## Screenshots
[Add screenshots]

## Additional Context
Any other relevant information
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other ways to solve this

## Additional Context
Any other relevant information
```

## 🔒 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email: security@bil.example.com
2. Include detailed description
3. Include steps to reproduce
4. We'll respond within 48 hours

### Security Best Practices

- Never commit API keys
- Never commit passwords
- Use environment variables
- Validate all inputs
- Sanitize user data
- Use HTTPS in production

## 📦 Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Git tag created
- [ ] Release notes written

## 🙏 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

## 📞 Getting Help

- **Discord**: [Join our server](https://discord.gg/bil)
- **Discussions**: [GitHub Discussions](https://github.com/dilyorm/bil/discussions)
- **Email**: dev@bil.example.com

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to BIL!** 🎉
