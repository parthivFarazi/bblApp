# 🍺⚾ Beer Baseball - Delta Upsilon League

A modern Progressive Web App (PWA) for tracking Beer Baseball game scores and statistics for the Delta Upsilon League.

## ✨ Features

- **📊 Real-time Score Tracking**: Track singles, doubles, triples, home runs, and outs for each player
- **📱 Progressive Web App**: Install on mobile devices (iOS/Android) for offline access
- **💾 Persistent Storage**: Stats automatically saved to localStorage
- **📈 Player Statistics**: View batting averages and performance metrics
- **👥 Team Management**: Easy player pool selection and team setup
- **📤 Export/Import**: Save and restore stats as JSON files
- **🎨 Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **🌐 Offline Support**: Service worker enables offline functionality after first visit

## 🚀 Live Demo

Visit the app at: [https://parthivFarazi.github.io/bblApp/](https://parthivFarazi.github.io/bblApp/)

## 🛠️ Local Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/parthivFarazi/bblApp.git
cd bblApp
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## 🏗️ Building for Production

Build the app for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

To preview the production build locally:

```bash
npm run preview
```

## 📦 Deployment

### GitHub Pages

The app automatically deploys to GitHub Pages when you push to the `main` branch.

**Setup:**

1. Go to your repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to main branch - the workflow will build and deploy automatically

The app will be available at: `https://parthivFarazi.github.io/bblApp/`

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/parthivFarazi/bblApp)

**Manual Deployment:**

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/parthivFarazi/bblApp)

**Manual Deployment:**

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run: `netlify deploy --prod`
3. Follow the prompts

## 📱 Installing as PWA

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)

1. Open the app in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"
4. Follow the prompts

### Desktop (Chrome/Edge)

1. Open the app in Chrome or Edge
2. Look for the install icon in the address bar
3. Click "Install"

## 🎮 How to Use

### Setting Up Teams

1. Click "Team Setup" button
2. Select players from the player pool for each team
3. Players are organized by house (Alpha, Beta, Gamma, Delta, Epsilon, Zeta)

### Recording Game Results

1. The current batter is displayed prominently
2. Click the appropriate button to record the result:
   - **Single**: Base hit
   - **Double**: Two-base hit
   - **Triple**: Three-base hit
   - **Home Run**: Four-base hit
   - **Out**: Batter is out
3. The app automatically advances to the next batter
4. Teams alternate after all batters have hit

### Viewing Statistics

1. Click "Stats" to view player statistics
2. See singles (1B), doubles (2B), triples (3B), home runs (HR), outs, and batting average
3. Batting average is calculated as hits divided by at-bats

### Managing Data

- **Export**: Download stats as JSON file for backup
- **Import**: Upload previously exported JSON file to restore stats
- **Clear All**: Reset all teams and statistics (requires confirmation)

## 🏗️ Project Structure

```
bblApp/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── public/
│   ├── icon-192.png           # PWA icon (192x192)
│   ├── icon-512.png           # PWA icon (512x512)
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker for offline support
├── src/
│   ├── App.jsx                # Main application component
│   ├── index.css              # Global styles with Tailwind
│   └── main.jsx               # React entry point
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── vercel.json                # Vercel deployment config
└── netlify.toml               # Netlify deployment config
```

## 🧰 Technologies Used

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Service Workers**: Offline functionality
- **LocalStorage API**: Data persistence

## 🔒 Privacy

All data is stored locally in your browser's localStorage. No data is sent to any server or third party.

## 📝 Version History

### v1.0.0 (2025-11-14)
- Initial release
- Team management
- Score tracking
- Statistics display
- PWA support
- Export/Import functionality
- Offline support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Author

Delta Upsilon League

## 🙏 Acknowledgments

- Delta Upsilon fraternity members
- All contributors to this project

---

**Enjoy tracking your Beer Baseball games! 🍺⚾**
