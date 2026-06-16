import re
with open('src/ui/dom.js', 'r', encoding='utf-8') as f: dom_js = f.read()
with open('index.html', 'r', encoding='utf-8') as f: html = f.read()

ids_in_js = re.findall(r"getElementById\('([^']+)'\)", dom_js)
missing = [i for i in ids_in_js if f'id="{i}"' not in html and f"id='{i}'" not in html]
print('Missing IDs:', missing)
