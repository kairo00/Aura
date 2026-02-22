const fs = require('fs');
const path = require('path');

const files = [
    'components/DMArea.jsx',
    'pages/MainApp.jsx',
    'pages/AdminDashboard.jsx',
    'components/DMList.jsx',
    'components/MemberListPanel.jsx',
    'components/ServerSettingsModal.jsx',
    'components/SettingsModal.jsx',
    'components/MessageInput.jsx',
    'components/MessageList.jsx',
    'components/ServerRail.jsx'
];

const basePath = '/Users/hugo/Dev/ANTIGRAVITY/client/src/';

files.forEach(f => {
    let p = path.join(basePath, f);
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        
        // 1. URLs that already have single quotes: url('${...}') -> url('http://localhost:3001${...}')
        content = content.replace(/url\('(?!\s*http)\$\{/g, "url('http://localhost:3001${");
        
        // 2. URLs that missed single quotes: url(${...}) -> url('http://localhost:3001${...}')
        // (handling ?v= modifiers if they exist outside the template)
        // Actually, let's specifically target the remaining url(${...}) patterns.
        content = content.replace(/url\(\$\{([^}]+)\}\)/g, "url('http://localhost:3001${$1}')");
        
        // Let's also check for url(${u.avatar_url}?v=dm) if any missed quotes
        content = content.replace(/url\(\$\{([^}]+)\}\?([^)]+)\)/g, "url('http://localhost:3001${$1}?$2')");

        fs.writeFileSync(p, content);
        console.log(`Updated ${f}`);
    }
});
