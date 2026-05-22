import tkinter as tk
from tkinter import messagebox
import requests
import time
import threading
import winsound

class HTTPSCheckerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("HTTPS 발급 확인기")
        self.root.geometry("450x250")
        
        self.is_running = False
        self.check_thread = None
        
        # URL 입력
        tk.Label(root, text="정보넷에 요청한 도메인 주소를 입력하세요\n(예: https://api.prok.or.kr:5005)", font=("Arial", 10)).pack(pady=(10, 0))
        
        self.url_entry = tk.Entry(root, width=45, font=("Arial", 11))
        self.url_entry.insert(0, "https://")
        self.url_entry.pack(pady=5)
        
        # 상태 표시
        self.status_label = tk.Label(root, text="대기 중...", fg="black", font=("Arial", 11))
        self.status_label.pack(pady=20)
        
        # 버튼 프레임
        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=10)
        
        self.start_btn = tk.Button(btn_frame, text="▶ 확인 시작 (10초 간격)", command=self.start_checking, bg="#d4edda", font=("Arial", 10, "bold"), width=20, height=2)
        self.start_btn.pack(side=tk.LEFT, padx=10)
        
        self.stop_btn = tk.Button(btn_frame, text="■ 멈춤", command=self.stop_checking, bg="#f8d7da", font=("Arial", 10, "bold"), width=10, height=2, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT, padx=10)

    def start_checking(self):
        url = self.url_entry.get().strip()
        if not url.startswith("https://"):
            messagebox.showwarning("입력 오류", "https:// 로 시작하는 주소를 입력해주세요.")
            return
            
        self.is_running = True
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.url_entry.config(state=tk.DISABLED)
        self.status_label.config(text="확인 시작됨...", fg="blue")
        
        self.check_thread = threading.Thread(target=self.check_loop, args=(url,), daemon=True)
        self.check_thread.start()

    def stop_checking(self):
        self.is_running = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.url_entry.config(state=tk.NORMAL)
        self.status_label.config(text="확인 중지됨", fg="red")

    def check_loop(self, url):
        while self.is_running:
            try:
                # SSL 인증서 검증을 위해 verify=True (기본값) 유지
                # /docs 로 찔러서 Swagger UI가 뜨는지 확인해도 좋지만, 루트(/) 응답만 받아도 통신 성공임
                response = requests.get(url, timeout=5)
                
                # 오류(예: 404)가 나더라도 통신 자체가 성공했다면 인증서가 발급된 것임
                self.root.after(0, self.success_found, url)
                break
                
            except requests.exceptions.SSLError:
                self.root.after(0, self.update_status, "SSL 인증서가 아직 준비되지 않았습니다.")
            except requests.exceptions.ConnectionError:
                self.root.after(0, self.update_status, "서버에 연결할 수 없습니다. (작업 중/재부팅 중일 수 있음)")
            except Exception as e:
                self.root.after(0, self.update_status, "연결 확인 중...")
                
            # 10초 대기 (중간에 멈춤 버튼을 누를 수 있도록 1초씩 쪼개서 대기)
            for _ in range(10):
                if not self.is_running:
                    break
                time.sleep(1)

    def update_status(self, msg):
        current_time = time.strftime("%H:%M:%S")
        self.status_label.config(text=f"[{current_time}] {msg}", fg="gray")

    def success_found(self, url):
        self.is_running = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.url_entry.config(state=tk.NORMAL)
        self.status_label.config(text="🎉 HTTPS 통신 성공!! 발급 완료 🎉", fg="green", font=("Arial", 13, "bold"))
        
        # 알림 소리 재생
        try:
            winsound.MessageBeep(winsound.MB_ICONASTERISK)
        except:
            pass
            
        messagebox.showinfo("완료 안내", f"HTTPS 인증서 적용이 확인되었습니다!\n이제 다음 작업을 진행할 수 있습니다.\n\n확인된 주소: {url}")

if __name__ == "__main__":
    root = tk.Tk()
    app = HTTPSCheckerApp(root)
    # 창을 화면 중앙에 띄우기 및 최상단으로 올리기
    root.eval('tk::PlaceWindow . center')
    root.attributes('-topmost', True)
    root.after(2000, lambda: root.attributes('-topmost', False))
    root.mainloop()
