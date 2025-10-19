# ⏱️ Time Tracker Application

A comprehensive time tracking and portfolio management system built with Laravel 10 and React (Inertia.js).

## 📋 Features

### Time Management
- **Work Hours Tracking** - Log and manage work hours with client assignments
- **Time Entry System** - Real-time clock in/out functionality
- **Time Reports** - Generate detailed reports with export capabilities
- **Client Management** - Organize work by clients with tags and work types

### Portfolio Management
- **Employee Portfolios** - Create and manage professional portfolios
- **Multiple Themes** - Choose from 6 built-in themes (emerald, indigo, rose, amber, sparkingasia, lime)
- **Public Portfolio URLs** - Share portfolios via custom slug URLs
- **Draft Mode** - Save portfolios as drafts before publishing
- **Portfolio Items** - Showcase projects with images, descriptions, and links
- **Sections**: Profile, About, Services, Skills, Employment, Stats, Contact

### User Management
- **Role-based Access Control** - Admin and Employee roles
- **User Profiles** - Avatar uploads, designations, and personal info
- **Email Verification** - Built-in authentication with Laravel Breeze

### Upwork Integration
- **Upwork Profiles** - Manage multiple Upwork accounts
- **Client-Profile Linking** - Associate clients with Upwork profiles
- **Work Type Classification** - Tracker/Manual, Fixed, Outside of Upwork

## 🛠️ Tech Stack

### Backend
- **Laravel 10.x** - PHP Framework
- **MySQL** - Database
- **Laravel Sanctum** - API Authentication
- **Inertia.js** - Server-side rendering adapter

### Frontend
- **React 18** - UI Library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Build tool
- **Chart.js** - Data visualization
- **React Hook Form** - Form handling
- **Zod** - Schema validation

## 📦 Installation

### Prerequisites
- PHP 8.1 or higher
- Composer
- Node.js 16+ and npm
- MySQL 5.7+

### Setup Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd timetracker
```

2. **Install PHP dependencies**
```bash
composer install
```

3. **Install Node dependencies**
```bash
npm install
```

4. **Environment setup**
```bash
cp .env.example .env
php artisan key:generate
```

5. **Configure database**
Update `.env` with your database credentials:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=timetracker
DB_USERNAME=root
DB_PASSWORD=
```

6. **Configure admin user** (Optional)
Add to `.env`:
```env
ADMIN_NAME="Admin User"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="secure_password_here"
```

7. **Run migrations**
```bash
php artisan migrate
```

8. **Create admin user**
```bash
php artisan db:seed --class=AdminUserSeeder
# OR interactively:
php artisan user:create-admin
```

9. **Create storage symlink**
```bash
php artisan storage:link
```

10. **Build frontend assets**
```bash
# Development
npm run dev

# Production
npm run build
```

11. **Start the server**
```bash
php artisan serve
```

Visit `http://localhost:8000` in your browser.

## 🗂️ Project Structure

```
timetracker/
├── app/
│   ├── Console/Commands/       # Artisan commands
│   ├── Http/
│   │   ├── Controllers/        # Application controllers
│   │   ├── Middleware/         # Custom middleware
│   │   └── Requests/           # Form request validation
│   ├── Models/                 # Eloquent models
│   └── Policies/               # Authorization policies
├── database/
│   ├── migrations/             # Database migrations
│   └── seeders/                # Database seeders
├── resources/
│   ├── js/
│   │   ├── Components/         # React components
│   │   ├── Layouts/            # Layout components
│   │   └── Pages/              # Inertia pages
│   └── css/                    # Stylesheets
├── routes/
│   ├── web.php                 # Web routes
│   └── api.php                 # API routes
└── public/                     # Public assets
```

## 🎯 Usage

### Creating Portfolios

1. Navigate to **Portfolio** section
2. Click **Create New Portfolio**
3. Fill in your details:
   - Profile information (name, title, tagline)
   - About section
   - Services offered
   - Skills (grouped by categories)
   - Employment history
   - Portfolio items (projects)
   - Contact information
4. Choose a theme
5. Save as draft or publish immediately
6. Share your public portfolio URL: `/portfolio/{your-slug}`

### Time Tracking

1. **Quick Entry**: Use the dashboard timer to clock in/out
2. **Manual Entry**: Add work hours with client, date, and description
3. **Reports**: Generate filtered reports by date range, user, or client
4. **Export**: Download reports as Excel files

### Managing Clients

1. Navigate to **Clients**
2. Add client details (name, tags, work type)
3. Associate with Upwork profiles if applicable
4. Import/Export clients in bulk via Excel

## 🔐 User Roles

### Admin
- Full access to all features
- User management (create, edit, delete users)
- View all work hours and time entries
- Client and Upwork profile management
- System-wide reports

### Employee
- Personal time tracking
- Portfolio management
- View personal work hours
- Export personal time reports

## 🚀 Artisan Commands

```bash
# Create admin user interactively
php artisan user:create-admin

# Create admin with options
php artisan user:create-admin --name="Admin" --email="admin@example.com" --password="secret"

# Migrate portfolio contact data
php artisan portfolio:migrate-contact

# Migrate portfolio skills format
php artisan portfolio:migrate-skills
```

## 🧪 Testing

```bash
# Run PHPUnit tests
php artisan test

# Run specific test
php artisan test --filter=ExampleTest
```

## 📝 Environment Variables

Key environment variables:

```env
APP_NAME="Time Tracker"
APP_URL=http://localhost

ADMIN_NAME="Admin User"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="secure_password"

DB_DATABASE=timetracker
DB_USERNAME=root
DB_PASSWORD=

VITE_APP_NAME="${APP_NAME}"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🐛 Known Issues

- None currently reported

## 📞 Support

For support, please contact the development team or open an issue on GitHub.

---

**Built with ❤️ using Laravel and React**

