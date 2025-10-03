#!/bin/bash

# Troubleshooting Guide Script for GitHub Self-Hosted Runner
# Automated diagnostics and fixes for common issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
PROJECT_DIR="$HOME/projects/nestjs-demo"
SCRIPTS_DIR="$HOME/scripts"
RUNNER_DIR="$HOME/actions-runner"
LOGS_DIR="$HOME/logs"
BACKUP_DIR="$HOME/backups"

# Functions
print_header() {
    echo -e "${RED}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 Troubleshooting Guide                        ║"
    echo "║           GitHub Self-Hosted Runner WSL                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

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

log_fix() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

# Diagnostic functions
check_wsl_environment() {
    echo -e "${CYAN}🐧 Checking WSL Environment${NC}"
    echo "============================"
    
    # Check if in WSL
    if ! grep -q WSL /proc/version; then
        log_error "Not running in WSL environment"
        echo "Solution: Run this script inside WSL"
        return 1
    fi
    log_success "Running in WSL"
    
    # Check WSL version
    WSL_VERSION=$(grep -oP 'WSL\K\d+' /proc/version 2>/dev/null || echo "1")
    log_info "WSL Version: $WSL_VERSION"
    
    # Check distribution
    if [ -f /etc/os-release ]; then
        DISTRO=$(grep '^NAME=' /etc/os-release | cut -d'"' -f2)
        log_info "Distribution: $DISTRO"
    fi
    
    # Check kernel version
    KERNEL=$(uname -r)
    log_info "Kernel: $KERNEL"
    
    return 0
}

check_system_dependencies() {
    echo -e "${CYAN}📦 Checking System Dependencies${NC}"
    echo "================================="
    
    local issues=0
    
    # Check essential commands
    commands=("curl" "wget" "git" "unzip" "jq" "tar" "rsync")
    for cmd in "${commands[@]}"; do
        if command -v $cmd >/dev/null 2>&1; then
            log_success "$cmd is installed"
        else
            log_error "$cmd is missing"
            log_fix "Install with: sudo apt install $cmd"
            ((issues++))
        fi
    done
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log_success "Node.js installed: $NODE_VERSION"
        
        # Check if version is 18+
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            log_success "Node.js version is compatible"
        else
            log_warning "Node.js version is old (need 18+)"
            log_fix "Update Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs"
        fi
    else
        log_error "Node.js is not installed"
        log_fix "Install Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs"
        ((issues++))
    fi
    
    # Check NPM
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        log_success "NPM installed: $NPM_VERSION"
    else
        log_error "NPM is not installed"
        ((issues++))
    fi
    
    # Check PM2
    if command -v pm2 >/dev/null 2>&1; then
        PM2_VERSION=$(pm2 --version)
        log_success "PM2 installed: $PM2_VERSION"
    else
        log_error "PM2 is not installed"
        log_fix "Install PM2: sudo npm install -g pm2"
        ((issues++))
    fi
    
    return $issues
}

check_github_runner() {
    echo -e "${CYAN}🤖 Checking GitHub Runner${NC}"
    echo "=========================="
    
    local issues=0
    
    # Check runner directory
    if [ -d "$RUNNER_DIR" ]; then
        log_success "Runner directory exists: $RUNNER_DIR"
    else
        log_error "Runner directory missing"
        log_fix "Run setup script: bash servers/setup-runner.sh"
        ((issues++))
        return $issues
    fi
    
    # Check runner binaries
    if [ -f "$RUNNER_DIR/run.sh" ]; then
        log_success "Runner binaries found"
    else
        log_error "Runner binaries missing"
        log_fix "Re-download runner or run setup script"
        ((issues++))
    fi
    
    # Check runner configuration
    if [ -f "$RUNNER_DIR/.runner" ]; then
        log_success "Runner is configured"
        
        # Show runner info
        RUNNER_NAME=$(jq -r '.agentName' "$RUNNER_DIR/.runner" 2>/dev/null || echo "Unknown")
        RUNNER_URL=$(jq -r '.gitHubUrl' "$RUNNER_DIR/.runner" 2>/dev/null || echo "Unknown")
        log_info "Runner Name: $RUNNER_NAME"
        log_info "Repository: $RUNNER_URL"
    else
        log_error "Runner is not configured"
        log_fix "Configure runner: cd $RUNNER_DIR && ./config.sh"
        ((issues++))
    fi
    
    # Check runner service
    if sudo "$RUNNER_DIR/svc.sh" status | grep -q "active"; then
        log_success "Runner service is running"
    else
        log_error "Runner service is not running"
        log_fix "Start service: sudo $RUNNER_DIR/svc.sh start"
        ((issues++))
    fi
    
    return $issues
}

check_application_setup() {
    echo -e "${CYAN}🚀 Checking Application Setup${NC}"
    echo "============================="
    
    local issues=0
    
    # Check project directory
    if [ -d "$PROJECT_DIR" ]; then
        log_success "Project directory exists: $PROJECT_DIR"
    else
        log_error "Project directory missing"
        log_fix "Create directory: mkdir -p $PROJECT_DIR"
        ((issues++))
        return $issues
    fi
    
    cd "$PROJECT_DIR"
    
    # Check package.json
    if [ -f "package.json" ]; then
        log_success "package.json found"
    else
        log_error "package.json missing"
        log_fix "Ensure code is deployed to $PROJECT_DIR"
        ((issues++))
    fi
    
    # Check node_modules
    if [ -d "node_modules" ]; then
        log_success "node_modules exists"
    else
        log_warning "node_modules missing"
        log_fix "Install dependencies: npm ci"
    fi
    
    # Check dist directory
    if [ -d "dist" ]; then
        log_success "dist directory exists"
        
        if [ -f "dist/main.js" ]; then
            log_success "main.js built"
        else
            log_error "main.js missing in dist"
            log_fix "Build application: npm run build"
            ((issues++))
        fi
    else
        log_warning "dist directory missing"
        log_fix "Build application: npm run build"
    fi
    
    # Check ecosystem config
    if [ -f "ecosystem.config.js" ]; then
        log_success "PM2 ecosystem config found"
    else
        log_warning "PM2 ecosystem config missing"
        log_fix "Create ecosystem.config.js (see setup guide)"
    fi
    
    # Check environment file
    if [ -f ".env.production" ]; then
        log_success "Production environment file found"
    else
        log_warning ".env.production missing"
        log_fix "Create environment file with required variables"
    fi
    
    return $issues
}

check_pm2_status() {
    echo -e "${CYAN}🔄 Checking PM2 Status${NC}"
    echo "======================"
    
    local issues=0
    
    # Check if PM2 daemon is running
    if pm2 ping >/dev/null 2>&1; then
        log_success "PM2 daemon is running"
    else
        log_error "PM2 daemon is not running"
        log_fix "Start PM2: pm2 resurrect"
        ((issues++))
    fi
    
    # Check application in PM2
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        STATUS=$(pm2 show nestjs-demo | grep "status" | awk '{print $4}')
        
        if [ "$STATUS" = "online" ]; then
            log_success "Application is running in PM2"
        else
            log_error "Application status: $STATUS"
            log_fix "Restart application: pm2 restart nestjs-demo"
            ((issues++))
        fi
        
        # Check memory usage
        MEMORY=$(pm2 show nestjs-demo | grep "memory usage" | awk '{print $4}')
        if [ -n "$MEMORY" ]; then
            log_info "Memory usage: $MEMORY"
        fi
        
        # Check restart count
        RESTARTS=$(pm2 show nestjs-demo | grep "restarts" | awk '{print $4}')
        if [ -n "$RESTARTS" ] && [ "$RESTARTS" -gt 5 ]; then
            log_warning "High restart count: $RESTARTS"
            log_fix "Check logs: pm2 logs nestjs-demo"
        fi
    else
        log_error "Application not found in PM2"
        log_fix "Start application: pm2 start ecosystem.config.js --env production"
        ((issues++))
    fi
    
    return $issues
}

check_network_connectivity() {
    echo -e "${CYAN}🌐 Checking Network Connectivity${NC}"
    echo "================================="
    
    local issues=0
    
    # Check if port 3000 is listening
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        log_success "Port 3000 is listening"
        
        # Check what's using the port
        PORT_PROCESS=$(netstat -tlnp 2>/dev/null | grep ":3000" | awk '{print $7}')
        log_info "Process using port 3000: $PORT_PROCESS"
    else
        log_error "Port 3000 is not listening"
        log_fix "Start application or check if it's running on different port"
        ((issues++))
    fi
    
    # Test local connectivity
    if curl -s -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "Application responds on localhost"
    else
        log_error "Application not responding on localhost"
        ((issues++))
    fi
    
    # Test health endpoint
    if curl -s -f http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Health endpoint is working"
    else
        log_warning "Health endpoint not available"
        log_info "This is not critical if your app doesn't have /health endpoint"
    fi
    
    # Check GitHub connectivity
    if curl -s -f https://api.github.com >/dev/null 2>&1; then
        log_success "GitHub API is reachable"
    else
        log_error "Cannot reach GitHub API"
        log_fix "Check internet connection and firewall"
        ((issues++))
    fi
    
    return $issues
}

check_file_permissions() {
    echo -e "${CYAN}🔐 Checking File Permissions${NC}"
    echo "============================="
    
    local issues=0
    
    # Check project directory permissions
    if [ -d "$PROJECT_DIR" ]; then
        PERMS=$(stat -c "%a" "$PROJECT_DIR")
        if [ "$PERMS" -ge 755 ]; then
            log_success "Project directory permissions: $PERMS"
        else
            log_error "Project directory permissions too restrictive: $PERMS"
            log_fix "Fix permissions: chmod 755 $PROJECT_DIR"
            ((issues++))
        fi
    fi
    
    # Check script permissions
    if [ -d "$SCRIPTS_DIR" ]; then
        for script in "$SCRIPTS_DIR"/*.sh; do
            if [ -f "$script" ]; then
                if [ -x "$script" ]; then
                    log_success "$(basename $script) is executable"
                else
                    log_error "$(basename $script) is not executable"
                    log_fix "Fix permissions: chmod +x $script"
                    ((issues++))
                fi
            fi
        done
    fi
    
    # Check log directory
    if [ -d "$LOGS_DIR" ]; then
        if [ -w "$LOGS_DIR" ]; then
            log_success "Log directory is writable"
        else
            log_error "Log directory is not writable"
            log_fix "Fix permissions: chmod 755 $LOGS_DIR"
            ((issues++))
        fi
    fi
    
    return $issues
}

check_disk_space() {
    echo -e "${CYAN}💿 Checking Disk Space${NC}"
    echo "======================"
    
    local issues=0
    
    # Check overall disk usage
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$DISK_USAGE" -lt 80 ]; then
        log_success "Disk usage: $DISK_USAGE%"
    elif [ "$DISK_USAGE" -lt 90 ]; then
        log_warning "Disk usage high: $DISK_USAGE%"
        log_fix "Consider cleaning up: ./deployment-manager.sh cleanup"
    else
        log_error "Disk usage critical: $DISK_USAGE%"
        log_fix "Free up space immediately"
        ((issues++))
    fi
    
    # Check specific directories
    for dir in "$PROJECT_DIR" "$LOGS_DIR" "$BACKUP_DIR"; do
        if [ -d "$dir" ]; then
            SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
            log_info "$dir size: $SIZE"
        fi
    done
    
    # Check for large log files
    if [ -d "$LOGS_DIR" ]; then
        LARGE_LOGS=$(find "$LOGS_DIR" -name "*.log" -size +100M 2>/dev/null || true)
        if [ -n "$LARGE_LOGS" ]; then
            log_warning "Large log files found:"
            echo "$LARGE_LOGS"
            log_fix "Rotate logs: pm2 flush"
        fi
    fi
    
    return $issues
}

# Auto-fix functions
auto_fix_dependencies() {
    log_fix "Attempting to fix missing dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install missing packages
    sudo apt install -y curl wget git unzip jq build-essential rsync
    
    # Install Node.js if missing
    if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # Install PM2 if missing
    if ! command -v pm2 >/dev/null 2>&1; then
        sudo npm install -g pm2@latest
        pm2 startup | grep sudo | bash || true
    fi
    
    log_success "Dependencies installation attempted"
}

auto_fix_permissions() {
    log_fix "Fixing file permissions..."
    
    # Fix project permissions
    if [ -d "$PROJECT_DIR" ]; then
        chmod -R 755 "$PROJECT_DIR"
        chown -R $USER:$USER "$PROJECT_DIR"
    fi
    
    # Fix script permissions
    if [ -d "$SCRIPTS_DIR" ]; then
        chmod +x "$SCRIPTS_DIR"/*.sh 2>/dev/null || true
    fi
    
    # Fix log permissions
    if [ -d "$LOGS_DIR" ]; then
        chmod -R 644 "$LOGS_DIR"/*.log 2>/dev/null || true
        chmod 755 "$LOGS_DIR"
    fi
    
    log_success "Permissions fixed"
}

auto_fix_application() {
    log_fix "Attempting to fix application issues..."
    
    if [ -d "$PROJECT_DIR" ]; then
        cd "$PROJECT_DIR"
        
        # Install dependencies if missing
        if [ ! -d "node_modules" ]; then
            log_info "Installing dependencies..."
            npm ci --omit=dev
        fi
        
        # Build if missing
        if [ ! -d "dist" ] || [ ! -f "dist/main.js" ]; then
            log_info "Building application..."
            npm run build
        fi
        
        # Create ecosystem config if missing
        if [ ! -f "ecosystem.config.js" ]; then
            log_info "Creating PM2 ecosystem config..."
            cat > ecosystem.config.js << 'EOF'
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
    watch: false
  }]
}
EOF
        fi
        
        # Create environment file if missing
        if [ ! -f ".env.production" ]; then
            log_info "Creating production environment file..."
            cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
EOF
        fi
    fi
    
    log_success "Application fixes attempted"
}

# Main diagnostic function
run_full_diagnosis() {
    print_header
    echo -e "${YELLOW}🔍 Running Full System Diagnosis${NC}"
    echo "=================================="
    echo ""
    
    local total_issues=0
    
    # Run all checks
    check_wsl_environment
    ((total_issues += $?))
    echo ""
    
    check_system_dependencies
    ((total_issues += $?))
    echo ""
    
    check_github_runner
    ((total_issues += $?))
    echo ""
    
    check_application_setup
    ((total_issues += $?))
    echo ""
    
    check_pm2_status
    ((total_issues += $?))
    echo ""
    
    check_network_connectivity
    ((total_issues += $?))
    echo ""
    
    check_file_permissions
    ((total_issues += $?))
    echo ""
    
    check_disk_space
    ((total_issues += $?))
    echo ""
    
    # Summary
    echo -e "${CYAN}📊 Diagnosis Summary${NC}"
    echo "==================="
    
    if [ $total_issues -eq 0 ]; then
        log_success "No issues found! System is healthy."
    else
        log_warning "Found $total_issues issue(s) that need attention."
        echo ""
        read -p "Do you want to attempt automatic fixes? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            auto_fix_dependencies
            auto_fix_permissions
            auto_fix_application
            echo ""
            log_info "Auto-fixes completed. Consider running diagnosis again."
        fi
    fi
}

# Quick fix functions
quick_restart() {
    echo -e "${YELLOW}🔄 Quick Restart Sequence${NC}"
    echo "========================="
    
    log_info "Stopping application..."
    pm2 stop nestjs-demo || true
    
    log_info "Starting application..."
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js --env production || pm2 start nestjs-demo
    pm2 save
    
    log_info "Waiting for startup..."
    sleep 5
    
    if curl -s -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "Application restarted successfully"
    else
        log_error "Application failed to start"
        log_info "Check logs: pm2 logs nestjs-demo"
    fi
}

emergency_reset() {
    echo -e "${RED}🚨 Emergency Reset${NC}"
    echo "=================="
    
    read -p "This will reset PM2 and restart everything. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Emergency reset cancelled"
        return 0
    fi
    
    log_warning "Performing emergency reset..."
    
    # Stop all PM2 processes
    pm2 stop all || true
    pm2 delete all || true
    
    # Kill any remaining Node processes
    pkill -f node || true
    
    # Clear PM2 state
    pm2 save --force
    
    # Restart runner service
    sudo "$RUNNER_DIR/svc.sh" stop || true
    sudo "$RUNNER_DIR/svc.sh" start || true
    
    # Fix permissions
    auto_fix_permissions
    
    # Rebuild and start application
    if [ -d "$PROJECT_DIR" ]; then
        cd "$PROJECT_DIR"
        npm ci --omit=dev
        npm run build
        pm2 start ecosystem.config.js --env production
        pm2 save
    fi
    
    log_success "Emergency reset completed"
}

# Menu system
show_menu() {
    echo -e "${CYAN}Troubleshooting Options:${NC}"
    echo ""
    echo "🔍 Diagnostics:"
    echo "  1. Full system diagnosis"
    echo "  2. Check WSL environment"
    echo "  3. Check system dependencies"
    echo "  4. Check GitHub runner"
    echo "  5. Check application setup"
    echo "  6. Check PM2 status"
    echo "  7. Check network connectivity"
    echo "  8. Check file permissions"
    echo "  9. Check disk space"
    echo ""
    echo "🔧 Quick Fixes:"
    echo "  r. Quick restart"
    echo "  f. Auto-fix common issues"
    echo "  p. Fix permissions"
    echo "  e. Emergency reset"
    echo ""
    echo "  q. Quit"
}

# Main function
main() {
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            print_header
            show_menu
            echo ""
            read -p "Choose option: " choice
            echo ""
            
            case $choice in
                1) run_full_diagnosis ;;
                2) check_wsl_environment ;;
                3) check_system_dependencies ;;
                4) check_github_runner ;;
                5) check_application_setup ;;
                6) check_pm2_status ;;
                7) check_network_connectivity ;;
                8) check_file_permissions ;;
                9) check_disk_space ;;
                r) quick_restart ;;
                f) 
                    auto_fix_dependencies
                    auto_fix_permissions
                    auto_fix_application
                    ;;
                p) auto_fix_permissions ;;
                e) emergency_reset ;;
                q) exit 0 ;;
                *) log_error "Invalid option" ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        case $1 in
            diagnose|diagnosis) run_full_diagnosis ;;
            restart) quick_restart ;;
            fix) 
                auto_fix_dependencies
                auto_fix_permissions
                auto_fix_application
                ;;
            permissions) auto_fix_permissions ;;
            reset) emergency_reset ;;
            *) 
                echo "Usage: $0 [diagnose|restart|fix|permissions|reset]"
                echo "Run without arguments for interactive mode"
                ;;
        esac
    fi
}

# Run main function
main "$@"