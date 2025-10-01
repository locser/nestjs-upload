# WSL Connection Guide - Kết nối vào WSL từ các thiết bị khác

## Tại sao Port Forwarding hoạt động?

### **Kiến trúc mạng WSL2**
```
macOS (192.168.1.100) ←→ Router ←→ Windows (192.168.1.50) ←→ WSL2 (172.20.240.5)
                                         ↑
                                   Port Forwarding
                                   2222 → 22
```

**Giải thích:**
1. **WSL2 chạy trong Hyper-V VM** với dải IP riêng (172.x.x.x)
2. **Windows host** có IP trong mạng gia đình (192.168.x.x)
3. **Port Forwarding** tạo "cầu nối" từ Windows port → WSL port
4. Khi macOS connect tới `Windows_IP:2222` → Windows forward tới `WSL_IP:22`

### **Lệnh đã sử dụng thành công:**
```powershell
# Trên Windows (PowerShell as Administrator)
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=172.20.240.5

# Mở Firewall
New-NetFirewallRule -DisplayName "WSL SSH" -Direction Inbound -LocalPort 2222 -Protocol TCP -Action Allow
```

---

## **Tổng kết tất cả các cách kết nối vào WSL**

### **Method 1: Direct SSH (WSL IP)**
```bash
# Ưu điểm: Đơn giản, trực tiếp
# Nhược điểm: IP WSL thay đổi khi restart

# Setup trên WSL
sudo apt install openssh-server
sudo service ssh start

# Kết nối từ external
ssh username@172.20.240.5
```

**Hạn chế:** WSL2 IP thay đổi mỗi lần restart Windows

### **Method 2: Port Forwarding (THÀNH CÔNG) ⭐**
```powershell
# Trên Windows PowerShell (Admin)
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=WSL_IP

# Firewall rule
New-NetFirewallRule -DisplayName "WSL SSH" -Direction Inbound -LocalPort 2222 -Protocol TCP -Action Allow
```

```bash
# Từ macOS/Linux
ssh -p 2222 username@WINDOWS_IP
```

**Ưu điểm:**
- Stable connection (Windows IP không đổi)
- Có thể access từ bất kỳ đâu trong mạng
- Port custom tránh conflict

### **Method 3: Windows Subsystem for Linux Connect**
```bash
# Từ Windows Command Prompt
wsl -d Ubuntu

# Hoặc Windows Terminal
wt wsl
```

**Chỉ dành cho local access**

### **Method 4: VS Code Remote Extension**
```json
// ~/.ssh/config
Host wsl-dev
    HostName WINDOWS_IP
    User username
    Port 2222
    IdentityFile ~/.ssh/id_rsa
```

**Workflow tích hợp IDE**

### **Method 5: Network Bridge Mode (Advanced)**
```powershell
# Cấu hình WSL dùng bridge network
# File: %USERPROFILE%\.wslconfig
[wsl2]
networkingMode=bridged
vmSwitch=WSLBridge
```

**Phức tạp nhưng WSL có IP trong cùng subnet với Windows**

### **Method 6: VPN/Tunneling**
```bash
# Ngrok tunnel
ngrok tcp 22

# Cloudflare tunnel
cloudflared tunnel --url tcp://localhost:22
```

**Cho remote access qua internet**

---

## **Script tự động hóa Port Forwarding**

### **setup_wsl_port_forward.ps1**
```powershell
# Chạy với quyền Administrator
param(
    [string]$WSLUser = "locuser",
    [int]$ForwardPort = 2222,
    [int]$WSLPort = 22
)

Write-Host "Setting up WSL Port Forwarding..." -ForegroundColor Green

# Get WSL IP
$WSL_IP = wsl hostname -I
$WSL_IP = $WSL_IP.Trim()

Write-Host "WSL IP: $WSL_IP" -ForegroundColor Yellow

# Remove existing port forward
netsh interface portproxy delete v4tov4 listenport=$ForwardPort | Out-Null

# Add new port forward
netsh interface portproxy add v4tov4 listenport=$ForwardPort listenaddress=0.0.0.0 connectport=$WSLPort connectaddress=$WSL_IP

# Add firewall rule
Remove-NetFirewallRule -DisplayName "WSL SSH" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL SSH" -Direction Inbound -LocalPort $ForwardPort -Protocol TCP -Action Allow

Write-Host "Port forwarding setup complete!" -ForegroundColor Green
Write-Host "Connect from external: ssh -p $ForwardPort username@$(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' | Select-Object -ExpandProperty IPAddress)" -ForegroundColor Cyan
```

