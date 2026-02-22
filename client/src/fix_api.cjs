const fs = require('fs');
const path = require('path');

const API_URL_VAR = "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';\n";

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
        } else if (filePath.endsWith('.jsx')) {
            results.push(filePath);
        }
    });
    return results;
}

const files = walkDir('/Users/hugo/Dev/Aura/client/src');
let modifiedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // We care if the file has any reference to /api/ in strings
    const hasFetch = content.includes("'/api/") || content.includes('`/api/');
    if (!hasFetch) continue;

    // Add API_URL definition if not already present
    if (!content.includes('const API_URL = import.meta.env.VITE_API_URL')) {
        // Find the last import statement
        const importRegex = /import.*?;?\n/g;
        let lastImportIndex = 0;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            lastImportIndex = match.index + match[0].length;
        }

        if (lastImportIndex > 0) {
            content = content.slice(0, lastImportIndex) + '\n' + API_URL_VAR + content.slice(lastImportIndex);
        } else {
            content = API_URL_VAR + content;
        }
    }

    // Capture the entire string until the closing quote and replace it with a valid template literal
    content = content.replace(/'\/api\/([^']+)'/g, "`$${API_URL}/api/$1`");
    content = content.replace(/`\/api\/([^`]+)`/g, "`$${API_URL}/api/$1`");

    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated: ${file}`);
}

console.log(`Finished. Modified ${modifiedCount} files.`);
