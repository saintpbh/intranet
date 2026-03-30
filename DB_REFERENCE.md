# 기장주소록 — DB ↔ API ↔ 프론트엔드 매핑 가이드

> **DB Server:** `192.168.0.145` | **Database:** `KJ_CHURCH` | **Charset:** `cp949`  
> **DB User:** `pbh` (SELECT 권한만 보유, UPDATE/INSERT 불가)

---

## 1. 시스템 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React (Vite)   │────▶│  FastAPI :5000    │────▶│  MS SQL Server      │
│  localhost:5173  │     │  Python Backend   │     │  192.168.0.145      │
│                 │     │                  │     │  DB: KJ_CHURCH      │
│  + SQLite       │     │  requests.db     │     │  Charset: cp949     │
│  (수정요청 관리)  │     │  (로컬 저장)      │     │                     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

---

## 2. API 엔드포인트 ↔ DB 소스 매핑

| API 엔드포인트 | HTTP | DB 소스 | 용도 | 프론트엔드 |
|---|---|---|---|---|
| `/api/ministers?search=` | GET | `VI_MIN_INFO` (View) | 목회자 검색 | `MinisterList.jsx` |
| `/api/ministers/{code}` | GET | `VI_MIN_INFO` (View) | 목회자 상세 | `MinisterDetail.jsx` |
| `/api/elders?search=` | GET | `TB_Chr300` + JOIN | 장로 검색 | `ElderList.jsx` |
| `/api/elders/{priest_code}` | GET | `TB_Chr300` + JOIN | 장로 상세 | `ElderDetail.jsx` |
| `/api/churches?search=` | GET | `TB_Chr100` + JOIN | 교회 검색 | `ChurchList.jsx` |
| `/api/churches/{chr_code}/staff` | GET | `TB_Chr201` + JOIN | 교회 교역자 | `ChurchDetail.jsx` |
| `/api/addressbook?search=` | GET | `VI_MIN_JANG_LIST_2` (View) | 통합 주소록 (미사용) | `AddressBookList.jsx` |
| `/api/ministers/{code}/request-modify` | POST | `requests.db` (SQLite) | 수정 요청 제출 | `MinisterDetail.jsx` |
| `/api/admin/requests` | GET | `requests.db` (SQLite) | 수정 요청 목록 | `AdminApp.jsx` |
| `/api/admin/requests/{id}/approve` | POST | `requests.db` (SQLite) | 수정 요청 승인 | `AdminApp.jsx` |
| `/api/admin/requests/{id}/reject` | POST | `requests.db` (SQLite) | 수정 요청 반려 | `AdminApp.jsx` |

---

## 3. 핵심 테이블 스키마

### TB_Chr100 — 교회 기본정보
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `ChrCode` | char(6) | **PK.** 교회 코드 |
| `ChrName` | varchar(50) | 교회명 |
| `NohCode` | char(4) | FK → TB_Chr910. 노회 코드 |
| `SichalCode` | char(4) | FK → TB_Chr920. 시찰 코드 |
| `PostNo` | char(6) | 우편번호 |
| `Address` | varchar(100) | 도로명/지번 주소 |
| `Juso` | varchar(100) | 상세주소 (동/리/건물명) |
| `Tel_Church` | varchar(20) | 교회 전화번호 |
| `Tel_Fax` | varchar(20) | 팩스 |
| `Email` | varchar(50) | 이메일 |
| `DelGu` | char(1) | 삭제 구분 |

---

### TB_Chr200 — 목회자 기본정보
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `MinisterCode` | char(6) | **PK.** 목회자 코드 |
| `MinisterName` | varchar(30) | 이름 |
| `SexGubun` | char(1) | 성별 |
| `BirthDay` | char(8) | 생년월일 (YYYYMMDD) |
| `AnsuDate` | char(8) | 안수일 |
| `Tel_Mobile` | varchar(20) | 휴대전화 |
| `Email` | varchar(50) | 이메일 |
| `PostNo` / `Address` / `Juso` | — | 주소 정보 |

---

### TB_Chr201 — 목회자 ↔ 교회 배정 이력
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `MinisterCode` | char(6) | FK → TB_Chr200 |
| `AppDate` | char(8) | 부임일 (YYYYMMDD) |
| `TradeDate` | char(8) | 이임일 (NULL이면 현재 재직 중) |
| `DutyCode` | char(2) | FK → TB_Chr900. 직분 코드 |
| `MokGubun` | char(3) | 목사 구분 코드 |
| `ChrCode` | char(6) | FK → TB_Chr100. 교회 코드 |
| `NohCode` | char(4) | 노회 코드 |

> **현재/이전 교역자 판별:** `TradeDate`가 NULL이거나 빈 문자열이면 **현재 교역자**, 값이 있으면 **이전 교역자**

---

### TB_Chr300 — 장로 기본정보
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `PriestCode` | char(6) | **PK.** 장로 코드 |
| `PriestName` | char(20) | 이름 |
| `ChrCode` | char(6) | FK → TB_Chr100. 소속 교회 |
| `Tel_Mobile` | varchar(30) | 휴대전화 |
| `Tel_Home` | varchar(30) | 자택 전화 |
| `Email` | varchar(50) | 이메일 |
| `PostNo` / `Address` / `Juso` | — | 주소 정보 |
| `Occupation` | varchar(50) | 직업 |
| `AppDate` | char(8) | 장로 임직일 |
| `DelGu` | char(1) | 삭제 구분 (`1` = 삭제) |

---

### TB_Chr910 — 노회 마스터
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `NohCode` | char(4) | **PK.** 노회 코드 |
| `NohName` | varchar(30) | 노회명 (예: 경기남, 전북) |

