# CLMS Backend

This is the backend API for the Computer Laboratory Management System (CLMS). It provides a comprehensive solution for managing students, books, equipment, activities, and more in a computer laboratory setting.

## Features

- **Student Management**: Track student information, activities, and sessions
- **Book Management**: Manage library books, checkouts, and returns
- **Equipment Management**: Track computer usage, gaming sessions, and other equipment
- **Activity Tracking**: Log all student activities with time tracking
- **Barcode Generation**: Generate barcodes for students and books
- **Google Sheets Integration**: Sync data with Google Sheets
- **Authentication & Authorization**: Secure API with role-based access control
- **Automation Jobs**: Scheduled tasks for data sync and cleanup
- **Import/Export**: Import data from CSV files and export reports

## Tech Stack

- **Node.js** with TypeScript
- **Express.js** for the REST API
- **Prisma** as the ORM for MySQL database
- **JWT** for authentication
- **Winston** for logging
- **Vitest** for testing
- **Docker** for containerization

## Prerequisites

- Node.js 18 or higher
- MySQL 8.0 or higher
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then update the `.env` file with your configuration.

4. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

5. Run database migrations:
   ```bash
   npm run db:migrate
   ```

6. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

## Development

### Running the Application

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

### Building for Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

### Testing

Run the test suite:
```bash
npm run test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Linting and Formatting

Check for linting errors:
```bash
npm run lint:check
```

Fix linting errors:
```bash
npm run lint:fix
```

Check code formatting:
```bash
npm run format:check
```

Fix code formatting:
```bash
npm run format:fix
```

## API Documentation

The API provides the following endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/users` - Create a new user (admin only)
- `PUT /api/auth/password` - Update password
- `GET /api/auth/users` - Get all users (admin only)

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Create a new student
- `GET /api/students/:id` - Get a student by ID
- `PUT /api/students/:id` - Update a student
- `DELETE /api/students/:id` - Delete a student

### Books
- `GET /api/books` - Get all books
- `POST /api/books` - Create a new book
- `GET /api/books/:id` - Get a book by ID
- `PUT /api/books/:id` - Update a book
- `DELETE /api/books/:id` - Delete a book

### Equipment
- `GET /api/equipment` - Get all equipment
- `POST /api/equipment` - Create new equipment
- `GET /api/equipment/:id` - Get equipment by ID
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment

### Activities
- `GET /api/activities` - Get all activities
- `POST /api/activities` - Create a new activity
- `GET /api/activities/:id` - Get an activity by ID
- `PUT /api/activities/:id` - Update an activity
- `DELETE /api/activities/:id` - Delete an activity

### Scan
- `POST /api/scan/student` - Scan a student barcode
- `POST /api/scan/book` - Scan a book barcode
- `POST /api/scan/equipment` - Scan an equipment barcode

### Reports
- `GET /api/reports/activities` - Get activity reports
- `GET /api/reports/checkouts` - Get checkout reports
- `GET /api/reports/sessions` - Get session reports

### Utilities
- `POST /api/utilities/import/students` - Import students from CSV
- `POST /api/utilities/import/books` - Import books from CSV
- `POST /api/utilities/barcode/student/:id` - Generate student barcode
- `POST /api/utilities/barcode/book/:id` - Generate book barcode

## Docker

### Building the Docker Image

```bash
docker build -t clms-backend .
```

### Running with Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

The following environment variables are required:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRATION` - JWT token expiration time
- `GOOGLE_CLIENT_EMAIL` - Google service account email
- `GOOGLE_PRIVATE_KEY` - Google service account private key
- `GOOGLE_SPREADSHEET_ID` - Google Sheets spreadsheet ID
- `NODE_ENV` - Environment (development, production)
- `PORT` - Server port (default: 3001)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.