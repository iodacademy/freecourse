const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.module.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');

const map = {
  '36px': 'var(--font-size-4xl)',
  '32px': 'var(--font-size-3xl)',
  '30px': 'var(--font-size-3xl)',
  '28px': 'var(--font-size-3xl)',
  '26px': 'var(--font-size-3xl)',
  '24px': 'var(--font-size-2xl)', // 18px
  '22px': 'var(--font-size-xl)',
  '20px': 'var(--font-size-xl)',  // 16px
  '19px': 'var(--font-size-xl)',
  '18px': 'var(--font-size-lg)',  // 14px
  '17px': 'var(--font-size-lg)',
  '16px': 'var(--font-size-base)',// 12px
  '15px': 'var(--font-size-base)',
  '14px': 'var(--font-size-sm)',  // 11px
  '13px': 'var(--font-size-sm)',
  '13.5px': 'var(--font-size-sm)',
  '12.5px': 'var(--font-size-xs)',
  '12px': 'var(--font-size-xs)',  // 10px
  '11.5px': 'var(--font-size-xs)',
  '11px': 'var(--font-size-xs)',  
  '10px': 'var(--font-size-xs)'
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  content = content.replace(/font-size:\s*([\d\.]+px);/g, (match, p1) => {
    if (map[p1]) {
      changed = true;
      return `font-size: ${map[p1]};`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
