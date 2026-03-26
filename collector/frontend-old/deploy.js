#!/usr/bin/env node

/**
 * Deployment Script for ProDB Collector Frontend
 * Handles complete deployment optimization including resource compression,
 * PWA enhancements, and performance optimizations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { optimizeResources } from './build/optimize-resources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main deployment process
 */
async function deploy() {
    console.log('🚀 Starting ProDB Collector Frontend Deployment...\n');
    
    try {
        // Step 1: Optimize resources
        console.log('📦 Step 1: Resource Optimization');
        await optimizeResources();
        console.log('✅ Resource optimization completed\n');
        
        // Step 2: Generate deployment configuration
        console.log('⚙️  Step 2: Deployment Configuration');
        await generateDeploymentConfig();
        console.log('✅ Deployment configuration generated\n');
        
        // Step 3: Create server configuration files
        console.log('🌐 Step 3: Server Configuration');
        await createServerConfigs();
        console.log('✅ Server configuration files created\n');
        
        // Step 4: Generate deployment documentation
        console.log('📚 Step 4: Documentation Generation');
        await generateDeploymentDocs();
        console.log('✅ Deployment documentation generated\n');
        
        // Step 5: Validate deployment
        console.log('🔍 Step 5: Deployment Validation');
        await validateDeployment();
        console.log('✅ Deployment validation completed\n');
        
        console.log('🎉 Deployment completed successfully!');
        console.log('📁 Deployment files available in: collector/frontend/dist/');
        console.log('📖 See deployment-guide.md for deployment instructions');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

/**
 * Generate deployment configuration
 */
async function generateDeploymentConfig() {
    const config = {
        version: '1.0.0',
        buildDate: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        
        // Server configuration
        server: {
            port: process.env.PORT || 8080,
            host: process.env.HOST || '0.0.0.0',
            compression: true,
            caching: {
                static: '1y',
                dynamic: '1h',
                api: '5m'
            }
        },
        
        // Security configuration
        security: {
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://esm.sh"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"]
            },
            headers: {
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
            }
        },
        
        // Performance configuration
        performance: {
            compression: {
                enabled: true,
                threshold: 1024,
                algorithms: ['gzip', 'brotli']
            },
            caching: {
                enabled: true,
                maxAge: {
                    static: 31536000,  // 1 year
                    dynamic: 3600,     // 1 hour
                    api: 300           // 5 minutes
                }
            }
        }
    };
    
    const distDir = path.join(__dirname, 'dist');
    fs.writeFileSync(
        path.join(distDir, 'deployment-config.json'),
        JSON.stringify(config, null, 2)
    );
}

/**
 * Create server configuration files
 */
async function createServerConfigs() {
    const distDir = path.join(__dirname, 'dist');
    
    // Nginx configuration
    const nginxConfig = `
# Nginx configuration for ProDB Collector Frontend
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self';" always;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Brotli compression (if available)
    brotli on;
    brotli_comp_level 6;
    brotli_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Static file caching
    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        
        # Serve pre-compressed files if available
        location ~* \\.(css|js|json|svg)$ {
            gzip_static on;
            brotli_static on;
        }
    }
    
    # API proxy (adjust backend URL as needed)
    location /api/ {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API caching
        add_header Cache-Control "no-cache, must-revalidate";
    }
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
        
        # HTML caching
        add_header Cache-Control "no-cache, must-revalidate";
    }
    
    # Service worker
    location /sw.js {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Service-Worker-Allowed "/";
    }
    
    # Manifest and PWA files
    location ~* \\.(webmanifest|manifest\\.json)$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }
}
    `.trim();
    
    fs.writeFileSync(path.join(distDir, 'nginx.conf'), nginxConfig);
    
    // Apache .htaccess
    const htaccessConfig = `
# Apache configuration for ProDB Collector Frontend

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/json
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self';"
</IfModule>

# Caching rules
<IfModule mod_expires.c>
    ExpiresActive On
    
    # Static assets
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType font/woff "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
    
    # HTML and dynamic content
    ExpiresByType text/html "access plus 0 seconds"
    ExpiresByType application/json "access plus 0 seconds"
</IfModule>

# SPA routing
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    
    # Handle Angular/React/Vue routing
    RewriteRule ^index\\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>

# Service Worker
<Files "sw.js">
    Header set Cache-Control "no-cache, must-revalidate"
    Header set Service-Worker-Allowed "/"
</Files>

# Manifest
<Files "manifest.json">
    Header set Cache-Control "no-cache, must-revalidate"
</Files>
    `.trim();
    
    fs.writeFileSync(path.join(distDir, '.htaccess'), htaccessConfig);
    
    // Docker configuration
    const dockerfile = `
# Multi-stage build for ProDB Collector Frontend
FROM nginx:alpine

# Copy optimized files
COPY dist/ /usr/share/nginx/html/

# Copy nginx configuration
COPY dist/nginx.conf /etc/nginx/conf.d/default.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
    `.trim();
    
    fs.writeFileSync(path.join(distDir, 'Dockerfile'), dockerfile);
    
    // Docker Compose
    const dockerCompose = `
version: '3.8'

services:
  collector-frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.collector.rule=Host(\`collector.local\`)"
      - "traefik.http.services.collector.loadbalancer.server.port=80"
    `.trim();
    
    fs.writeFileSync(path.join(distDir, 'docker-compose.yml'), dockerCompose);
}

/**
 * Generate deployment documentation
 */
async function generateDeploymentDocs() {
    const distDir = path.join(__dirname, 'dist');
    
    const deploymentGuide = `
# ProDB Collector Frontend Deployment Guide

## Overview

This guide covers the deployment of the optimized ProDB Collector frontend application.

## Quick Start

### Using Docker (Recommended)

\`\`\`bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t prodb-collector-frontend .
docker run -p 80:80 prodb-collector-frontend
\`\`\`

### Using Nginx

1. Copy the contents of the \`dist/\` directory to your web server root
2. Use the provided \`nginx.conf\` configuration
3. Restart Nginx

### Using Apache

1. Copy the contents of the \`dist/\` directory to your web server root
2. Ensure the \`.htaccess\` file is in place
3. Enable required Apache modules: \`mod_rewrite\`, \`mod_headers\`, \`mod_expires\`, \`mod_deflate\`

## Configuration

### Environment Variables

- \`PORT\`: Server port (default: 80)
- \`NODE_ENV\`: Environment (production/development)
- \`API_BASE_URL\`: Backend API URL

### Backend Configuration

Ensure your backend API is accessible and CORS is properly configured:

\`\`\`javascript
// Example CORS configuration
app.use(cors({
    origin: ['http://localhost', 'https://your-domain.com'],
    credentials: true
}));
\`\`\`

## Performance Features

### Caching Strategy

- **Static Assets**: 1 year cache with immutable headers
- **HTML/API**: No cache with must-revalidate
- **Service Worker**: Advanced offline caching

### Compression

- Gzip compression for all text-based files
- Brotli compression (if supported)
- Pre-compressed files served when available

### PWA Features

- Offline functionality with intelligent caching
- App-like experience on mobile devices
- Background sync for offline actions
- Push notifications ready (requires backend setup)

## Security

### Content Security Policy

The application includes a strict CSP that allows:
- Scripts from self and esm.sh (for ES modules)
- Styles from self and Google Fonts
- Images from self and data URLs
- API connections to self only

### Security Headers

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- X-XSS-Protection: 1; mode=block

## Monitoring

### Performance Monitoring

The service worker includes built-in performance monitoring:

\`\`\`javascript
// Access performance stats
navigator.serviceWorker.ready.then(registration => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
        console.log('SW Performance:', event.data);
    };
    
    registration.active.postMessage({
        type: 'GET_PERFORMANCE_STATS'
    }, [messageChannel.port2]);
});
\`\`\`

### Health Checks

- HTTP health check endpoint: \`GET /\`
- Service worker status monitoring
- Cache status monitoring

## Troubleshooting

### Common Issues

1. **Service Worker Not Updating**
   - Clear browser cache
   - Check for console errors
   - Verify service worker registration

2. **API Connection Issues**
   - Check CORS configuration
   - Verify API endpoint URLs
   - Check network connectivity

3. **Caching Issues**
   - Clear browser cache
   - Check cache headers
   - Verify service worker cache management

### Debug Mode

Enable debug logging by setting localStorage:

\`\`\`javascript
localStorage.setItem('debug', 'true');
\`\`\`

## Scaling

### Load Balancing

The application is stateless and can be easily scaled horizontally:

\`\`\`yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collector-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: collector-frontend
  template:
    metadata:
      labels:
        app: collector-frontend
    spec:
      containers:
      - name: frontend
        image: prodb-collector-frontend:latest
        ports:
        - containerPort: 80
\`\`\`

### CDN Integration

For better global performance, consider using a CDN:

1. Upload static assets to CDN
2. Update asset URLs in HTML
3. Configure proper cache headers

## Updates

### Rolling Updates

1. Build new version with updated version number
2. Deploy to staging environment
3. Test thoroughly
4. Deploy to production with zero downtime

### Cache Invalidation

The build process includes cache busting for static assets. Service worker will automatically update when new version is deployed.

## Support

For issues and questions:
- Check the troubleshooting section
- Review browser console for errors
- Check service worker status in DevTools
- Verify network connectivity and API availability
    `.trim();
    
    fs.writeFileSync(path.join(distDir, 'deployment-guide.md'), deploymentGuide);
    
    // Performance optimization guide
    const performanceGuide = `
# Performance Optimization Guide

## Overview

This document outlines the performance optimizations implemented in the ProDB Collector frontend.

## Optimization Techniques

### 1. Resource Optimization

- **CSS Minification**: Removes comments and whitespace
- **JavaScript Minification**: Basic minification for ES modules
- **Critical CSS Inlining**: Above-the-fold CSS inlined in HTML
- **Resource Hints**: Preload, prefetch, and preconnect hints

### 2. Caching Strategy

#### Service Worker Caching

- **Cache First**: Static assets (CSS, JS, images)
- **Network First**: API requests with cache fallback
- **Stale While Revalidate**: External resources

#### Browser Caching

- Static assets: 1 year with immutable headers
- HTML/API: No cache with revalidation
- Intelligent cache invalidation

### 3. Progressive Web App

- **App Shell Architecture**: Core UI cached for instant loading
- **Offline Functionality**: Critical features work offline
- **Background Sync**: Offline actions synced when online
- **Push Notifications**: Ready for real-time updates

### 4. Performance Monitoring

#### Metrics Tracked

- Cache hit/miss rates
- Network request counts
- Error rates
- Service worker uptime

#### Performance Budgets

- Bundle size: < 500KB
- Initial load: < 200KB
- Image size: < 100KB per image
- Font size: < 50KB per font

## Best Practices

### 1. Loading Performance

- Minimize critical rendering path
- Lazy load non-critical resources
- Use resource hints effectively
- Optimize font loading

### 2. Runtime Performance

- Minimize DOM manipulation
- Use efficient event handling
- Implement virtual scrolling for large lists
- Debounce user input

### 3. Network Performance

- Minimize HTTP requests
- Use compression (gzip/brotli)
- Implement intelligent caching
- Optimize API responses

## Monitoring and Analysis

### Browser DevTools

1. **Performance Tab**: Analyze loading and runtime performance
2. **Network Tab**: Monitor resource loading
3. **Application Tab**: Check service worker and cache status
4. **Lighthouse**: Comprehensive performance audit

### Service Worker Metrics

Access performance data programmatically:

\`\`\`javascript
// Get service worker performance stats
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'SW_PERFORMANCE_STATS') {
            console.log('Performance Stats:', event.data.data);
        }
    });
}
\`\`\`

### Performance Monitoring

Implement custom performance monitoring:

\`\`\`javascript
// Monitor Core Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
\`\`\`

## Optimization Checklist

- [ ] Enable compression (gzip/brotli)
- [ ] Configure proper cache headers
- [ ] Implement service worker caching
- [ ] Optimize images and fonts
- [ ] Minimize and bundle resources
- [ ] Use resource hints
- [ ] Enable HTTP/2
- [ ] Implement performance monitoring
- [ ] Set performance budgets
- [ ] Regular performance audits
    `.trim();
    
    fs.writeFileSync(path.join(distDir, 'performance-guide.md'), performanceGuide);
}

/**
 * Validate deployment
 */
async function validateDeployment() {
    const distDir = path.join(__dirname, 'dist');
    
    // Check required files
    const requiredFiles = [
        'index.html',
        'manifest.json',
        'sw.js',
        'deployment-config.json',
        'nginx.conf',
        '.htaccess',
        'Dockerfile',
        'docker-compose.yml'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(distDir, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
    
    // Validate HTML structure
    const htmlPath = path.join(distDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    if (!html.includes('manifest.json')) {
        throw new Error('HTML missing manifest link');
    }
    
    if (!html.includes('sw.js')) {
        throw new Error('HTML missing service worker registration');
    }
    
    // Validate manifest
    const manifestPath = path.join(distDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    if (!manifest.name || !manifest.start_url || !manifest.icons) {
        throw new Error('Invalid manifest structure');
    }
    
    console.log('✅ All validation checks passed');
}

// Run deployment if called directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    deploy();
}

export { deploy };