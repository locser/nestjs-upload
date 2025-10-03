# 🚀 GitHub Self-Hosted Runner trên WSL - Complete Setup

## 📋 Tổng quan

Hệ thống CI/CD hoàn chỉnh sử dụng GitHub Self-Hosted Runner trên WSL để triển khai NestJS application tự động khi push code.

## 🏗️ Kiến trúc

```
GitHub Repository (push code)
    ↓
GitHub Actions Workflow
    ↓  
Self-Hosted Runner (WSL)
    ↓
Local Deployment (PM2)
    ↓
Application Running (localhost:3000)
```

## 📁 File Structure

```
servers/
├── GitHub_Self_Hosted_Runner_WSL_Setup.md    # Hướng dẫn chi tiết setup
├── setup-runner.sh                           # Script tự động setup runner
├── deployment-manager.sh                     # Quản lý deployment
├── troubleshooting-guide.sh                  # Chẩn đoán và sửa lỗi
└── README_SELF_HOSTED_RUNNER.md              # File này

.github/workflows/
├── ci-self-hosted.yml                        # Workflow cho self-hosted runner
└── ci-beta.yml                               # Workflow cũ (backup)
```

## 🚀 Quick Start

### Bước 1: Setup Runner
```bash
# Clone repository
git clone <your-repo-url>
cd <your-repo>

# Make scripts executable
chmod +x servers/*.sh

# Run setup script
bash servers/setup-runner.sh
```

### Bước 2: Configure GitHub
1. Vào GitHub repo → Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Copy registration token
4. Paste vào setup script khi được hỏi

### Bước 3: Test Deployment
```bash
# Push code to main or beta branch
git add .
git commit -m "Test self-hosted runner"
git push origin main
```

## 🛠️ Management Scripts

### 1. Deployment Manager
```bash
# Interactive mode
bash servers/deployment-manager.sh

# Command line mode
bash servers/deployment-manager.sh status
bash servers/deployment-manager.sh deploy
bash servers/deployment-manager.sh restart
```

**Available Commands:**
- `status` - System overview
- `monitor` - Detailed monitoring
- `logs` - View application logs
- `health` - Health check
- `deploy` - Manual deployment
- `restart/stop/start` - Application control
- `runner` - Runner management
- `cleanup` - Clean logs and backups
- `backup/restore` - Backup management
- `diagnose` - Run diagnostics

### 2. Troubleshooting Guide
```bash
# Interactive mode
bash servers/troubleshooting-guide.sh

# Quick diagnosis
bash servers/troubleshooting-guide.sh diagnose

# Quick fixes
bash servers/troubleshooting-guide.sh fix
bash servers/troubleshooting-guide.sh restart
bash servers/troubleshooting-guide.sh reset
```

## 📊 Monitoring

### Real-time Monitoring
```bash
# Application status
pm2 status
pm2 monit

# System resources
htop
df -h

# Application logs
pm2 logs nestjs-demo --lines 50

# Runner logs
tail -f ~/actions-runner/_diag/Runner_*.log
```

### Useful Aliases (Auto-added by setup)
```bash
# Runner management
runner-status    # Check runner status
runner-start     # Start runner
runner-stop      # Stop runner
runner-restart   # Restart runner
runner-logs      # View runner logs

# Application management
app-status       # PM2 status
app-logs         # Application logs
app-monitor      # PM2 monitor
app-restart      # Restart app
app-stop         # Stop app
app-start        # Start app

# Quick checks
health-check     # Test application health
deploy-monitor   # System monitoring
deploy-logs      # Recent logs
```

## 🔧 Configuration

### Environment Variables
Create `.env.production` in project directory:
```env
NODE_ENV=production
PORT=3000
# Add your production variables
DATABASE_URL=
JWT_SECRET=
```

### PM2 Ecosystem
Auto-created `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'nestjs-demo',
    script: 'dist/main.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    max_memory_restart: '300M',
    autorestart: true,
    watch: false
  }]
}
```

## 🔍 Workflow Details

### ci-self-hosted.yml Features:
- **Quick Validation**: Fast lint/test on GitHub-hosted runners
- **Self-Hosted Deployment**: Full deployment on WSL
- **Health Checks**: Automated application health verification
- **Rollback Support**: Automatic backup before deployment
- **Resource Monitoring**: System resource reporting
- **Error Handling**: Comprehensive error reporting

### Workflow Triggers:
- Push to `main` or `beta` branches
- Pull requests to `main` or `beta`
- Manual workflow dispatch

## 🚨 Troubleshooting

### Common Issues & Solutions

