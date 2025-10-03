#!/bin/bash

# Deployment Manager Script for GitHub Self-Hosted Runner
# Provides easy management of deployments, monitoring, and troubleshooting

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
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Deployment Manager                        ║"
    echo "║              GitHub Self-Hosted Runner WSL                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_menu() {
    echo -e "${CYAN}Available Commands:${NC}"
    echo ""
    echo -e "${GREEN}📊 Monitoring:${NC}"
    echo "  status     - Show overall system status"
    echo "  monitor    - Detailed monitoring report"
    echo "  logs       - View application logs"
    echo "  health     - Application health check"
    echo ""
    echo -e "${YELLOW}🚀 Deployment:${NC}"
    echo "  deploy     - Manual deployment"
    echo "  restart    - Restart application"
    echo "  stop       - Stop application"
    echo "  start      - Start application"
    echo ""
    echo -e "${PURPLE}🔧 Runner Management:${NC}"
    echo "  runner     - GitHub runner status/control"
    echo "  runner-logs - View runner logs"
    echo ""
    echo -e "${RED}🧹 Maintenance:${NC}"
    echo "  cleanup    - Clean logs and old backups"
    echo "  backup     - Create manual backup"
    echo "  restore    - Restore from backup"
    echo ""
    echo -e "${BLUE}🔍 Troubleshooting:${NC}"
    echo "  diagnose   - Run diagnostic checks"
    echo "  fix-perms  - Fix file permissions"
    echo "  reset      - Reset application state"
    echo ""
    echo "  help       - Show this menu"
    echo "  exit       - Exit manager"
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

# Status functions
show_status() {
    print_header
    echo -e "${CYAN}📊 System Status Overview${NC}"
    echo "================================"
    
    # System resources
    echo -e "${BLUE}💻 System Resources:${NC}"
    echo "  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "  Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
    echo "  Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"
    echo ""
    
    # GitHub Runner status
    echo -e "${PURPLE}🤖 GitHub Runner:${NC}"
    if sudo $RUNNER_DIR/svc.sh status | grep -q "active"; then
        echo -e "  Status: ${GREEN}Running${NC}"
    else
        echo -e "  Status: ${RED}Stopped${NC}"
    fi
    echo ""
    
    # Application status
    echo -e "${YELLOW}🚀 Application:${NC}"
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        PM2_STATUS=$(pm2 show nestjs-demo | grep "status" | awk '{print $4}')
        if [ "$PM2_STATUS" = "online" ]; then
            echo -e "  Status: ${GREEN}Running${NC}"
        else
            echo -e "  Status: ${RED}$PM2_STATUS${NC}"
        fi
    else
        echo -e "  Status: ${RED}Not found${NC}"
    fi
    
    # Health check
    echo -e "${GREEN}🏥 Health Check:${NC}"
    if curl -s -f http://localhost:3000/health >/dev/null 2>&1; then
        echo -e "  Health: ${GREEN}Healthy${NC}"
    elif curl -s -f http://localhost:3000 >/dev/null 2>&1; then
        echo -e "  Health: ${YELLOW}Responding (no /health endpoint)${NC}"
    else
        echo -e "  Health: ${RED}Not responding${NC}"
    fi
    echo ""
}

detailed_monitor() {
    print_header
    echo -e "${CYAN}📊 Detailed System Monitor${NC}"
    echo "=================================="
    
    # Detailed system info
    echo -e "${BLUE}💻 System Information:${NC}"
    echo "  Hostname: $(hostname)"
    echo "  Uptime: $(uptime -p)"
    echo "  Load Average: $(uptime | awk -F'load average:' '{ print $2 }')"
    echo "  CPU Cores: $(nproc)"
    echo ""
    
    # Detailed memory info
    echo -e "${BLUE}💾 Memory Details:${NC}"
    free -h
    echo ""
    
    # Disk usage details
    echo -e "${BLUE}💿 Disk Usage:${NC}"
    df -h
    echo ""
    
    # PM2 detailed status
    echo -e "${YELLOW}🚀 PM2 Process Details:${NC}"
    pm2 list || echo "No PM2 processes running"
    echo ""
    
    # Network status
    echo -e "${GREEN}🌐 Network Status:${NC}"
    echo "  Port 3000 Status:"
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        echo -e "    ${GREEN}Listening${NC}"
    else
        echo -e "    ${RED}Not listening${NC}"
    fi
    echo ""
    
    # Recent deployments
    echo -e "${PURPLE}📅 Recent Backups:${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR" | tail -5 || echo "No backups found"
    else
        echo "No backup directory"
    fi
}