### **check_wsl_connection.sh** (cho macOS/Linux)
```bash
#!/bin/bash

WINDOWS_IP="192.168.1.50"  # Thay bằng IP Windows của bạn
PORT="2222"
USERNAME="locuser"

echo "🔍 Checking WSL connection..."

# Test network connectivity
if ping -c 1 $WINDOWS_IP >/dev/null 2>&1; then
    echo "✅ Windows host reachable"
else
    echo "❌ Cannot reach Windows host"
    exit 1
fi

# Test SSH port
if nc -z $WINDOWS_IP $PORT >/dev/null 2>&1; then
    echo "✅ SSH port $PORT is open"
else
    echo "❌ SSH port $PORT is not accessible"
    exit 1
fi

# Attempt SSH connection
echo "🚀 Attempting SSH connection..."
ssh -o ConnectTimeout=5 -p $PORT $USERNAME@$WINDOWS_IP "echo 'WSL connection successful!'"
```

---

## **Troubleshooting thường gặp**

### **Problem 1: WSL IP thay đổi**
```powershell
# Script tự động update port forward
$WSL_IP = wsl hostname -I | ForEach-Object {$_.Trim()}
netsh interface portproxy delete v4tov4 listenport=2222
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=$WSL_IP
```

### **Problem 2: Firewall blocking**
```powershell
# Check current rules
Get-NetFirewallRule -DisplayName "*WSL*"

# Allow WSL through firewall
New-NetFirewallRule -DisplayName "WSL All" -Direction Inbound -Action Allow -Program "C:\Windows\System32\wsl.exe"
```

### **Problem 3: Permission denied**
```bash
# Fix SSH permissions in WSL
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
sudo chown -R $USER:$USER ~/.ssh
```

### **Problem 4: Connection timeout**
```bash
# Check if SSH service running
sudo service ssh status
sudo service ssh restart

# Check listening ports
sudo netstat -tlnp | grep :22
```

---

## **Security Best Practices**

### **1. SSH Key Authentication**
```bash
# Trên macOS
ssh-keygen -t ed25519 -C "your_email@example.com"
ssh-copy-id -p 2222 username@WINDOWS_IP

# Disable password auth
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
```

### **2. Port Security**
```bash
# Change default SSH port
sudo nano /etc/ssh/sshd_config
# Port 2024

# Restart SSH
sudo service ssh restart
```

### **3. Fail2Ban Protection**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## **Use Cases và Workflows**

### **Development Workflow**
```bash
# Sync code từ macOS
rsync -avz -e "ssh -p 2222" ./servers/ username@WINDOWS_IP:~/projects/

# Run development server
ssh -p 2222 username@WINDOWS_IP "cd ~/projects && npm run dev"

# Port forward development server
# Trên Windows: netsh interface portproxy add v4tov4 listenport=3000 connectport=3000 connectaddress=WSL_IP
```

### **CI/CD Integration**
```yaml
# GitHub Actions example
- name: Deploy to WSL
  run: |
    ssh -p 2222 ${{ secrets.WSL_USER }}@${{ secrets.WINDOWS_IP }} "
      cd ~/projects &&
      git pull &&
      npm install &&
      pm2 restart all
    "
```

---

## **Monitoring và Logging**

### **Connection monitoring**
```bash
# Trên WSL - monitor connections
sudo tail -f /var/log/auth.log

# Trên Windows - monitor port proxy
netsh interface portproxy show all
```

### **Performance monitoring**
```bash
# Network performance
iperf3 -s  # Trên WSL
iperf3 -c WSL_IP -p 5201  # Từ macOS
```

---

**Tóm tắt:** Method 2 (Port Forwarding) là giải pháp tốt nhất cho môi trường development vì nó stable, secure và dễ setup!

