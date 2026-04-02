-- =============================================
-- PROK_MAP (기장지도) Supabase Schema
-- Supabase SQL Editor에 복사/붙여넣기 후 Run
-- =============================================

-- 1. 교회 테이블 (churches)
CREATE TABLE IF NOT EXISTS churches (
  id BIGSERIAL PRIMARY KEY,
  chr_code VARCHAR(20) UNIQUE,          -- 본부 DB 교회코드
  name VARCHAR(100) NOT NULL,           -- 교회명
  noh VARCHAR(50),                      -- 노회명
  address TEXT,                         -- 주소
  phone VARCHAR(50),                    -- 교회 전화번호
  lat DOUBLE PRECISION NOT NULL,        -- 위도
  lng DOUBLE PRECISION NOT NULL,        -- 경도
  pastor_name VARCHAR(50),              -- 담임목사명
  youtube_channel_id VARCHAR(100),      -- 유튜브 채널 ID
  youtube_video_id VARCHAR(50),         -- 대표 유튜브 영상 ID
  homepage_url TEXT,                    -- 홈페이지 주소
  main_photo_url TEXT,                  -- 대표 사진 URL
  worship_times JSONB DEFAULT '[]'::jsonb, -- 예배 시간 및 장소 (JSON List)
  intro_text TEXT,                      -- 교회 소개 인사말
  accent_color VARCHAR(7) DEFAULT '#1E3A5F', -- 미니홈피 커스텀 색상
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 문의 게시판 테이블 (inquiries)
CREATE TABLE IF NOT EXISTS inquiries (
  id BIGSERIAL PRIMARY KEY,
  church_id BIGINT REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,           -- 문의자 이름
  phone VARCHAR(50),                    -- 문의자 연락처
  content TEXT NOT NULL,                -- 문의 내용
  is_read BOOLEAN DEFAULT FALSE,        -- 읽음 여부
  reply TEXT,                           -- 답변
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 (지도 검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_churches_location ON churches (lat, lng);
CREATE INDEX IF NOT EXISTS idx_churches_noh ON churches (noh);
CREATE INDEX IF NOT EXISTS idx_churches_name ON churches (name);

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 5. 교회 데이터는 누구나 읽기 가능 (공개 지도)
CREATE POLICY "Churches are viewable by everyone"
  ON churches FOR SELECT
  USING (true);

-- 6. 문의는 누구나 작성 가능
CREATE POLICY "Anyone can create inquiries"
  ON inquiries FOR INSERT
  WITH CHECK (true);

-- 7. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER churches_updated_at
  BEFORE UPDATE ON churches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
