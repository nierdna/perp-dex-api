#!/bin/bash

##############################################
# Docker Build & Push to Registry
##############################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🐳 DOCKER BUILD & PUSH${NC}"
echo "================================"
echo ""

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-your-username}"
IMAGE_NAME="hedging-bot"
VERSION="${VERSION:-latest}"
FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Username: ${DOCKER_USERNAME}"
echo "   Image: ${IMAGE_NAME}"
echo "   Version: ${VERSION}"
echo "   Full tag: ${FULL_IMAGE}"
echo ""

# Check if logged in
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}⚠️  Not logged in to Docker Hub${NC}"
    echo ""
    echo "Please login:"
    echo "  docker login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Docker login verified${NC}"
echo ""

# Build image
echo -e "${BLUE}🔨 Building Docker image...${NC}"
echo ""

docker build \
    --platform linux/amd64 \
    -t ${FULL_IMAGE} \
    -t ${DOCKER_USERNAME}/${IMAGE_NAME}:latest \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""

# Push to registry
echo -e "${BLUE}📤 Pushing to Docker Hub...${NC}"
echo ""

docker push ${FULL_IMAGE}
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Push failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Push successful!${NC}"
echo ""

# Summary
echo "================================"
echo -e "${GREEN}🎉 PUBLISHED!${NC}"
echo "================================"
echo ""
echo "Image available at:"
echo "  docker pull ${FULL_IMAGE}"
echo ""
echo "Or:"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
echo ""
echo "================================"
echo ""

