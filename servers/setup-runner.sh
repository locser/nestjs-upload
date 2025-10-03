#!/bin/bash

# GitHub Self-Hosted Runner Setup Script for WSL
# This script automates the installation and configuration of GitHub Actions runner

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running in WSL
check_wsl() {
    if ! grep -q WSL /proc/version; then
        log_error "This script must be run in WSL environment"
        exit 1
    fi
    log_success "Running in WSL environment"
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git unzip jq build-essential
    log_success "System packages updated"
}

# Install Node.js
install_nodejs() {
    log_info "Installing Node.js 20..."
    
    # Remove existing Node.js if any
    sudo apt remove -y nodejs npm || true
    
    # Install Node.js from NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    log_success "Node.js installed: $NODE_VERSION"
    log_success "NPM installed: $NPM_VERSION"
}

# Install PM2
install_pm2() {
    log_info "Installing PM2..."
    
    sudo npm install -g pm2@latest
    
    # Setup PM2 startup
    pm2 startup | grep sudo | bash || true
    
    log_success "PM2 installed and configured"
}

# Create project directories
setup_directories() {
    log_info "Setting up project directories..."
    
    mkdir -p ~/projects/nestjs-demo
    mkdir -p ~/logs
    mkdir -p ~/backups
    mkdir -p ~/scripts
    mkdir -p ~/actions-runner
    
    # Set proper permissions
    chmod 755 ~/projects
    chmod 755 ~/projects/nestjs-demo
    chmod 755 ~/logs
    chmod 755 ~/backups
    chmod 755 ~/scripts
    
    log_success "Project directories created"
}

# Download and setup GitHub Runner
setup_github_runner() {
    log_info "Setting up GitHub Actions Runner..."
    
    cd ~/actions-runner
    
    # Get latest runner version
    RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name' | sed 's/v//')
    
    log_info "Downloading GitHub Runner version $RUNNER_VERSION..."
    
    # Download runner
    curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
        https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
    
    # Extract
    tar xzf ./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
    
    log_success "GitHub Runner downloaded and extracted"
}

# Configure runner (interactive)
configure_runner() {
    log_info "Configuring GitHub Runner..."
    log_warning "You will need:"
    log_warning "1. Repository URL (e.g., https://github.com/username/repo)"
    log_warning "2. Registration token from GitHub"
    log_warning "   Go to: Repository Settings > Actions > Runners > New self-hosted runner"
    
    echo ""
    read -p "Enter your repository URL: " REPO_URL
    read -p "Enter your registration token: " REG_TOKEN
    read -p "Enter runner name (default: wsl-nestjs-runner): " RUNNER_NAME
    read -p "Enter runner labels (default: wsl,nestjs,self-hosted): " RUNNER_LABELS
    
    # Set defaults
    RUNNER_NAME=${RUNNER_NAME:-wsl-nestjs-runner}
    RUNNER_LABELS=${RUNNER_LABELS:-wsl,nestjs,self-hosted}
    
    cd ~/actions-runner
    
    # Configure runner
    ./config.sh \
        --url "$REPO_URL" \
        --token "$REG_TOKEN" \
        --name "$RUNNER_NAME" \
        --labels "$RUNNER_LABELS" \
        --work "_work" \
        --replace
    
    log_success "GitHub Runner configured"
}

# Install runner as service
install_runner_service() {
    log_info "Installing runner as system service..."
    
    cd ~/actions-runner
    
    # Install service
    sudo ./svc.sh install
    
    # Start service
    sudo ./svc.sh start
    
    # Check status
    if sudo ./svc.sh status | grep -q "active"; then
        log_success "Runner service installed and started"
    else
        log_error "Failed to start runner service"
        exit 1
    fi
}