**1. Runner Not Connecting**
```bash
# Check runner status
sudo ~/actions-runner/svc.sh status

# Restart runner service
sudo ~/actions-runner/svc.sh stop
sudo ~/actions-runner/svc.sh start

# Check logs
tail -f ~/actions-runner/_diag/Runner_*.log
```

**2. Application Not Starting**
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs nestjs-demo

# Restart application
pm2 restart nestjs-demo

# Full rebuild
cd ~/projects/nestjs-demo
npm ci --omit=dev
npm run build
pm2 restart nestjs-demo
```

**3. Port Already in Use**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill process if needed
sudo kill -9 <PID>

# Or change port in ecosystem.config.js
```

**4. Permission Issues**
```bash
# Fix file permissions
bash servers/troubleshooting-guide.sh permissions

# Or manually
chmod -R 755 ~/projects/nestjs-demo
chown -R $USER:$USER ~/projects/nestjs-demo
```

**5. Out of Disk Space**
```bash
# Clean up system
bash servers/deployment-manager.sh cleanup

# Check disk usage
df -h
du -sh ~/projects ~/logs ~/backups
```

### Emergency Procedures

**Complete Reset:**
```bash
# Run emergency reset
bash servers/troubleshooting-guide.sh reset

# Or manual reset
pm2 delete all
sudo ~/actions-runner/svc.sh restart
cd ~/projects/nestjs-demo
npm ci --omit=dev
npm run build
pm2 start ecosystem.config.js --env production
```

## 📈 Performance Optimization

### System Optimization
```bash
# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=2048"

# PM2 optimization
pm2 set pm2:autodump true
pm2 set pm2:watch-ignore-paths '["node_modules","logs"]'
```

### Log Management
```bash
# Setup log rotation (auto-configured by setup script)
sudo nano /etc/logrotate.d/nestjs-demo

# Manual log cleanup
pm2 flush
find ~/logs -name "*.log" -mtime +7 -delete
```

## 🔐 Security Best Practices

### Runner Security
- Runner chạy với user permissions (không dùng root)
- Repository secrets được encrypt
- Private repository access only
- Regular token rotation

### Application Security
- Environment variables trong .env files
- PM2 process isolation
- Log file permissions restrictive
- Regular dependency updates

### Network Security
- Application bind localhost only
- Firewall configuration
- SSH key authentication preferred
- Regular security updates

## 📊 Monitoring & Alerting

### System Monitoring
```bash
# CPU and Memory monitoring
watch -n 5 'ps aux | grep -E "(node|pm2)" | head -10'

# Disk monitoring
watch -n 30 'df -h /'

# Application monitoring
watch -n 10 'curl -s http://localhost:3000/health || echo "DOWN"'
```

### Log Monitoring
```bash
# Real-time error monitoring
pm2 logs nestjs-demo --err --lines 0

# Application metrics
pm2 show nestjs-demo
```

## 🔄 Maintenance Tasks

### Daily
- Check application health: `health-check`
- Monitor system resources: `deploy-monitor`
- Review error logs: `app-logs`

### Weekly  
- Clean old logs: `deployment-manager.sh cleanup`
- Update dependencies: `npm audit fix`
- Check runner status: `runner-status`

### Monthly
- Update Node.js: Check for new LTS versions
- Update PM2: `npm update -g pm2`
- Review and optimize PM2 config
- Backup configuration files

## 📚 Additional Resources

### Documentation Files
- `GitHub_Self_Hosted_Runner_WSL_Setup.md` - Detailed setup guide
- `WSL_Connection_Guide.md` - WSL networking setup
- `GitHub_Actions_Complete_Guide.md` - GitHub Actions reference

### Useful Links
- [GitHub Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [NestJS Deployment](https://docs.nestjs.com/deployment)

## 🆘 Support

### Getting Help
1. Run diagnostic: `bash servers/troubleshooting-guide.sh diagnose`
2. Check logs: `deployment-manager.sh logs`
3. Review setup guide: `servers/GitHub_Self_Hosted_Runner_WSL_Setup.md`
4. GitHub Issues: Create issue in repository

### Contact Information
- GitHub Issues: `<your-repo>/issues`
- Internal Documentation: Confluence/Wiki
- Team Channel: Slack/Discord

---

## 🎉 Success Indicators

✅ **Setup Complete When:**
- Runner shows "Listening for Jobs" in GitHub
- `health-check` returns successful response  
- `pm2 status` shows application online
- Push to main/beta triggers automatic deployment
- Application accessible at http://localhost:3000

✅ **Daily Operations:**
- Automatic deployments on code push
- Zero-downtime deployments with PM2
- Automatic health checks and monitoring
- Log rotation and cleanup
- System resource optimization

**🚀 Congratulations! Your self-hosted CI/CD pipeline is ready!**