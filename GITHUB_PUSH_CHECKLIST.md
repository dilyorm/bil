# 🚀 GitHub Push Checklist

Complete this checklist before pushing to GitHub.

## ✅ Pre-Push Checklist

### 1. Security Check

- [ ] No API keys in code
- [ ] No passwords in code
- [ ] `.env` files in `.gitignore`
- [ ] `.env.example` created
- [ ] Sensitive data removed

### 2. Code Quality

- [ ] All tests pass
- [ ] No console.log statements
- [ ] Code is formatted
- [ ] TypeScript compiles
- [ ] No linting errors

### 3. Documentation

- [ ] README.md updated
- [ ] CONTRIBUTING.md exists
- [ ] LICENSE file exists
- [ ] API documentation updated
- [ ] Comments added to complex code

### 4. Git Setup

- [ ] Git repository initialized
- [ ] `.gitignore` configured
- [ ] `.gitattributes` created
- [ ] Remote repository added
- [ ] Branch created

### 5. Files to Remove

- [ ] Test files removed
- [ ] Debug files removed
- [ ] Temporary files removed
- [ ] Build artifacts removed
- [ ] node_modules removed

## 🔧 Quick Commands

### Run Preparation Script

**Windows:**
```bash
scripts\prepare-github.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/prepare-github.sh
./scripts/prepare-github.sh
```

### Initialize Git

```bash
# Initialize repository
git init

# Add remote
git remote add origin https://github.com/dilyorm/bil.git

# Check status
git status
```

### First Commit

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit: BIL - Biological Intelligence Layer

- Multi-platform AI assistant system
- Desktop control from mobile
- React Native mobile app
- Electron desktop app
- ESP32 wearable support
- Gemini AI integration"

# Push to GitHub
git push -u origin main
```

## 📋 Files to Verify

### Must Exist

- [ ] `README.md` - Project documentation
- [ ] `LICENSE` - MIT License
- [ ] `CONTRIBUTING.md` - Contribution guidelines
- [ ] `.gitignore` - Ignore rules
- [ ] `.gitattributes` - Git attributes
- [ ] `package.json` - Project metadata
- [ ] `packages/backend/.env.example` - Environment template

### Must NOT Exist in Git

- [ ] `.env` files
- [ ] `node_modules/`
- [ ] `dist/` or `build/` folders
- [ ] API keys
- [ ] Passwords
- [ ] Test files
- [ ] Debug files

## 🔍 Final Review

### Code Review

```bash
# Check for API keys
grep -r "AIzaSy" --include="*.ts" --include="*.js"

# Check for passwords
grep -r "password.*=" --include="*.ts" --include="*.js"

# Check for .env files
find . -name ".env" -not -path "*/node_modules/*"
```

### Git Review

```bash
# See what will be committed
git status

# See changes
git diff

# See files that will be pushed
git ls-files
```

## 🚨 Common Mistakes

### ❌ Don't Do This

- Commit `.env` files
- Commit `node_modules/`
- Commit API keys
- Commit passwords
- Commit build artifacts
- Commit test files
- Commit debug logs

### ✅ Do This

- Use `.env.example`
- Use `.gitignore`
- Remove sensitive data
- Test before pushing
- Write good commit messages
- Update documentation

## 📝 Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

### Examples

```bash
# Good
git commit -m "feat: add desktop control feature"
git commit -m "fix: resolve authentication bug"
git commit -m "docs: update README with setup instructions"

# Bad
git commit -m "update"
git commit -m "fix stuff"
git commit -m "changes"
```

## 🎯 After Pushing

### Verify on GitHub

- [ ] Repository is public/private as intended
- [ ] README displays correctly
- [ ] No sensitive data visible
- [ ] All files present
- [ ] License is correct

### Setup Repository

- [ ] Add description
- [ ] Add topics/tags
- [ ] Enable issues
- [ ] Enable discussions
- [ ] Add collaborators
- [ ] Setup branch protection

### Documentation

- [ ] Update repository URL in docs
- [ ] Add badges to README
- [ ] Create GitHub Pages (optional)
- [ ] Setup wiki (optional)

## 🔗 Useful Links

- **Repository**: https://github.com/dilyorm/bil
- **Issues**: https://github.com/dilyorm/bil/issues
- **Discussions**: https://github.com/dilyorm/bil/discussions
- **Wiki**: https://github.com/dilyorm/bil/wiki

## ✨ Success!

Once everything is checked:

```bash
# Push to GitHub
git push -u origin main

# Verify
git remote -v
git log --oneline
```

**Your project is now on GitHub!** 🎉

---

**Remember**: Never commit sensitive data. Always review before pushing.
