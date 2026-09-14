import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
const moduleOf = (file) => file.match(/^src\/ui\/modules\/([^/]+)/)?.[1];
const errors = [];
for (const file of files(path.join(root, 'src'))) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const check = (specifier) => {
    if (!specifier.startsWith('@/') && !specifier.startsWith('.')) {
      if (moduleOf(rel) && /^(zustand|node:|fs$|electron$)/.test(specifier)) errors.push(`${rel}: UI module cannot access state/persistence directly: ${specifier}`);
      return;
    }
    const target = (specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : path.relative(root, path.resolve(path.dirname(file), specifier))).split(path.sep).join('/');
    const fromModule = moduleOf(rel), toModule = moduleOf(target);
    if (rel.startsWith('src/core/') && !target.startsWith('src/core/')) errors.push(`${rel}: domain cannot import outer layer ${specifier}`);
    if (rel.startsWith('src/data/') && !target.startsWith('src/data/') && !target.startsWith('src/core/')) errors.push(`${rel}: repository adapter cannot import ${specifier}`);
    if (fromModule && toModule && fromModule !== toModule) errors.push(`${rel}: sibling module import ${specifier}; compose through features instead`);
    if (fromModule && !toModule && !target.startsWith('src/core/') && !target.startsWith('src/ui/primitives')) errors.push(`${rel}: module dependency ${specifier} must be injected through props`);
    if (toModule && fromModule !== toModule && !new RegExp(`^src/ui/modules/${toModule}(/index(\\.ts)?)?$`).test(target)) errors.push(`${rel}: use the public index of ${toModule}`);
    if ((rel.startsWith('src/core/') || rel.startsWith('src/data/') || rel.startsWith('src/store/')) && target.startsWith('src/ui/')) errors.push(`${rel}: inner layer cannot import UI ${specifier}`);
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Module boundaries: PASS (public exports, sibling isolation, injected ports, inward layers)');
