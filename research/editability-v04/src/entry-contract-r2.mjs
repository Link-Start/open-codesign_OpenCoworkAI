// Trusted Babel parses/transforms source as DATA. Generated code is never executed here.
export const APP_SCRIPT_ENTRY_CONTRACT = 'v04-jsx-app-script-react-1';
const fail = (code, detail = '') => { throw Object.assign(new Error(code + (detail ? ': ' + detail : '')), { code }); };
function walk(node, visit, parent = null, parentKey = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const item of node) walk(item, visit, parent, parentKey); return; }
  if (typeof node.type === 'string') visit(node, parent, parentKey);
  for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens'].includes(key)) walk(value, visit, node, key);
}
function memberName(node) {
  if (!['MemberExpression', 'OptionalMemberExpression'].includes(node?.type)) return null;
  return node.computed ? (node.property?.type === 'StringLiteral' ? node.property.value : null) : node.property?.name;
}
export function compileAppScriptR2({ source, Babel } = {}) {
  if (typeof source !== 'string') fail('APP_SCRIPT_SOURCE_REQUIRED');
  if (source.length > 1048576) fail('APP_SCRIPT_SOURCE_TOO_LARGE');
  if (typeof Babel?.transform !== 'function') fail('TRUSTED_BABEL_REQUIRED');
  let ast;
  try {
    // Module parsing is deliberate: identify and reject module declarations explicitly.
    ast = Babel.transform(source, { ast: true, code: false, presets: [], plugins: [], sourceType: 'module',
      parserOpts: { plugins: ['jsx'] }, filename: 'candidate.jsx', babelrc: false, configFile: false }).ast;
  } catch (error) { fail('APP_SCRIPT_PARSE_ERROR', String(error.message)); }
  const program = ast?.type === 'File' ? ast.program : ast;
  if (program?.type !== 'Program' || !Array.isArray(program.body)) fail('TRUSTED_BABEL_AST_UNAVAILABLE');
  walk(program, (node, parent, parentKey) => {
    if (['ImportDeclaration', 'ImportExpression', 'ExportDefaultDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
        || (node.type === 'CallExpression' && node.callee?.type === 'Import')) fail('APP_SCRIPT_MODULE_SYNTAX_FORBIDDEN');
    const nonReferenceProperty = parent && !parent.computed && parentKey === 'key'
      && ['ObjectProperty', 'ObjectMethod'].includes(parent.type) && !parent.shorthand;
    const nonReferenceMember = parent && !parent.computed && parentKey === 'property'
      && ['MemberExpression', 'OptionalMemberExpression'].includes(parent.type);
    if ((node.type === 'Identifier' && node.name === 'ReactDOM' && !nonReferenceProperty && !nonReferenceMember)
        || (['CallExpression', 'OptionalCallExpression'].includes(node.type)
          && (['createRoot', 'hydrateRoot'].includes(node.callee?.name) || ['createRoot', 'hydrateRoot'].includes(memberName(node.callee))))) fail('APP_SCRIPT_SELF_MOUNT_FORBIDDEN');
  });
  const declared = [];
  for (const node of program.body) {
    if (node.type === 'FunctionDeclaration' && ['App', '_App'].includes(node.id?.name)) declared.push(node.id.name);
    if (node.type === 'VariableDeclaration' && ['const', 'let'].includes(node.kind)) {
      for (const declaration of node.declarations) if (declaration.id?.type === 'Identifier' && ['App', '_App'].includes(declaration.id.name)) declared.push(declaration.id.name);
    }
  }
  if (!declared.length) fail('APP_SCRIPT_ENTRY_MISSING', 'Top-level function/const/let App or _App required');
  const entryName = declared.includes('App') ? 'App' : '_App';
  let code;
  try {
    code = Babel.transform(source, { presets: ['react'], plugins: [], sourceType: 'script', filename: 'candidate.jsx',
      babelrc: false, configFile: false, ast: false, comments: true }).code;
  } catch (error) { fail('APP_SCRIPT_COMPILE_ERROR', String(error.message)); }
  if (typeof code !== 'string') fail('TRUSTED_BABEL_CODE_UNAVAILABLE');
  return { code, entryName, entryContract: APP_SCRIPT_ENTRY_CONTRACT, selectionRule: 'App-before-_App', declaredEntries: [...new Set(declared)] };
}