show_logs() {
    echo -e "${CYAN}📝 Application Logs${NC}"
    echo "==================="
    
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        echo "Recent logs (last 50 lines):"
        pm2 logs nestjs-demo --lines 50 --nostream
    else
        log_error "Application not found in PM2"
    fi
}

health_check() {
    echo -e "${GREEN}🏥 Application Health Check${NC}"
    echo "============================="
    
    # Basic connectivity
    echo "Testing localhost:3000..."
    if curl -s -f http://localhost:3000 >/dev/null; then
        log_success "Application is responding"
    else
        log_error "Application is not responding"
        return 1
    fi
    
    # Health endpoint
    echo "Testing health endpoint..."
    if curl -s -f http://localhost:3000/health >/dev/null; then
        log_success "Health endpoint is working"
        echo "Response:"
        curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health
    else
        log_warning "Health endpoint not available"
    fi
    
    # Performance test
    echo "Performance test..."
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/)
    echo "Response time: ${RESPONSE_TIME}s"
    
    if (( $(echo "$RESPONSE_TIME < 1" | bc -l) )); then
        log_success "Response time is good"
    else
        log_warning "Response time is slow"
    fi
}

# Deployment functions
manual_deploy() {
    echo -e "${YELLOW}🚀 Manual Deployment${NC}"
    echo "===================="
    
    read -p "Are you sure you want to deploy manually? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        return 0
    fi
    
    log_info "Starting manual deployment..."
    
    # Pre-deployment
    if [ -f "$SCRIPTS_DIR/pre-deploy.sh" ]; then
        log_info "Running pre-deployment tasks..."
        bash "$SCRIPTS_DIR/pre-deploy.sh"
    fi
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Project directory not found: $PROJECT_DIR"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --omit=dev
    
    # Build application
    log_info "Building application..."
    npm run build
    
    # Deploy with PM2
    log_info "Deploying with PM2..."
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        pm2 reload nestjs-demo
    else
        pm2 start ecosystem.config.js --env production
    fi
    
    pm2 save
    
    # Post-deployment
    if [ -f "$SCRIPTS_DIR/post-deploy.sh" ]; then
        log_info "Running post-deployment tasks..."
        bash "$SCRIPTS_DIR/post-deploy.sh"
    fi
    
    log_success "Manual deployment completed"
    
    # Health check
    sleep 5
    health_check
}

restart_app() {
    echo -e "${YELLOW}🔄 Restarting Application${NC}"
    echo "========================="
    
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        pm2 restart nestjs-demo
        pm2 save
        log_success "Application restarted"
        sleep 3
        health_check
    else
        log_error "Application not found in PM2"
    fi
}

stop_app() {
    echo -e "${RED}🛑 Stopping Application${NC}"
    echo "======================="
    
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        pm2 stop nestjs-demo
        log_success "Application stopped"
    else
        log_warning "Application not running"
    fi
}

start_app() {
    echo -e "${GREEN}▶️ Starting Application${NC}"
    echo "======================="
    
    cd "$PROJECT_DIR"
    
    if pm2 show nestjs-demo >/dev/null 2>&1; then
        pm2 start nestjs-demo
    else
        pm2 start ecosystem.config.js --env production
    fi
    
    pm2 save
    log_success "Application started"
    sleep 3
    health_check
}

