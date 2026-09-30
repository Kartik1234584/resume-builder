# Resume Builder - Azure Cloud Deployment

A full-stack web-based Resume Builder application built with **HTML, CSS, JavaScript, Node.js, and Express.js**, with hands-on deployment to **Microsoft Azure App Service** and automated **GitHub Actions CI/CD**.

The project demonstrates a practical cloud deployment workflow from source code in GitHub to a Linux-based Azure App Service.

---

## Project Overview

Resume Builder allows users to create and manage professional resumes through a web interface.

The application includes:

- User registration and login
- Password hashing
- JWT-based authentication
- Resume creation and management
- Resume editing and deletion through authenticated API routes
- Resume data storage
- DOCX resume export
- Responsive frontend
- Express.js backend
- Azure App Service deployment
- Automated GitHub Actions CI/CD

---

## Cloud and DevOps Implementation

This project was deployed hands-on using **Microsoft Azure App Service**.

### Deployment flow

```text
Developer
   |
   v
GitHub Repository
   |
   | Push to main
   v
GitHub Actions
   |
   |- Checkout source code
   |- Setup Node.js 24
   |- Install backend dependencies
   |- Build / test backend when scripts are available
   |- Upload application artifact
   |- Authenticate with Azure using OIDC
   |- Deploy application
   |
   v
Microsoft Azure App Service
   |
   v
Node.js + Express Application
```

### Azure services and technologies used

- Microsoft Azure
- Azure App Service
- Azure App Service Plan
- Azure Portal
- Linux
- Node.js 24 LTS
- GitHub Actions
- GitHub OIDC authentication
- CI/CD
- YAML workflow configuration

---

## Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js
- REST API
- npm

### Authentication and Security

- JWT
- bcryptjs
- Helmet
- CORS
- Express Rate Limit
- Express Validator
- Environment variables

### Data and Document Processing

- JSON-based local data storage
- DOCX generation
- `docx`
- `jsdom`

### Cloud and DevOps

- Microsoft Azure App Service
- Azure Linux
- GitHub
- GitHub Actions
- YAML
- Git

---

## Project Structure

```text
resume-builder/
|
|- backend/
|  |- db.json
|  |- package.json
|  |- package-lock.json
|  `- server.js
|
|- public/
|  |- index.html
|  |- app.js
|  `- styles.css
|
|- .github/
|  `- workflows/
|     `- main_resumebuilder-cloud-2026.yml
|
|- .gitignore
`- README.md
```

---

## Local Installation

### 1. Clone the repository

```bash
git clone https://github.com/Kartik1234584/resume-builder.git
cd resume-builder
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend` directory:

```env
JWT_SECRET=your_secure_secret_key
PORT=4000
```

Do not commit the `.env` file to GitHub. The project `.gitignore` excludes `.env` and `node_modules/`.

### 4. Start the application

From the `backend` directory:

```bash
npm start
```

Open `http://localhost:4000`. The Express server serves the `public` directory, so the frontend and backend are available through the same application.

---

## Authentication

The backend implements authentication using:

- User registration
- Password hashing with `bcryptjs`
- JWT authentication
- Protected API routes
- Input validation
- Authentication rate limiting

A production deployment should use a strong secret stored securely in Azure App Service configuration rather than placing secrets in source code.

---

## CI/CD with GitHub Actions

The workflow is triggered when changes are pushed to the `main` branch. It can also be started manually with `workflow_dispatch`.

### Pipeline stages

```text
GitHub Push
     |
     v
Checkout Repository
     |
     v
Setup Node.js 24
     |
     v
Install Backend Dependencies
     |
     v
Build / Test when available
     |
     v
Upload Application Artifact
     |
     v
Authenticate with Azure using OIDC
     |
     v
Deploy to Azure App Service
     |
     v
Start Node.js Application
```

The workflow uses Azure authentication through GitHub's OpenID Connect (OIDC) mechanism. The deployed application uses the backend server as its startup process:

```text
node backend/server.js
```

---

## Testing the Application

### Local testing

```bash
cd backend
npm start
```

Then open `http://localhost:4000` and verify the editor, live preview, templates, sample presets, entry ordering, and PDF/DOCX exports.

The current backend has no dedicated `build` or `test` scripts, so the GitHub Actions workflow runs those commands only when scripts are added.

### Deployment testing

After a successful GitHub Actions deployment, open the Azure App Service from the Azure Portal using the **Browse** option and verify that the application loads.

---

## Security Practices

The project includes several basic security measures:

- Password hashing using bcrypt
- JWT authentication
- Helmet security headers
- CORS configuration
- Rate limiting
- Request validation
- Environment variables for secrets
- `.gitignore` for sensitive files

Never commit `.env`, passwords, API keys, JWT secrets, Azure credentials, or other sensitive information to GitHub.

---

## Cloud Architecture

```text
                    +---------------------+
                    |      Developer      |
                    +----------+----------+
                               |
                               | Git Push
                               v
                    +---------------------+
                    |       GitHub        |
                    |   Source Repository |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |   GitHub Actions    |
                    |       CI/CD         |
                    +----------+----------+
                               |
                               | OIDC
                               v
                    +---------------------+
                    |   Azure App Service |
                    |       Linux         |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    | Node.js + Express   |
                    |    Resume Builder   |
                    +---------------------+
```

---

## Repository

**GitHub:** [https://github.com/Kartik1234584/resume-builder](https://github.com/Kartik1234584/resume-builder)

The Azure resources used for the hands-on deployment were created for project demonstration and may not remain continuously hosted.

---

## Project Documentation

The project includes hands-on documentation of:

- Azure Web App creation
- Azure App Service Plan configuration
- Linux App Service setup
- GitHub repository integration
- GitHub Actions configuration
- CI/CD workflow execution
- Successful Azure deployment
- Azure Deployment Center
- Application deployment verification

---

## Learning Outcomes

Through this project, I gained practical experience with:

- Creating and configuring Azure App Service
- Deploying Node.js applications to Azure
- Working with Linux-based App Service
- Connecting GitHub with Azure
- Creating and modifying GitHub Actions workflows
- Implementing CI/CD
- Configuring Azure deployment authentication
- Troubleshooting GitHub Actions build failures
- Configuring Node.js startup commands
- Managing application configuration and environment variables
- Understanding the relationship between source control, CI/CD, and cloud deployment

---

## Storage Note

This project uses a JSON file for demonstration-level data storage.

For a production application, persistent cloud storage or a managed database such as **Azure Database for MySQL**, **Azure SQL**, or another appropriate database service should be used. The current JSON-based approach is intended for learning and project demonstration rather than production-scale data persistence.

---

## Future Improvements

Possible future improvements include:

- Replace JSON storage with a managed database
- Add Azure Blob Storage for document storage
- Add Azure Key Vault for secrets
- Add custom domain and HTTPS configuration
- Add automated unit and integration tests
- Add monitoring and logging
- Add Docker-based deployment
- Add infrastructure as code using Terraform
- Add staging and production environments
- Improve resume templates and PDF export
- Add cloud-based persistent storage

---

## Author

**Kartik Sadhu**

MCA - Cloud Computing

### Technologies

`Microsoft Azure` `Azure App Service` `GitHub Actions` `CI/CD` `Node.js` `Express.js` `JavaScript` `HTML` `CSS` `Git` `GitHub`

---

## Project Highlights

- Full-stack web application
- Hands-on Microsoft Azure deployment
- Linux-based Azure App Service
- GitHub Actions CI/CD
- Automated cloud deployment
- Node.js + Express backend
- Authentication and security features
- Practical cloud engineering workflow
