# 로컬 서버 완전 독립 및 IDC 서버 마이그레이션 가이드

이 가이드는 현재 로컬 PC에서 구동 중인 백엔드(FastAPI) 서버를 **IDC 센터(mssql.nskorea.com) 서버**로 완전히 이전하여, 
사용자 PC가 꺼져 있더라도 24시간 365일 무중단으로 앱이 작동하게 만드는 절차입니다.

---

## 1단계: IDC 서버에 백엔드 파일 복사 및 환경 구성

이 작업은 **IDC 서버에 원격 데스크톱(RDP)으로 접속**하여 진행합니다.

1. **파일 복사**: 로컬 PC의 `server` 폴더(전체)를 IDC 서버의 적당한 위치(예: `C:\PROK_API\server`)에 복사합니다.
   * *주의: `requests.db`(프로필 및 SQLite 데이터)와 `uploads` 폴더가 포함되어 있어야 기존 데이터가 유지됩니다.*
2. **Python 설치**: IDC 서버에 Python 3.9 이상이 설치되어 있는지 확인하고, 없다면 설치합니다.
3. **가상환경 및 패키지 설치**: 
   * CMD(명령 프롬프트)를 열고 복사한 `server` 폴더로 이동합니다.
   * `python -m venv .venv` 명령으로 가상환경을 만듭니다.
   * `.venv\Scripts\activate` 명령으로 가상환경을 켭니다.
   * `pip install -r requirements.txt` 명령으로 필수 패키지를 설치합니다.
4. **환경변수(.env) 변경**: 
   * `server/.env` 파일을 열고, `DB_SERVER` 값을 `localhost` 또는 `127.0.0.1`로 변경합니다. (IDC 서버 안에서는 DB가 로컬에 있으므로 속도가 훨씬 빠르고 안정적입니다.)

## 2단계: IDC 서버 백그라운드 자동 실행 등록

명령 프롬프트 창을 띄워두지 않아도, 서버 재부팅 시 백그라운드에서 자동으로 서버가 돌게 만들어야 합니다.

1. `server` 폴더 안에 제가 새로 만들어 둔 **`install_service.bat`** 파일을 **관리자 권한으로 실행**하세요.
2. 실행하면 Windows 작업 스케줄러를 통해 시스템 시작 시 `start_prok_api.bat`이 백그라운드(숨김 상태)로 동작하게 설정됩니다.
3. 곧바로 실행해 보려면, CMD(관리자)에서 `schtasks /run /tn "PROK_FastAPI_Backend"`를 입력하시면 됩니다.

## 3단계: IDC 서버 방화벽 및 도메인 개방 (가장 중요)

앱(프론트엔드)이 이 서버에 접속할 수 있도록 포트를 열어주어야 합니다.

1. **포트 개방**: IDC 서버의 [고급 보안이 포함된 Windows Defender 방화벽]에서 **인바운드 규칙**을 추가해 `TCP 5005` 포트를 열어줍니다.
2. **공인 IP 또는 도메인 연결**: 외부에서 이 서버의 IP나 도메인(예: `api.prok.or.kr`)으로 접속할 수 있도록 라우팅/도메인 설정을 확인합니다.
3. **접속 테스트**: 스마트폰 등 외부망에서 `http://[IDC서버IP또는도메인]:5005/api/system/heartbeat`로 접속했을 때 `{"status": "ok"}`가 뜨면 성공입니다.
   * *(권장)* IIS 역방향 프록시나 Cloudflare Tunnel을 활용해 `HTTPS(443)`를 씌워주는 것이 가장 안전합니다.

## 4단계: 프론트엔드(PWA) 연결 변경 및 재배포

IDC 서버 세팅이 끝났다면, 앱이 이제 로컬 PC(ngrok)가 아닌 새로운 IDC 서버를 바라보도록 설정하고 배포합니다. (이 작업은 로컬 PC에서 진행)

1. 로컬 PC의 `client/.env.production` 파일을 엽니다.
2. `VITE_API_URL` 값을 새로 구축한 IDC 서버의 API 주소로 변경합니다.
   * 예시: `VITE_API_URL=http://api.prok.or.kr:5005` (또는 HTTPS 적용 시 `https://api.prok.or.kr`)
3. 로컬 PC의 터미널에서 다음 명령을 실행하여 빌드 및 배포합니다:
   ```bash
   cd client
   npm run build
   firebase deploy --only hosting
   ```
4. **완료!** 이제 로컬 PC를 끄셔도 스마트폰 앱이 완벽히 작동합니다.
