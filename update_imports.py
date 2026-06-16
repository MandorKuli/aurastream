import os

replacements = {
    "src/audio/audio-player.js": [
        ("from '../state.js'", "from '../core/state.js'"),
        ("from '../dom.js'", "from '../ui/dom.js'"),
        ("from './utils.js'", "from '../utils/utils.js'")
    ],
    "src/audio/youtube-engine.js": [
        ("from '../state.js'", "from '../core/state.js'")
    ],
    "src/utils/utils.js": [
        ("from '../dom.js'", "from '../ui/dom.js'"),
        ("from '../state.js'", "from '../core/state.js'")
    ],
    "src/core/app.js": [
        ("from './dom.js'", "from '../ui/dom.js'"),
        ("from './src/utils.js'", "from '../utils/utils.js'"),
        ("from './src/youtube-engine.js'", "from '../audio/youtube-engine.js'"),
        ("from './src/audio-player.js'", "from '../audio/audio-player.js'")
    ],
    "index.html": [
        ('href="style.css"', 'href="css/style.css"'),
        ('src="firebase-config.js"', 'src="src/config/firebase-config.js"'),
        ('src="app.js"', 'src="src/core/app.js"')
    ]
}

for filepath, reps in replacements.items():
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        for old, new in reps:
            content = content.replace(old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"Not found: {filepath}")

# Update sw.js caching arrays
if os.path.exists("sw.js"):
    with open("sw.js", 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("'./style.css'", "'./css/style.css'")
    content = content.replace("'./app.js'", "'./src/core/app.js'")
    content = content.replace("'./db.js'", "'./src/core/db.js'")
    content = content.replace("'./api.js'", "'./src/core/api.js'")
    with open("sw.js", 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated sw.js")