---

## 🌐 Remote Access từ bên ngoài mạng gia đình

### **Method 7: Dynamic DNS + Port Forwarding Router ⭐**
**Phù hợp cho:** Access từ anywhere với internet connection

#### **Step 7.1: Setup Dynamic DNS**
```bash
# Option 1: No-IP (Free)
# 1. Đăng ký tại https://www.noip.com/
# 2. Tạo hostname: yourdomain.ddns.net
# 3. Download No-IP DUC client trên Windows

# Option 2: DuckDNS (Free)
# 1. Đăng ký tại https://www.duckdns.org/
# 2. Tạo subdomain: yourname.duckdns.org
# 3. Setup auto-update script
```

#### **Step 7.2: Router Port Forwarding**
```bash
# Truy cập router admin (thường 192.168.1.1 hoặc 192.168.0.1)
# Tìm "Port Forwarding" hoặc "Virtual Server"
# Add rule:
# Service: SSH-WSL
# External Port: 2222 (hoặc port khác cho security)
# Internal IP: 192.168.x.x (IP Windows máy bạn)
# Internal Port: 2222
# Protocol: TCP
```

#### **Step 7.3: Test Remote Connection**
```bash
# Từ macOS bên ngoài mạng
ssh -p 2222 username@yourname.duckdns.org

# Hoặc với No-IP
ssh -p 2222 username@yourdomain.ddns.net
```

#### **Step 7.4: Security Hardening**
```bash
# Trên WSL - tăng cường bảo mật
sudo nano /etc/ssh/sshd_config

# Thêm các dòng sau:
Port 2222
PermitRootLogin no
PasswordAuthentication no  # Chỉ dùng SSH keys
AllowUsers your_username
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Restart SSH
sudo service ssh restart
```

### **Method 8: VPN Solution**
**Phù hợp cho:** Secure access như trong mạng nội bộ

#### **Option A: Tailscale (Recommended)**
```bash
# Trên Windows - cài Tailscale
# Download từ https://tailscale.com/download/windows
# Login và setup

# Trên macOS - cài Tailscale
brew install --cask tailscale
# Login cùng account

# Connect
ssh -p 2222 username@TAILSCALE_IP_OF_WINDOWS
```

#### **Option B: WireGuard**
```bash
# Trên Windows - cài WireGuard
# Download từ https://www.wireguard.com/install/

# Generate keys
wg genkey | tee private.key | wg pubkey > public.key

# Config file (Windows server):
[Interface]
PrivateKey = WINDOWS_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = MACOS_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32

# Config file (macOS client):
[Interface]
PrivateKey = MACOS_PRIVATE_KEY
Address = 10.0.0.2/24

[Peer]
PublicKey = WINDOWS_PUBLIC_KEY
Endpoint = yourname.duckdns.org:51820
AllowedIPs = 10.0.0.1/32
```

### **Method 9: Cloud Tunneling Services**

#### **Option A: Ngrok (Easy setup)**
```bash
# Trên Windows - cài ngrok
# Download từ https://ngrok.com/download
# Đăng ký account để get authtoken

# Setup
ngrok authtoken YOUR_AUTH_TOKEN

# Expose SSH
ngrok tcp 2222

# Kết quả: tcp://0.tcp.ngrok.io:12345 -> localhost:2222
```

```bash
# Từ macOS
ssh -p 12345 username@0.tcp.ngrok.io
```

#### **Option B: Cloudflare Tunnel**
```bash
# Trên Windows - cài cloudflared
# Download từ https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# Login
cloudflared tunnel login

# Tạo tunnel
cloudflared tunnel create wsl-tunnel

# Config tunnel
# File: C:\Users\%USERNAME%\.cloudflared\config.yml
tunnel: wsl-tunnel
credentials-file: C:\Users\%USERNAME%\.cloudflared\YOUR_TUNNEL_ID.json

ingress:
  - hostname: wsl.yourdomain.com
    service: tcp://localhost:2222
  - service: http_status:404

# Run tunnel
cloudflared tunnel run wsl-tunnel
```

