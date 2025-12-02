# LynxPay Widget

Embeddable deposit widget for any website.

## Features

- 🚀 Easy integration - just add a script tag
- 💰 Beautiful deposit modal with QR codes
- 🔗 Multi-chain support (Solana, Base, Arbitrum)
- 📱 Fully responsive
- 🎨 Customizable styling
- ⚡ Lightweight and fast

## Quick Start

### 1. Add the script to your website

```html
<script src="https://your-cdn.com/lynxpay-widget.js"></script>
<script>
  LynxPay.init({
    apiUrl: 'https://api.lynxpay.com'
  });
</script>
```

### 2. Add deposit buttons

```html
<div id="lynxpay-user123">Deposit Funds</div>
```

The widget will automatically convert any element with `id="lynxpay-{userId}"` into a deposit button.

## Configuration

```javascript
LynxPay.init({
  apiUrl: 'https://api.lynxpay.com', // Your API endpoint
});
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Build widget bundle
pnpm build:widget
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Deploy

### Self-hosted

```bash
# Build static files
pnpm build

# Upload the `out` directory to your CDN
```

## License

MIT

---

**Powered by LYNX Pay**
