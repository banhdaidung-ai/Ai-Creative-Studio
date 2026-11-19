import json
import re

with open("/Users/banhdaidung/.gemini/antigravity-ide/brain/f32118b1-ca0c-47f3-bd54-d845c4bef674/.system_generated/steps/223/content.md", "r") as f:
    content = f.read()

# Try to find the mission specification text
matches = re.findall(r'MISSION SPECIFICATION.*?(?=\\n\\n|</div>|",|"]|\\")', content, re.IGNORECASE | re.DOTALL)
if matches:
    print("Found direct matches:")
    for m in matches:
        print(m[:1000])

# Try to find anything looking like python or Dockerfile
python_blocks = re.findall(r'from fastapi.*?|import uvicorn.*?', content, re.IGNORECASE)
if python_blocks:
    print("Found python keywords")