# Create deployment scripts
create_deployment_scripts() {
    log_info "Creating deployment scripts..."
    
    # Pre-deployment script
    cat > ~/scripts/pre-deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting pre-deployment tasks..."

# Stop existing application
pm2 stop nestjs-demo || true

# Create backup
if [ -d ~/projects/nestjs-demo ] && [ "$(ls -A ~/projects/nestjs-demo)" ]; then
    BACKUP_DIR=~/backups/$(date +%Y%m%d_%H%M%S)
    mkdir -p $BACKUP_DIR
    cp -r ~/projects/nestjs-demo $BACKUP_DIR/ || true
    echo "✅ Backup created at $BACKUP_DIR"
fi

echo "✅ Pre-deployment completed"
EOF

    # Post-deployment script
    cat > ~/scripts/post-deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting post-deployment tasks..."

cd ~/projects/nestjs-demo

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --omit=dev

# Build application
echo "🏗️ Building application..."
npm run build

# Start application
echo "🔄 Starting application..."
pm2 start ecosystem.config.js --env production || pm2 reload ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

echo "✅ Post-deployment completed"
EOF

    # Monitoring script
    cat > ~/scripts/monitor.sh << 'EOF'
#!/bin/bash

echo "📊 System Monitoring Report"
echo "=========================="

# System resources
echo "💻 System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"

# Application status
echo ""
echo "🚀 Application Status:"
pm2 show nestjs-demo || echo "Application not running"

# Recent logs
echo ""
echo "📝 Recent Application Logs:"
pm2 logs nestjs-demo --lines 10 --nostream || echo "No logs available"

# Health check
echo ""
echo "🏥 Health Check:"
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✅ Application is healthy"
else
    echo "❌ Application is not responding"
fi
EOF

    # Make scripts executable
    chmod +x ~/scripts/*.sh
    
    log_success "Deployment scripts created"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create environment template
    cat > ~/projects/nestjs-demo/.env.template << 'EOF'
NODE_ENV=production
PORT=3000
# Add your production environment variables here
# DATABASE_URL=
# JWT_SECRET=
# API_KEY=
EOF

    # Create PM2 ecosystem config
    cat > ~/projects/nestjs-demo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nestjs-demo',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '300M',
    error_file: '~/logs/nestjs-demo-error.log',
    out_file: '~/logs/nestjs-demo-out.log',
    log_file: '~/logs/nestjs-demo.log',
    time: true,
    autorestart: true,
    watch: false,
    ignore_watch: ["node_modules", "logs"],
    env_file: '.env.production'
  }]
}
EOF

    log_success "Environment configuration created"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/nestjs-demo << EOF
/home/*/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reload nestjs-demo || true
    endscript
}
EOF

    log_success "Log rotation configured"
}

# Create useful aliases
setup_aliases() {
    log_info "Setting up useful aliases..."
    
    # Add aliases to bashrc if not already present
    if ! grep -q "# GitHub Runner Aliases" ~/.bashrc; then
        cat >> ~/.bashrc << 'EOF'

# GitHub Runner Aliases
alias runner-status='sudo ~/actions-runner/svc.sh status'
alias runner-start='sudo ~/actions-runner/svc.sh start'
alias runner-stop='sudo ~/actions-runner/svc.sh stop'
alias runner-restart='sudo ~/actions-runner/svc.sh stop && sudo ~/actions-runner/svc.sh start'
alias runner-logs='tail -f ~/actions-runner/_diag/Runner_*.log'

alias app-status='pm2 status'
alias app-logs='pm2 logs nestjs-demo'
alias app-monitor='pm2 monit'
alias app-restart='pm2 restart nestjs-demo'
alias app-stop='pm2 stop nestjs-demo'
alias app-start='pm2 start nestjs-demo'

alias deploy-monitor='~/scripts/monitor.sh'
alias deploy-logs='pm2 logs nestjs-demo --lines 50'

# Quick health check
alias health-check='curl -s http://localhost:3000/health || echo "Application not responding"'
EOF
    fi
    
    log_success "Aliases added to ~/.bashrc"
}

# Main execution
main() {
    echo "🚀 GitHub Self-Hosted Runner Setup for WSL"
    echo "==========================================="
    
    # Run setup steps
    check_wsl
    update_system
    install_nodejs
    install_pm2
    setup_directories
    setup_github_runner
    
    # Interactive configuration
    echo ""
    log_info "Ready to configure GitHub Runner"
    read -p "Do you want to configure the runner now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_runner
        install_runner_service
    else
        log_warning "Skipping runner configuration"
        log_info "Run the following commands manually to configure:"
        log_info "cd ~/actions-runner"
        log_info "./config.sh --url YOUR_REPO_URL --token YOUR_TOKEN"
        log_info "sudo ./svc.sh install && sudo ./svc.sh start"
    fi
    
    # Continue with other setup
    create_deployment_scripts
    setup_environment
    setup_log_rotation
    setup_aliases
    
    echo ""
    log_success "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure your repository secrets if needed"
    echo "2. Push code to trigger the workflow"
    echo "3. Monitor with: deploy-monitor"
    echo "4. Check logs with: deploy-logs"
    echo ""
    echo "🔧 Useful commands:"
    echo "- runner-status: Check runner status"
    echo "- app-status: Check application status"
    echo "- health-check: Quick health check"
    echo ""
    echo "📁 Important paths:"
    echo "- Runner: ~/actions-runner"
    echo "- Project: ~/projects/nestjs-demo"
    echo "- Scripts: ~/scripts"
    echo "- Logs: ~/logs"
    echo ""
    log_info "Reload your shell or run: source ~/.bashrc"
}

# Run main function
main "$@"