### TB_Chr920 — 시찰 마스터
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `NohCode` | char(4) | FK → TB_Chr910 |
| `SichalCode` | char(4) | **PK.** 시찰 코드 |
| `SichalName` | varchar(30) | 시찰명 (예: 동부, 북부) |

### TB_Chr900 — 공통 코드 마스터
| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `CodeGubun` | char(2) | 코드 구분 (직분, 목사구분 등) |
| `Code` | char(10) | 코드 값 |
| `CodeName` | varchar(50) | 코드명 (담임목사, 부목사 등) |

---

## 4. 뷰(View) 정의

### VI_MIN_INFO — 목회자 통합 View
현재 재직 중인 목회자의 정보를 조합한 뷰. **목회자 열람망의 주요 데이터 소스.**

| 주요 컬럼 | 원본 테이블 | 설명 |
|---|---|---|
| `MinisterCode` | TB_Chr200 | 목회자 코드 |
| `MinisterName` | TB_Chr200 | 이름 |
| `GUBUN` | — | 구분 (목사/전도사 등) |
| `NOHNAME` | TB_Chr910 | 노회명 |
| `CHRNAME` | TB_Chr100 | 교회명 |
| `DUTYNAME` | TB_Chr900 | 직분명 (담임목사, 부목사 등) |
| `TEL_MOBILE` | TB_Chr200 | 휴대전화 |
| `EMAIL` | TB_Chr200 | 이메일 |

### VI_MIN_JANG_LIST_2 — 통합 주소록 View (현재 미사용)
목회자+장로 통합 뷰. 현재는 장로가 `TB_Chr300`을 직접 사용하므로 미사용.

---

## 5. 테이블 관계도 (ERD)

```
TB_Chr910 (노회)
  │
  ├──▶ TB_Chr100 (교회)  ◀── TB_Chr920 (시찰)
  │      │
  │      ├──▶ TB_Chr201 (배정 이력) ◀── TB_Chr200 (목회자)
  │      │         │
  │      │         └──▶ TB_Chr900 (코드 마스터: DutyCode)
  │      │
  │      └──▶ TB_Chr300 (장로)
  │
  └──▶ VI_MIN_INFO (목회자 통합 뷰)
```

---

## 6. 주요 JOIN 패턴

### 교회 검색
```sql
SELECT c.*, n.NohName, s.SichalName
FROM TB_Chr100 c
LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
```

### 교회 소속 교역자 (현재/이전 구분)
```sql
SELECT r.MinisterCode, m.MinisterName, v.DUTYNAME, r.AppDate, r.TradeDate
FROM TB_Chr201 r
JOIN TB_Chr200 m ON r.MinisterCode = m.MinisterCode
LEFT JOIN VI_MIN_INFO v ON r.MinisterCode = v.MinisterCode
WHERE r.ChrCode = ?
ORDER BY 
    CASE WHEN r.TradeDate IS NULL OR r.TradeDate = '' THEN 0 ELSE 1 END,
    r.AppDate ASC
-- 현재: TradeDate IS NULL → is_current = true
-- 이전: TradeDate 값 존재 → is_current = false
```

### 장로 검색
```sql
SELECT e.PriestCode, e.PriestName, c.ChrName, n.NohName
FROM TB_Chr300 e
LEFT JOIN TB_Chr100 c ON e.ChrCode = c.ChrCode
LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
WHERE e.DelGu IS NULL OR e.DelGu != '1'
```

---

## 7. 주소 필드 조합 규칙

모든 주소 엔티티는 3개 필드로 구성:

| 필드 | 예시 | 용도 |
|---|---|---|
| `Address` | `전북특별자치도 전주시 완산구 노송여울1길 3` | 도로명/지번 |
| `Juso` | `(서노송동) 삼호빌딩 6층` | 상세주소 |
| `PostNo` | `54995` | 우편번호 |

**프론트엔드 조합:**
```javascript
const fullAddress = [Address, Juso].filter(Boolean).join(' ') + (PostNo ? ` [${PostNo.trim()}]` : '');
// → "전북특별자치도 전주시 완산구 노송여울1길 3 (서노송동) 삼호빌딩 6층 [54995]"
```

---

## 8. 로컬 DB (SQLite)

**파일:** `server/requests.db`

### modify_requests 테이블
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | INTEGER PK | 자동 증가 |
| `minister_code` | TEXT | 목회자 코드 (MS SQL 참조) |
| `minister_name` | TEXT | 목회자 이름 |
| `field` | TEXT | 수정 요청 필드명 |
| `old_value` | TEXT | 기존 값 |
| `new_value` | TEXT | 요청 값 |
| `status` | TEXT | `PENDING` / `APPROVED` / `REJECTED` |
| `created_at` | DATETIME | 요청 시각 |

> ⚠️ `pbh` 계정은 MS SQL SELECT 권한만 보유. 승인된 수정사항은 DBA가 수동 반영해야 함.

---

## 9. 프론트엔드 라우팅 ↔ 컴포넌트

| 경로 | 컴포넌트 | 데이터 소스 |
|---|---|---|
| `/` | `Home.jsx` | — |
| `/minister` | `MinisterApp.jsx` → `MinisterList` / `MinisterDetail` | `VI_MIN_INFO` |
| `/elder` | `ElderApp.jsx` → `ElderList` / `ElderDetail` | `TB_Chr300` |
| `/admin` | `AdminApp.jsx` | `requests.db` |

> 교회 검색은 `/minister`와 `/elder` 양쪽의 "교회" 탭에서 공유 (`ChurchList` → `ChurchDetail`)