#### **Option C: Frp (Free)**
```bash
# Setup frp server (cần VPS)
# Download từ https://github.com/fatedier/frp/releases

# frps.ini (trên VPS)
[common]
bind_port = 7000

# frpc.ini (trên Windows)
[common]
server_addr = YOUR_VPS_IP
server_port = 7000

[ssh]
type = tcp
local_ip = 127.0.0.1
local_port = 2222
remote_port = 6000

# Connect từ macOS
ssh -p 6000 username@YOUR_VPS_IP
```

---

## 🔋 Keep Windows Always On - Giữ máy luôn hoạt động

### **Method 1: Windows Power Settings**
```powershell
# Trên Windows PowerShell (Admin)

# Disable sleep mode
powercfg -change -standby-timeout-ac 0
powercfg -change -standby-timeout-dc 0

# Disable hibernate
powercfg -change -hibernate-timeout-ac 0
powercfg -change -hibernate-timeout-dc 0

# Disable monitor timeout (optional)
powercfg -change -monitor-timeout-ac 30
powercfg -change -monitor-timeout-dc 15

# Check current settings
powercfg -query
```

### **Method 2: Registry Tweaks cho Always On**
```powershell
# Disable automatic restart sau Windows Update
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f

# Disable fast startup (có thể gây conflict với WSL)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f

# Keep network adapters alive
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v KeepAliveTime /t REG_DWORD /d 300000 /f
```

### **Method 3: Task Scheduler - Auto Wake**
```powershell
# Tạo task để wake máy nếu sleep
schtasks /create /tn "KeepAlive" /tr "powershell.exe -Command \"Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{F15}')\"" /sc minute /mo 10 /ru SYSTEM

# Task này sẽ gửi F15 key mỗi 10 phút để keep active
```

### **Method 4: WSL Auto-Start Script**
```bash
# Tạo file startup script
# File: C:\Users\%USERNAME%\startup_wsl.bat
@echo off
echo Starting WSL services...

REM Start WSL
wsl -d Ubuntu

REM Start SSH service
wsl -d Ubuntu -u root service ssh start

REM Start other services
wsl -d Ubuntu -u root service docker start

echo WSL services started!
```

```powershell
# Add to Windows startup
# Nhấn Win+R, gõ: shell:startup
# Copy startup_wsl.bat vào folder này
```

### **Method 5: Keep Network Alive**
```powershell
# Script giữ network connection active
# File: C:\Scripts\keep_network_alive.ps1
while ($true) {
    try {
        # Ping Google DNS
        Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet
        
        # Keep WSL network alive
        wsl hostname -I
        
        # Log activity
        Write-Host "$(Get-Date): Network check completed"
        
        # Wait 5 minutes
        Start-Sleep -Seconds 300
    }
    catch {
        Write-Host "$(Get-Date): Error - $($_.Exception.Message)"
        Start-Sleep -Seconds 60
    }
}
```

```powershell
# Tạo scheduled task để run script
schtasks /create /tn "NetworkKeepAlive" /tr "powershell.exe -ExecutionPolicy Bypass -File C:\Scripts\keep_network_alive.ps1" /sc onstart /ru SYSTEM
```

### **Method 6: Hardware Settings**
```bash
# BIOS/UEFI Settings cần check:
# 1. Wake on LAN: Enabled
# 2. Deep Sleep: Disabled  
# 3. Fast Boot: Disabled (nếu có vấn đề với WSL)
# 4. USB Power Management: Always On
# 5. Network Boot: Enabled
```

### **Method 7: UPS Solution (Advanced)**
```bash
# Nếu có UPS, cài software để auto-shutdown gracefully
# APC PowerChute hoặc CyberPower PowerPanel

# Setup auto-start sau power restored
# Windows: Control Panel > Power Options > Choose what power buttons do
# Change settings: "Turn on fast startup" = OFF
```

---

## 🔧 Complete Remote Setup Script

