---
description: Build the project, commit to GitHub, and deploy to Firebase
---

// turbo
1. Build the client app
   `cd client; npm run build`

// turbo
2. Add all changes to git
   `git add .`

// turbo
3. Commit the changes
   `git commit -m "Auto-build and update"`

// turbo
4. Push to ProkIntranet GitHub repository
   `git push origin main`

5. (향후 파이어베이스 세팅이 완료되면 여기에 배포 명령어를 추가합니다)
   `firebase deploy --only hosting`