# Runner management
manage_runner() {
    echo -e "${PURPLE}🤖 GitHub Runner Management${NC}"
    echo "============================"
    
    echo "1. Status"
    echo "2. Start"
    echo "3. Stop"
    echo "4. Restart"
    echo "5. Back to main menu"
    echo ""
    read -p "Choose option: " choice
    
    case $choice in
        1)
            sudo $RUNNER_DIR/svc.sh status
            ;;
        2)
            sudo $RUNNER_DIR/svc.sh start
            log_success "Runner started"
            ;;
        3)
            sudo $RUNNER_DIR/svc.sh stop
            log_success "Runner stopped"
            ;;
        4)
            sudo $RUNNER_DIR/svc.sh stop
            sudo $RUNNER_DIR/svc.sh start
            log_success "Runner restarted"
            ;;
        5)
            return 0
            ;;
        *)
            log_error "Invalid option"
            ;;
    esac
}

show_runner_logs() {
    echo -e "${PURPLE}🤖 GitHub Runner Logs${NC}"
    echo "====================="
    
    if [ -d "$RUNNER_DIR/_diag" ]; then
        echo "Recent runner logs:"
        tail -50 $RUNNER_DIR/_diag/Runner_*.log | head -100
    else
        log_error "Runner logs not found"
    fi
}

# Maintenance functions
cleanup_system() {
    echo -e "${RED}🧹 System Cleanup${NC}"
    echo "=================="
    
    # Clean old backups
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Cleaning old backups (keeping last 5)..."
        find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" | sort | head -n -5 | xargs rm -rf
    fi
    
    # Clean npm cache
    log_info "Cleaning npm cache..."
    npm cache clean --force
    
    # Clean PM2 logs
    log_info "Cleaning PM2 logs..."
    pm2 flush
    
    # Clean system logs (optional)
    read -p "Clean system logs? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo journalctl --vacuum-time=7d
    fi
    
    log_success "Cleanup completed"
}

create_backup() {
    echo -e "${BLUE}💾 Creating Backup${NC}"
    echo "=================="
    
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Project directory not found"
        return 1
    fi
    
    BACKUP_NAME="manual_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    cp -r "$PROJECT_DIR" "$BACKUP_PATH/"
    
    log_success "Backup created: $BACKUP_PATH"
}

restore_backup() {
    echo -e "${BLUE}📁 Restore from Backup${NC}"
    echo "======================"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found"
        return 1
    fi
    
    echo "Available backups:"
    ls -la "$BACKUP_DIR"
    echo ""
    read -p "Enter backup directory name: " backup_name
    
    BACKUP_PATH="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$BACKUP_PATH" ]; then
        log_error "Backup not found: $BACKUP_PATH"
        return 1
    fi
    
    read -p "This will overwrite current deployment. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        return 0
    fi
    
    # Stop application
    pm2 stop nestjs-demo || true
    
    # Restore files
    rm -rf "$PROJECT_DIR"
    cp -r "$BACKUP_PATH/nestjs-demo" "$PROJECT_DIR"
    
    # Restart application
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    log_success "Backup restored successfully"
}

