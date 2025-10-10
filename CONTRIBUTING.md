# Contributing to CLMS

Thank you for your interest in contributing to the Comprehensive Library Management System (CLMS)! This document provides guidelines and information for contributors.

## Code of Conduct

### Our Pledge
We are committed to making participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards
- Use welcoming and inclusive language
- Respect different viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop (for local development)
- Git

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/CLMS.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Set up your development environment:

```bash
# Install dependencies
cd Backend && npm install
cd ../Frontend && npm install

# Start infrastructure
docker-compose up -d mysql redis

# Setup database
cd Backend
npm run db:generate
npm run db:push
npm run db:seed

# Start development servers
npm run dev  # Backend (in Backend/)
npm run dev  # Frontend (in Frontend/)
```

## Development Guidelines

### Code Standards
- **TypeScript**: All new code must be written in TypeScript
- **ESLint**: Follow the existing ESLint configuration
- **Prettier**: Use Prettier for consistent code formatting
- **File Naming**: Use kebab-case for files, PascalCase for components
- **Comments**: Add comments for complex logic and business rules

### Backend Development
- Use Express.js with proper middleware
- Follow RESTful API conventions
- Implement proper error handling with structured logging
- Use Prisma for database operations
- Write unit and integration tests for new features

### Frontend Development
- Use React 18 with functional components and hooks
- Follow shadcn/ui component patterns
- Implement responsive design with Tailwind CSS
- Use TanStack Query for server state management
- Write tests using Vitest and Testing Library

### Database Changes
- Create proper Prisma migrations
- Update TypeScript types accordingly
- Test migrations in development
- Document schema changes

## Testing Requirements

### Backend Tests
- Unit tests for all services and utilities
- Integration tests for API endpoints
- Database tests with proper setup/teardown
- Minimum 80% code coverage for new features

### Frontend Tests
- Component tests for all new components
- Hook tests for custom hooks
- Integration tests for user flows
- Accessibility tests for UI components

### Running Tests
```bash
# Backend
cd Backend && npm test

# Frontend
cd Frontend && npm test

# Coverage reports
npm run test:coverage
```

## Pull Request Process

### Before Submitting
1. **Test your changes**: Ensure all tests pass
2. **Update documentation**: Update relevant docs if needed
3. **Lint your code**: Run `npm run lint:fix` in both Backend and Frontend
4. **Build verification**: Ensure build process works

### Pull Request Requirements
- Clear, descriptive title
- Detailed description of changes
- Link to relevant issues
- Screenshots for UI changes
- Test instructions if applicable
- Updated documentation

### Review Process
1. Automated checks (CI/CD) must pass
2. Code review by maintainers
3. Address all feedback
4. Final approval and merge

## Branch Strategy

### Main Branches
- `main/master`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Critical fixes for production

### Merge Guidelines
- `feature/*` → `develop` via pull request
- `develop` → `main/master` via pull request
- `hotfix/*` → `main/master` directly

## Issue Reporting

### Bug Reports
- Use provided bug report template
- Include steps to reproduce
- Provide environment details
- Add screenshots if applicable

### Feature Requests
- Use provided feature request template
- Describe use case clearly
- Consider impact on existing users
- Provide implementation suggestions if possible

## Documentation

### Types of Documentation
- **Code Comments**: For complex logic and business rules
- **API Documentation**: For all public endpoints
- **User Documentation**: For end-user features
- **Developer Documentation**: For contributors

### Documentation Standards
- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date
- Use consistent formatting

## Performance Guidelines

### Backend
- Optimize database queries
- Implement proper caching strategies
- Use efficient data structures
- Monitor memory usage

### Frontend
- Optimize bundle size
- Implement lazy loading
- Use React.memo for expensive components
- Monitor render performance

## Security Guidelines

### General Principles
- Validate all inputs
- Sanitize outputs
- Use HTTPS in production
- Keep dependencies updated
- Follow OWASP guidelines

### Specific Requirements
- Never commit secrets or API keys
- Use environment variables for configuration
- Implement proper authentication and authorization
- Regular security audits

## Release Process

### Versioning
- Follow semantic versioning (SemVer)
- Update changelog for each release
- Tag releases in Git
- Create release notes

### Deployment
- Test in staging environment first
- Use blue-green deployment for production
- Monitor after deployment
- Have rollback plan ready

## Getting Help

### Resources
- [Documentation](./CLAUDE.md)
- [Issue Tracker](https://github.com/JaePyJs/CLMS/issues)
- [Discussions](https://github.com/JaePyJs/CLMS/discussions)

### Contact
- Create an issue for bugs or questions
- Start a discussion for general topics
- Contact maintainers via GitHub

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to CLMS! Your contributions help make educational library management better for everyone.