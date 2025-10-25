
# 📦 HƯỚNG DẪN ĐÓNG GÓI & PUBLISH

## 🎯 CÁC CÁCH PUBLISH:

### 1️⃣ DOCKER HUB (Public/Private Registry)
### 2️⃣ GITHUB CONTAINER REGISTRY (GHCR)
### 3️⃣ PRIVATE REGISTRY (Self-hosted)

---

## 🚀 METHOD 1: DOCKER HUB

### Step 1: Tạo tài khoản Docker Hub
- Vào https://hub.docker.com
- Sign up (free)
- Tạo repository: `hedging-bot`

### Step 2: Login
```bash
docker login
# Enter username & password
```

### Step 3: Build & Tag
```bash
export DOCKER_USERNAME=your-username

# Build for x86_64 (production)
docker build \
  --platform linux/amd64 \
  -t $DOCKER_USERNAME/hedging-bot:latest \
  -t $DOCKER_USERNAME/hedging-bot:v1.0.0 \
  .
```

### Step 4: Push
```bash
docker push $DOCKER_USERNAME/hedging-bot:latest
docker push $DOCKER_USERNAME/hedging-bot:v1.0.0
```

### Step 5: Sử dụng
```bash
# On production server:
docker pull $DOCKER_USERNAME/hedging-bot:latest

docker run -d \
  --name hedging-bot \
  --env-file .env \
  --restart unless-stopped \
  $DOCKER_USERNAME/hedging-bot:latest
```

---

## 🤖 METHOD 2: GITHUB CONTAINER REGISTRY (AUTO)

### Step 1: Push code lên GitHub
```bash
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### Step 2: GitHub Actions tự động build & push
- File: `.github/workflows/docker-publish.yml`
- Trigger: Push to main or tag
- Output: `ghcr.io/your-username/point-dex:latest`

### Step 3: Pull & Run
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull
docker pull ghcr.io/your-username/point-dex:latest

# Run
docker run -d \
  --name hedging-bot \
  --env-file .env \
  --restart unless-stopped \
  ghcr.io/your-username/point-dex:latest
```

---

## 🏢 METHOD 3: PRIVATE REGISTRY

### Option A: Docker Hub Private Repo
```bash
# Same as Method 1 but set repo to "Private"
```

### Option B: AWS ECR
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Tag & Push
docker tag hedging-bot:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/hedging-bot:latest

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/hedging-bot:latest
```

### Option C: Self-hosted Registry
```bash
# Run private registry
docker run -d -p 5000:5000 --name registry registry:2

# Tag & Push
docker tag hedging-bot:latest localhost:5000/hedging-bot:latest
docker push localhost:5000/hedging-bot:latest
```

---

## 📝 QUICK SCRIPT

### Dùng script tự động:
```bash
# Set username
export DOCKER_USERNAME=your-dockerhub-username

# Run publish script
sh scripts/docker_publish.sh

# Với version cụ thể:
VERSION=v1.0.0 sh scripts/docker_publish.sh
```

---

## 🔒 BẢO MẬT

### ⚠️ QUAN TRỌNG:

**KHÔNG BAO GIỜ:**
- ❌ Commit `.env` file
- ❌ Include API keys trong image
- ❌ Hardcode credentials

**LUÔN:**
- ✅ Dùng `.env` file riêng
- ✅ Mount `.env` khi chạy container
- ✅ Dùng Docker secrets (production)

### Docker Secrets (Production):
```bash
# Create secrets
echo "your-private-key" | docker secret create lighter_key -
echo "your-api-key" | docker secret create aster_key -

# Use in docker-compose.yml:
services:
  hedging-bot:
    secrets:
      - lighter_key
      - aster_key

secrets:
  lighter_key:
    external: true
  aster_key:
    external: true
```

---

## 🎯 KHUYẾN NGHỊ

### Development:
- ✅ Chạy native: `sh scripts/run_bot.sh`
- Nhanh, dễ debug

### Production:
- ✅ Dùng Docker
- ✅ Push lên GHCR (free, private)
- ✅ Auto deploy via GitHub Actions

---

## 📊 EXAMPLE WORKFLOW

### Local Development:
```bash
sh scripts/run_bot.sh
```

### Test Docker locally:
```bash
docker-compose up -d
docker-compose logs -f hedging-bot
```

### Publish:
```bash
# Method 1: Docker Hub
export DOCKER_USERNAME=myusername
sh scripts/docker_publish.sh

# Method 2: GitHub
git push origin main
# Auto build & push via GitHub Actions
```

### Production Deploy:
```bash
# On server:
docker pull myusername/hedging-bot:latest
docker run -d --env-file .env myusername/hedging-bot:latest
```

---

## 🔧 Troubleshooting

### Build fails:
```bash
# Clean build
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

### Platform issues:
```bash
# Force platform
docker buildx build --platform linux/amd64 -t myimage .
```

### Push fails:
```bash
# Re-login
docker logout
docker login
```