### **auto_setup_remote_access.ps1**
```powershell
# Script tự động setup remote access
param(
    [string]$DomainName = "yourname.duckdns.org",
    [string]$SSHPort = "2222",
    [string]$WSLUser = "username"
)

Write-Host "🚀 Setting up remote access to WSL..." -ForegroundColor Green

# 1. Configure Windows power settings
Write-Host "⚡ Configuring power settings..." -ForegroundColor Yellow
powercfg -change -standby-timeout-ac 0
powercfg -change -standby-timeout-dc 0
powercfg -change -hibernate-timeout-ac 0

# 2. Setup port forwarding
Write-Host "🔗 Updating port forwarding..." -ForegroundColor Yellow
$WSL_IP = (wsl hostname -I).Trim()
netsh interface portproxy delete v4tov4 listenport=$SSHPort
netsh interface portproxy add v4tov4 listenport=$SSHPort listenaddress=0.0.0.0 connectport=22 connectaddress=$WSL_IP

# 3. Update firewall
Write-Host "🔥 Updating firewall rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "WSL SSH Remote" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL SSH Remote" -Direction Inbound -LocalPort $SSHPort -Protocol TCP -Action Allow

# 4. Create keep-alive script
Write-Host "💓 Creating keep-alive script..." -ForegroundColor Yellow
$KeepAliveScript = @"
while (`$true) {
    try {
        Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet | Out-Null
        wsl hostname -I | Out-Null
        Write-Host "`$(Get-Date): System active"
        Start-Sleep -Seconds 300
    }
    catch {
        Start-Sleep -Seconds 60
    }
}
"@

$ScriptPath = "C:\Scripts\keep_alive.ps1"
New-Item -Path "C:\Scripts" -ItemType Directory -Force
$KeepAliveScript | Out-File -FilePath $ScriptPath -Encoding UTF8

# 5. Create scheduled task
Write-Host "📅 Creating scheduled task..." -ForegroundColor Yellow
schtasks /delete /tn "WSL-KeepAlive" /f 2>$null
schtasks /create /tn "WSL-KeepAlive" /tr "powershell.exe -ExecutionPolicy Bypass -File $ScriptPath" /sc onstart /ru SYSTEM /f

Write-Host "✅ Setup completed!" -ForegroundColor Green
Write-Host "🌐 External access: ssh -p $SSHPort $WSLUser@$DomainName" -ForegroundColor Cyan
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Setup Dynamic DNS: $DomainName" -ForegroundColor White
Write-Host "  2. Configure router port forwarding: External $SSHPort -> Internal $SSHPort" -ForegroundColor White
Write-Host "  3. Test connection từ outside network" -ForegroundColor White
```

---

## 🔍 Troubleshooting Remote Access

### **Common Issues & Solutions:**

#### **Issue 1: Router không support port forwarding**
```bash
# Solution: Dùng UPnP nếu router support
# Trên Windows, cài UPnP tool
# Hoặc dùng cloud tunneling (ngrok, cloudflare)
```

#### **Issue 2: ISP block port 22**
```bash
# Solution: Dùng port khác
# SSH port 443 (HTTPS port, ít bị block)
# Hoặc port 80 (HTTP port)
netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=22 connectaddress=WSL_IP
```

#### **Issue 3: Dynamic IP thay đổi**
```bash
# Solution: Script auto-update DNS
# File: update_dns.ps1
$CurrentIP = (Invoke-WebRequest -Uri "https://ifconfig.me/ip").Content.Trim()
$DuckDNSToken = "YOUR_DUCKDNS_TOKEN"
$Domain = "yourname"

Invoke-WebRequest -Uri "https://www.duckdns.org/update?domains=$Domain&token=$DuckDNSToken&ip=$CurrentIP"
```

#### **Issue 4: WSL IP thay đổi sau restart**
```bash
# Solution: Auto-update script
# File: update_port_forward.ps1
$WSL_IP = (wsl hostname -I).Trim()
netsh interface portproxy delete v4tov4 listenport=2222
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=$WSL_IP

# Add to startup tasks
schtasks /create /tn "UpdateWSLForwarding" /tr "powershell.exe -File C:\Scripts\update_port_forward.ps1" /sc onstart /ru SYSTEM
```

---

**💡 Recommendations:**
- **For Home Use:** Dynamic DNS + Router Port Forwarding
- **For Security:** VPN solution (Tailscale recommended)  
- **For Simplicity:** Cloud tunneling (ngrok/cloudflare)
- **For Always-On:** UPS + Power management settings