# Troubleshooting functions
diagnose_system() {
    echo -e "${BLUE}🔍 System Diagnostics${NC}"
    echo "===================="
    
    # Check directories
    echo "Checking directories..."
    for dir in "$PROJECT_DIR" "$SCRIPTS_DIR" "$RUNNER_DIR" "$LOGS_DIR" "$BACKUP_DIR"; do
        if [ -d "$dir" ]; then
            echo "✅ $dir exists"
        else
            echo "❌ $dir missing"
        fi
    done
    echo ""
    
    # Check services
    echo "Checking services..."
    
    # Node.js
    if command -v node >/dev/null; then
        echo "✅ Node.js: $(node --version)"
    else
        echo "❌ Node.js not installed"
    fi
    
    # NPM
    if command -v npm >/dev/null; then
        echo "✅ NPM: $(npm --version)"
    else
        echo "❌ NPM not installed"
    fi
    
    # PM2
    if command -v pm2 >/dev/null; then
        echo "✅ PM2: $(pm2 --version)"
    else
        echo "❌ PM2 not installed"
    fi
    echo ""
    
    # Check ports
    echo "Checking ports..."
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        echo "✅ Port 3000 is in use"
    else
        echo "⚠️ Port 3000 is free"
    fi
    echo ""
    
    # Check project files
    if [ -d "$PROJECT_DIR" ]; then
        echo "Checking project files..."
        cd "$PROJECT_DIR"
        
        if [ -f "package.json" ]; then
            echo "✅ package.json exists"
        else
            echo "❌ package.json missing"
        fi
        
        if [ -f "ecosystem.config.js" ]; then
            echo "✅ ecosystem.config.js exists"
        else
            echo "❌ ecosystem.config.js missing"
        fi
        
        if [ -d "dist" ]; then
            echo "✅ dist directory exists"
        else
            echo "⚠️ dist directory missing (not built?)"
        fi
        
        if [ -d "node_modules" ]; then
            echo "✅ node_modules exists"
        else
            echo "⚠️ node_modules missing (dependencies not installed?)"
        fi
    fi
}

fix_permissions() {
    echo -e "${BLUE}🔧 Fixing File Permissions${NC}"
    echo "=========================="
    
    # Fix project permissions
    if [ -d "$PROJECT_DIR" ]; then
        chmod -R 755 "$PROJECT_DIR"
        chown -R $USER:$USER "$PROJECT_DIR"
        log_success "Project permissions fixed"
    fi
    
    # Fix script permissions
    if [ -d "$SCRIPTS_DIR" ]; then
        chmod +x "$SCRIPTS_DIR"/*.sh
        log_success "Script permissions fixed"
    fi
    
    # Fix log permissions
    if [ -d "$LOGS_DIR" ]; then
        chmod -R 644 "$LOGS_DIR"/*.log 2>/dev/null || true
        log_success "Log permissions fixed"
    fi
}

reset_application() {
    echo -e "${RED}🔄 Resetting Application State${NC}"
    echo "=============================="
    
    read -p "This will stop the app and clear PM2 state. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Reset cancelled"
        return 0
    fi
    
    # Stop and delete from PM2
    pm2 stop nestjs-demo || true
    pm2 delete nestjs-demo || true
    
    # Clear PM2 state
    pm2 save --force
    
    log_success "Application state reset"
    log_info "Use 'start' command to restart the application"
}

# Main interactive loop
main_loop() {
    while true; do
        echo ""
        print_menu
        echo ""
        read -p "Enter command: " command
        echo ""
        
        case $command in
            status)
                show_status
                ;;
            monitor)
                detailed_monitor
                ;;
            logs)
                show_logs
                ;;
            health)
                health_check
                ;;
            deploy)
                manual_deploy
                ;;
            restart)
                restart_app
                ;;
            stop)
                stop_app
                ;;
            start)
                start_app
                ;;
            runner)
                manage_runner
                ;;
            runner-logs)
                show_runner_logs
                ;;
            cleanup)
                cleanup_system
                ;;
            backup)
                create_backup
                ;;
            restore)
                restore_backup
                ;;
            diagnose)
                diagnose_system
                ;;
            fix-perms)
                fix_permissions
                ;;
            reset)
                reset_application
                ;;
            help)
                print_menu
                ;;
            exit|quit|q)
                log_info "Goodbye!"
                exit 0
                ;;
            *)
                log_error "Unknown command: $command"
                echo "Type 'help' for available commands"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Entry point
if [ $# -eq 0 ]; then
    print_header
    main_loop
else
    # Handle command line arguments
    case $1 in
        status|monitor|logs|health|deploy|restart|stop|start|cleanup|backup|diagnose|fix-perms|reset)
            print_header
            $1
            ;;
        runner)
            print_header
            manage_runner
            ;;
        runner-logs)
            print_header
            show_runner_logs
            ;;
        *)
            echo "Usage: $0 [command]"
            echo "Run without arguments for interactive mode"
            print_menu
            exit 1
            ;;
    esac
fi