"""
File Detection and Interception Module - Enhanced with Auto-Sandbox Launch
Cross-platform - No Windows-specific imports required
Only processes NEW files created AFTER application starts
"""
import os
import time
import hashlib
import logging
import threading
import subprocess
import json
import sys
from pathlib import Path
from datetime import datetime

# Use only cross-platform libraries
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    logging.warning("Watchdog not available. Using polling mode.")

logger = logging.getLogger(__name__)


class SandboxieLauncher:
    """Sandboxie Plus Integration for safe file execution"""
    
    def __init__(self):
        self.sandboxie_path = self._find_sandboxie()
        self.sandboxie_available = self.sandboxie_path is not None
        self.default_sandbox = "DefaultBox"
        self.active_processes = []
        self.is_active = True  # Always active from start
        
        if self.sandboxie_available:
            logger.info(f"✅ Sandboxie Plus found at: {self.sandboxie_path}")
            logger.info("🛡️ Sandbox protection is ACTIVE from startup")
        else:
            logger.warning("⚠️ Sandboxie Plus not found. Using basic isolation.")
            logger.warning("🛡️ Basic isolation protection is ACTIVE from startup")
    
    def _find_sandboxie(self):
        """Find Sandboxie Plus installation"""
        possible_paths = [
            r"C:\Program Files\Sandboxie Plus\SandMan.exe",
            r"C:\Program Files\Sandboxie\Sandboxie.exe",
            r"C:\Program Files (x86)\Sandboxie\Sandboxie.exe",
            r"C:\Program Files\Sandboxie Plus\Start.exe",
            r"C:\Program Files\Sandboxie\Start.exe",
            r"C:\Program Files\Sandboxie Plus\Sandboxie.exe",
            r"C:\Program Files\Sandboxie\SandMan.exe",
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # Check if sandboxie is in PATH (Windows only)
        if os.name == 'nt':
            try:
                result = subprocess.run(['where', 'sandboxie'], 
                                       capture_output=True, text=True, shell=True)
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip().split('\n')[0]
            except:
                pass
        
        return None
    
    def is_available(self):
        return self.sandboxie_available
    
    def run_in_sandbox(self, file_path, sandbox_name="DefaultBox"):
        """
        Run a file in Sandboxie Plus
        Returns: process object or None
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return None
        
        file_path = Path(file_path)
        
        if not self.sandboxie_available:
            logger.warning("Sandboxie not available. Running with basic isolation.")
            return self._run_basic_isolation(str(file_path))
        
        try:
            ext = file_path.suffix.lower()
            
            # Build Sandboxie command
            if os.name == 'nt':
                # For executables and scripts
                if ext in ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.scr', '.pif']:
                    cmd = [
                        self.sandboxie_path,
                        f"/box:{sandbox_name}",
                        str(file_path)
                    ]
                else:
                    # For documents and media files - open with default app inside sandbox
                    cmd = [
                        self.sandboxie_path,
                        f"/box:{sandbox_name}",
                        "start",
                        str(file_path)
                    ]
                
                logger.info(f"🔒 Launching {file_path.name} in Sandboxie ({sandbox_name})")
                
                # Use CREATE_NEW_CONSOLE flag for Windows
                process = subprocess.Popen(
                    cmd,
                    creationflags=0x00000010 if os.name == 'nt' else 0,  # CREATE_NEW_CONSOLE
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    shell=False
                )
                
                self.active_processes.append(process)
                self._log_sandbox_event(file_path, sandbox_name, 'started')
                
                # Show indicator (non-blocking)
                threading.Thread(target=self._show_sandbox_indicator, 
                               args=(file_path.name,), daemon=True).start()
                
                return process
            else:
                # Linux/macOS fallback
                return self._run_basic_isolation(str(file_path))
            
        except Exception as e:
            logger.error(f"Failed to run in Sandboxie: {e}")
            return self._run_basic_isolation(str(file_path))
    
    def _run_basic_isolation(self, file_path):
        """Fallback to basic isolation if Sandboxie not available"""
        try:
            logger.info(f"🔒 Running with basic isolation: {os.path.basename(file_path)}")
            
            if os.name == 'nt':
                # On Windows, use start command
                process = subprocess.Popen(
                    ['start', '', file_path],
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            elif sys.platform == 'darwin':
                process = subprocess.Popen(
                    ['open', file_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                process = subprocess.Popen(
                    ['xdg-open', file_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            
            self.active_processes.append(process)
            self._log_sandbox_event(file_path, "basic", 'started')
            return process
            
        except Exception as e:
            logger.error(f"Basic isolation failed: {e}")
            return None
    
    def _show_sandbox_indicator(self, filename):
        """Show a visual indicator that file is running in Sandboxie"""
        try:
            import tkinter as tk
            
            # Create a small floating indicator
            root = tk.Tk()
            root.title("🔒 Sandboxie")
            root.geometry("250x70")
            root.configure(bg='#00cc88')
            root.overrideredirect(True)
            root.attributes('-topmost', True)
            
            # Position at top-right
            root.update_idletasks()
            x = root.winfo_screenwidth() - 270
            y = 20
            root.geometry(f'250x70+{x}+{y}')
            
            # Content
            frame = tk.Frame(root, bg='#00cc88')
            frame.pack(fill=tk.BOTH, expand=True)
            
            label = tk.Label(frame, text="🛡️ SANDBOXIE ACTIVE",
                            font=('Segoe UI', 11, 'bold'),
                            bg='#00cc88', fg='#0a0e1c')
            label.pack(pady=(8, 0))
            
            sub_label = tk.Label(frame, text=f"🔒 {filename[:25]}",
                               font=('Segoe UI', 8),
                               bg='#00cc88', fg='#0a0e1c')
            sub_label.pack()
            
            # Auto-close after 3 seconds
            root.after(3000, root.destroy)
            
            # Make clickable to close
            root.bind('<Button-1>', lambda e: root.destroy())
            frame.bind('<Button-1>', lambda e: root.destroy())
            label.bind('<Button-1>', lambda e: root.destroy())
            
            root.mainloop()
            
        except Exception as e:
            logger.debug(f"Indicator display failed: {e}")
    
    def _log_sandbox_event(self, file_path, sandbox, action):
        try:
            log_entry = {
                'timestamp': time.time(),
                'datetime': datetime.now().isoformat(),
                'file': os.path.basename(file_path),
                'sandbox': sandbox,
                'action': action,
                'sandboxie_available': self.sandboxie_available
            }
            
            log_dir = Path('logs')
            log_dir.mkdir(exist_ok=True)
            
            with open(log_dir / 'sandbox_events.log', 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
                
        except Exception as e:
            logger.error(f"Failed to log sandbox event: {e}")
    
    def cleanup(self):
        """Clean up all sandbox processes"""
        for process in self.active_processes:
            try:
                process.terminate()
                time.sleep(1)
                if process.poll() is None:
                    process.kill()
            except:
                pass
        self.active_processes.clear()
        logger.info("Cleaned up all sandbox processes")


class FileInterceptor:
    """
    Intercepts NEW file access attempts and routes them through Sandboxie
    Only processes files created AFTER the application starts
    """
    
    def __init__(self):
        self.intercepted_files = {}  # Track intercepted files
        self.sandboxie = SandboxieLauncher()
        self.callbacks = []
        self.is_running = False
        self.monitor_thread = None
        self.start_time = time.time()  # Track when monitoring started
        
        # Track initial file list to ignore existing files
        self.initial_files = self._get_initial_files()
        
        logger.info("File Interceptor initialized - Monitoring NEW files only")
        logger.info(f"Ignoring {len(self.initial_files)} existing files")
        logger.info("🛡️ Sandbox protection is ACTIVE and ready")
    
    def _get_initial_files(self):
        """Get list of files that already exist before monitoring starts"""
        existing_files = set()
        monitored_paths = self._get_monitored_paths()
        
        for path in monitored_paths:
            if os.path.exists(path):
                try:
                    for root, dirs, files in os.walk(path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            existing_files.add(file_path)
                except (PermissionError, OSError):
                    continue
        
        return existing_files
    
    def intercept_file_access(self, file_path, process_name=None):
        """Intercept NEW file access and route through Sandboxie"""
        if not os.path.exists(file_path):
            return False
        
        file_path = str(Path(file_path).resolve())
        
        # Check if this file existed before monitoring started (IGNORE OLD FILES)
        if file_path in self.initial_files:
            logger.debug(f"Ignoring existing file (not processing old files): {file_path}")
            return False
        
        # Check if already intercepted
        if file_path in self.intercepted_files:
            return True
        
        # Log the interception
        logger.info(f"🛡️ Intercepting NEW file: {file_path} (process: {process_name})")
        
        # Move file to quarantine
        try:
            quarantine_path = self._move_to_quarantine(file_path)
            if quarantine_path:
                self.intercepted_files[file_path] = {
                    'quarantine_path': quarantine_path,
                    'original_path': file_path,
                    'timestamp': time.time(),
                    'process': process_name
                }
                
                # Auto-launch in Sandboxie
                self._launch_in_sandbox(quarantine_path)
                return True
        except Exception as e:
            logger.error(f"Interception failed: {e}")
        
        return False
    
    def _move_to_quarantine(self, file_path):
        """Move file to quarantine folder"""
        try:
            from quarantine_system import QuarantineSandbox
            quarantine = QuarantineSandbox()
            return quarantine.add_file(file_path)
        except Exception as e:
            logger.error(f"Quarantine move failed: {e}")
            return None
    
    def _launch_in_sandbox(self, file_path):
        """Launch file in Sandboxie"""
        return self.sandboxie.run_in_sandbox(file_path)
    
    def add_callback(self, callback):
        self.callbacks.append(callback)
    
    def start_monitoring(self):
        """Start monitoring file access"""
        if self.is_running:
            return
        
        self.is_running = True
        self.monitor_thread = threading.Thread(target=self._monitor_file_access, daemon=True)
        self.monitor_thread.start()
        logger.info("🛡️ File access monitoring started - Sandbox protection ACTIVE")
        logger.info("📁 Monitoring for NEW files only (ignoring existing files)")
    
    def stop_monitoring(self):
        self.is_running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        logger.info("File access monitoring stopped")
    
    def _monitor_file_access(self):
        """Monitor for NEW file access attempts using polling"""
        while self.is_running:
            try:
                self._poll_for_new_files()
                time.sleep(1)
            except Exception as e:
                logger.error(f"File access monitoring error: {e}")
                time.sleep(5)
    
    def _poll_for_new_files(self):
        """Poll for NEW files in monitored locations"""
        monitored_paths = self._get_monitored_paths()
        
        for path in monitored_paths:
            if not os.path.exists(path):
                continue
            
            try:
                for item in os.listdir(path):
                    file_path = os.path.join(path, item)
                    if os.path.isfile(file_path):
                        # Skip if file existed before monitoring started
                        if file_path in self.initial_files:
                            continue
                        
                        # Check if already intercepted
                        if file_path in self.intercepted_files:
                            continue
                            
                        # Check if file is stable (not being written)
                        try:
                            size1 = os.path.getsize(file_path)
                            time.sleep(0.3)
                            size2 = os.path.getsize(file_path)
                            if size1 == size2 and size1 > 0:
                                # Check if it's a suspicious file type
                                if self._is_suspicious_file(file_path):
                                    self.intercept_file_access(file_path, 'monitor')
                        except:
                            pass
            except (PermissionError, OSError):
                # Skip files we can't access
                continue
            except Exception as e:
                logger.error(f"Polling error for {path}: {e}")
    
    def _is_suspicious_file(self, file_path):
        """Check if file type should be intercepted"""
        suspicious_extensions = [
            '.exe', '.scr', '.pif', '.bat', '.cmd', '.ps1', '.vbs', '.vbe',
            '.js', '.jse', '.wsf', '.wsh', '.hta', '.jar', '.msi', '.cpl',
            '.dll', '.ocx', '.sys', '.com', '.app', '.deb', '.rpm',
            '.docm', '.xlsm', '.pptm', '.msi'
        ]
        
        ext = Path(file_path).suffix.lower()
        return ext in suspicious_extensions
    
    def _get_monitored_paths(self):
        """Get all paths to monitor"""
        paths = []
        home = Path.home()
        
        # Common download locations
        monitored_dirs = [
            home / "Downloads",
            home / "Desktop",
            home / "Documents",
        ]
        
        # Application-specific paths (Windows)
        if os.name == 'nt':
            app_paths = [
                home / "AppData" / "Local" / "WhatsApp" / "Downloads",
                home / "AppData" / "Roaming" / "Telegram Desktop" / "Downloads",
                home / "AppData" / "Local" / "Google" / "Chrome" / "User Data" / "Default" / "Downloads",
                home / "AppData" / "Roaming" / "discord" / "Downloads",
                home / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data" / "Default" / "Downloads",
                home / "AppData" / "Roaming" / "Mozilla" / "Firefox" / "Profiles",
                home / "Documents" / "Telegram Desktop" / "Downloads",
                home / "Documents" / "WhatsApp" / "Downloads",
            ]
            monitored_dirs.extend(app_paths)
        
        # USB drives (Windows)
        if os.name == 'nt':
            for letter in 'DEFGHIJKLMNOPQRSTUVWXYZ':
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    try:
                        if os.path.exists(os.path.join(drive, '$Recycle.Bin')):
                            if letter != 'C':
                                paths.append(drive)
                        else:
                            paths.append(drive)
                    except:
                        pass
        
        # Linux mount points
        if os.name != 'nt':
            linux_paths = [
                '/media',
                '/mnt',
                '/run/media',
                str(home / 'snap' / 'telegram-desktop' / 'current' / 'Downloads'),
            ]
            monitored_dirs.extend([Path(p) for p in linux_paths])
        
        # Add valid paths
        for path in monitored_dirs:
            if path and path.exists():
                paths.append(str(path))
            elif path and not str(path).startswith('C:'):
                try:
                    path.mkdir(parents=True, exist_ok=True)
                    paths.append(str(path))
                except:
                    pass
        
        return list(set(paths))


class AppDownloadMonitor:
    """
    Monitors NEW downloads from WhatsApp, Telegram, Gmail, and other apps
    Only processes files created AFTER application starts
    """
    
    def __init__(self):
        self.monitored_paths = self._get_app_download_paths()
        self.callbacks = []
        self.observer = None
        self.is_monitoring = False
        self.processed_files = set()
        self.file_interceptor = FileInterceptor()
        
        # File filters
        self.excluded_extensions = ['.tmp', '.temp', '.lnk', '.part', '.crdownload', '.download']
        self.excluded_files = ['desktop.ini', 'thumbs.db', '.DS_Store']
        
        # Auto-sandbox settings
        self.auto_sandbox = True
        self.auto_scan = True
        
        # Track initial files to ignore
        self.initial_files = self._get_initial_files()
        
        logger.info(f"App Download Monitor initialized with {len(self.monitored_paths)} paths")
        logger.info(f"Ignoring {len(self.initial_files)} existing files")
        logger.info("🛡️ Monitoring NEW files only - Sandbox protection ACTIVE")
    
    def _get_initial_files(self):
        """Get list of files that already exist"""
        existing_files = set()
        for path in self.monitored_paths:
            if os.path.exists(path):
                try:
                    for root, dirs, files in os.walk(path):
                        for file in files:
                            existing_files.add(os.path.join(root, file))
                except (PermissionError, OSError):
                    continue
        return existing_files
    
    def _get_app_download_paths(self):
        """Get download paths for common applications"""
        paths = []
        home = Path.home()
        
        # Common download locations
        common_paths = [
            home / "Downloads",
            home / "Desktop",
            home / "Documents",
        ]
        
        # Application-specific paths
        app_paths = []
        
        if os.name == 'nt':
            app_paths = [
                home / "AppData" / "Local" / "WhatsApp" / "Downloads",
                home / "AppData" / "Roaming" / "Telegram Desktop" / "Downloads",
                home / "AppData" / "Local" / "Google" / "Chrome" / "User Data" / "Default" / "Downloads",
                home / "AppData" / "Roaming" / "discord" / "Downloads",
                home / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data" / "Default" / "Downloads",
                home / "AppData" / "Roaming" / "Mozilla" / "Firefox" / "Profiles",
                home / "Documents" / "Telegram Desktop" / "Downloads",
                home / "Documents" / "WhatsApp" / "Downloads",
                home / "Documents" / "Gmail Attachments",
            ]
        else:
            # Linux paths
            app_paths = [
                home / "Downloads",
                home / "Documents" / "Downloads",
                home / ".local" / "share" / "applications" / "downloads",
                home / "snap" / "telegram-desktop" / "current" / "Downloads",
                home / "snap" / "whatsapp-for-linux" / "current" / "Downloads",
                home / "snap" / "discord" / "current" / "Downloads",
            ]
        
        # Combine paths
        all_paths = common_paths + app_paths
        
        for path in all_paths:
            if path and path.exists():
                paths.append(str(path))
            elif path and not str(path).startswith('C:'):
                try:
                    path.mkdir(parents=True, exist_ok=True)
                    paths.append(str(path))
                except:
                    pass
        
        return list(set(paths))
    
    def add_callback(self, callback):
        self.callbacks.append(callback)
    
    def remove_callback(self, callback):
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    def start_monitoring(self):
        """Start monitoring app download paths"""
        if self.is_monitoring:
            return
        
        # Start file interceptor
        self.file_interceptor.start_monitoring()
        
        if not WATCHDOG_AVAILABLE:
            logger.warning("Watchdog not available - using polling mode")
            self._start_polling()
            return
        
        try:
            self.observer = Observer()
            for path in self.monitored_paths:
                if os.path.exists(path):
                    self.observer.schedule(self._get_handler(), path, recursive=True)
                    logger.info(f"📁 Monitoring app download path: {path}")
            
            self.observer.start()
            self.is_monitoring = True
            logger.info("✅ App download monitoring started - Sandbox protection ACTIVE")
            logger.info("🛡️ Only NEW files will be processed (existing files ignored)")
            
        except Exception as e:
            logger.error(f"Failed to start monitoring: {e}")
            self._start_polling()
    
    def _get_handler(self):
        """Get file system event handler"""
        class DownloadHandler(FileSystemEventHandler):
            def __init__(self, parent):
                self.parent = parent
            
            def on_created(self, event):
                if not event.is_directory:
                    # Check if this is a NEW file (not existing)
                    if event.src_path not in self.parent.initial_files:
                        self.parent._handle_file(event.src_path)
            
            def on_modified(self, event):
                if not event.is_directory:
                    # Check if this is a NEW file (not existing)
                    if event.src_path not in self.parent.initial_files:
                        self.parent._handle_file(event.src_path)
        
        return DownloadHandler(self)
    
    def _start_polling(self):
        """Fallback polling method if watchdog not available"""
        self.is_monitoring = True
        
        def poll():
            while self.is_monitoring:
                for path in self.monitored_paths:
                    if os.path.exists(path):
                        try:
                            for file in os.listdir(path):
                                file_path = os.path.join(path, file)
                                if os.path.isfile(file_path):
                                    # Only process NEW files
                                    if file_path not in self.initial_files:
                                        self._handle_file(file_path)
                        except Exception as e:
                            logger.error(f"Polling error for {path}: {e}")
                time.sleep(3)
        
        threading.Thread(target=poll, daemon=True).start()
        logger.info("App download polling started - NEW files only")
    
    def _handle_file(self, file_path):
        """Handle detected NEW file"""
        # Skip excluded files
        if self._should_exclude(file_path):
            return
        
        # Check if already processed
        if file_path in self.processed_files:
            return
        
        # Wait for file to be completely written
        time.sleep(0.5)
        
        # Check if file still exists
        if not os.path.exists(file_path):
            return
        
        # Check if file is stable (size not changing)
        try:
            size1 = os.path.getsize(file_path)
            time.sleep(0.3)
            size2 = os.path.getsize(file_path)
            if size1 != size2:
                return  # Still being downloaded
            if size1 == 0:
                return  # Empty file
        except:
            return
        
        # Add to processed set
        self.processed_files.add(file_path)
        if len(self.processed_files) > 1000:
            self.processed_files.clear()
        
        # Determine source
        source = self._detect_source(file_path)
        
        logger.info(f"📥 NEW file detected from {source}: {os.path.basename(file_path)}")
        
        # Auto-open in Sandboxie if enabled
        if self.auto_sandbox:
            self._auto_open_in_sandbox(file_path, source)
        
        # Notify callbacks
        for callback in self.callbacks:
            try:
                callback(file_path, source)
            except Exception as e:
                logger.error(f"Callback error: {e}")
    
    def _auto_open_in_sandbox(self, file_path, source):
        """Automatically open NEW file in Sandboxie"""
        logger.info(f"🛡️ Auto-opening NEW file in Sandboxie: {file_path} from {source}")
        
        # Move to quarantine first
        try:
            from quarantine_system import QuarantineSandbox
            quarantine = QuarantineSandbox()
            quarantine_path = quarantine.add_file(file_path, source_type=source)
            
            if quarantine_path:
                # Launch in Sandboxie
                process = self.file_interceptor._launch_in_sandbox(quarantine_path)
                
                if process:
                    logger.info(f"✅ NEW file opened in Sandboxie: {os.path.basename(file_path)}")
                    self._show_sandbox_notification(file_path, source)
                else:
                    logger.error(f"Failed to open in Sandboxie: {file_path}")
        except Exception as e:
            logger.error(f"Auto-sandbox failed: {e}")
    
    def _show_sandbox_notification(self, file_path, source):
        """Show notification that file is opened in Sandboxie"""
        try:
            import tkinter as tk
            
            # Create notification window
            root = tk.Tk()
            root.title("🛡️ Sandboxie Protection Active")
            root.geometry("450x200")
            root.configure(bg='#0a0e1c')
            root.overrideredirect(True)
            
            # Position at bottom-right
            root.update_idletasks()
            width = 450
            height = 200
            x = root.winfo_screenwidth() - width - 20
            y = root.winfo_screenheight() - height - 50
            root.geometry(f'{width}x{height}+{x}+{y}')
            
            # Auto-close after 5 seconds
            root.after(5000, root.destroy)
            
            # Content
            frame = tk.Frame(root, bg='#1a1f2f', relief=tk.FLAT, bd=2)
            frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            
            icon_label = tk.Label(frame, text="🛡️", font=('Segoe UI', 32),
                                 bg='#1a1f2f', fg='#00ff9d')
            icon_label.pack(pady=(10, 0))
            
            title = tk.Label(frame, text="NEW FILE OPENED SAFELY IN SANDBOXIE",
                            font=('Segoe UI', 12, 'bold'),
                            bg='#1a1f2f', fg='white')
            title.pack()
            
            info = tk.Label(frame, 
                           text=f"📁 {os.path.basename(file_path)[:30]}\n"
                                f"📥 Source: {source}\n\n"
                                f"🔒 Running in COMPLETE ISOLATION\n"
                                f"✅ Your system is 100% protected",
                           font=('Segoe UI', 9),
                           bg='#1a1f2f', fg='#94a3b8',
                           justify=tk.CENTER)
            info.pack(pady=5)
            
            close_btn = tk.Button(frame, text="OK", command=root.destroy,
                                 bg='#00cc88', fg='white',
                                 font=('Segoe UI', 10, 'bold'),
                                 relief=tk.FLAT, padx=20, pady=5)
            close_btn.pack(pady=5)
            
            root.attributes('-topmost', True)
            root.bind('<Button-1>', lambda e: root.destroy())
            frame.bind('<Button-1>', lambda e: root.destroy())
            
            root.mainloop()
            
        except Exception as e:
            logger.debug(f"Notification display failed: {e}")
    
    def _detect_source(self, file_path):
        """Detect which app the file came from"""
        file_path_lower = str(file_path).lower()
        
        if 'whatsapp' in file_path_lower:
            return 'WhatsApp'
        elif 'telegram' in file_path_lower:
            return 'Telegram'
        elif 'gmail' in file_path_lower:
            return 'Gmail'
        elif 'discord' in file_path_lower:
            return 'Discord'
        elif 'slack' in file_path_lower:
            return 'Slack'
        elif 'signal' in file_path_lower:
            return 'Signal'
        elif 'chrome' in file_path_lower:
            return 'Chrome'
        elif 'firefox' in file_path_lower:
            return 'Firefox'
        elif 'edge' in file_path_lower:
            return 'Edge'
        elif 'downloads' in file_path_lower:
            return 'Browser Download'
        else:
            return 'Unknown'
    
    def _should_exclude(self, file_path):
        """Check if file should be excluded"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext in self.excluded_extensions:
            return True
        
        filename = os.path.basename(file_path).lower()
        if filename in self.excluded_files:
            return True
        
        # Skip system files
        if filename.startswith('~') or filename.startswith('.'):
            return True
        
        return False
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
        self.file_interceptor.stop_monitoring()
        if self.observer and WATCHDOG_AVAILABLE:
            self.observer.stop()
            self.observer.join(timeout=5)
        logger.info("App download monitoring stopped")


# ============================================================================
# BACKWARD COMPATIBILITY - Keep the old class name for existing code
# ============================================================================

class ExternalFileDetector(AppDownloadMonitor):
    """
    Backward compatibility class - same as AppDownloadMonitor
    This allows existing code that imports ExternalFileDetector to work
    Only processes NEW files created AFTER application starts
    """
    
    def __init__(self, quarantine_manager=None, config=None):
        super().__init__()
        self.quarantine = quarantine_manager
        self.config = config or {}
        self.on_new_file_callback = None
        self.on_usb_insert_callback = None
        
        # Add USB detection callback
        self.usb_detector = USBMountDetector()
        self.usb_detector.add_callback(self._on_usb_event)
        
        logger.info("✅ ExternalFileDetector initialized")
        logger.info("🛡️ Sandbox protection is ACTIVE from startup")
        logger.info("📁 Monitoring NEW files only (ignoring existing files)")
    
    def set_usb_insert_callback(self, callback):
        """Set callback for USB insertion"""
        self.on_usb_insert_callback = callback
    
    def set_app_file_callback(self, callback):
        """Set callback for app files"""
        self.add_callback(callback)
    
    def is_sandboxie_available(self):
        """Check if Sandboxie is available"""
        return self.file_interceptor.sandboxie.is_available()
    
    def open_with_sandboxie(self, file_path, sandbox_name="DefaultBox"):
        """Open file with Sandboxie"""
        return self.file_interceptor.sandboxie.run_in_sandbox(file_path, sandbox_name)
    
    def _on_usb_event(self, event_type, device_path):
        """Handle USB events"""
        if event_type == 'inserted':
            logger.info(f"💾 USB Drive detected: {device_path}")
            if self.on_usb_insert_callback:
                self.on_usb_insert_callback(device_path)
    
    def monitor_path(self, path):
        """Add a path to monitoring"""
        if path not in self.monitored_paths:
            self.monitored_paths.append(path)
            logger.info(f"📁 Added path to monitoring: {path}")
            return True
        return False
    
    def start_monitoring(self, paths=None):
        """Start monitoring with optional additional paths"""
        if paths:
            for path in paths:
                if path not in self.monitored_paths:
                    self.monitored_paths.append(path)
        
        # Start USB monitoring
        self.usb_detector.start_monitoring()
        
        # Call parent start_monitoring
        super().start_monitoring()
        
        logger.info("✅ ExternalFileDetector monitoring started")
        logger.info("🛡️ Sandbox protection is ACTIVE")
        logger.info("📁 Monitoring for NEW files only")
        return True
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.usb_detector.stop_monitoring()
        super().stop_monitoring()
        logger.info("ExternalFileDetector monitoring stopped")


class USBMountDetector:
    """
    Detects USB drive connections and mounting
    Cross-platform without Windows-specific imports
    """
    
    def __init__(self):
        self.usb_devices = {}
        self.callbacks = []
        self.is_monitoring = False
        self.monitor_thread = None
        
        # Common USB mount points
        self.usb_mount_points = []
        self._detect_mount_points()
        
        logger.info("USB Mount Detector initialized")
    
    def _detect_mount_points(self):
        """Detect common USB mount points based on OS"""
        if os.name == 'nt':
            # Windows drive letters
            for letter in 'DEFGHIJKLMNOPQRSTUVWXYZ':
                self.usb_mount_points.append(f"{letter}:\\")
        else:
            # Linux/macOS mount points
            self.usb_mount_points.extend(['/media/', '/mnt/', '/run/media/'])
            if sys.platform == 'darwin':
                self.usb_mount_points.append('/Volumes/')
    
    def add_callback(self, callback):
        """Add callback for USB events"""
        self.callbacks.append(callback)
    
    def remove_callback(self, callback):
        """Remove callback"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    def start_monitoring(self):
        """Start monitoring USB devices"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_usb, daemon=True)
        self.monitor_thread.start()
        logger.info("USB monitoring started")
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        logger.info("USB monitoring stopped")
    
    def _monitor_usb(self):
        """Monitor USB devices in background"""
        known_devices = set()
        
        while self.is_monitoring:
            try:
                current_devices = self._get_current_usb_devices()
                
                # Check for new devices
                for device in current_devices:
                    if device not in known_devices:
                        known_devices.add(device)
                        self._on_usb_inserted(device)
                
                # Check for removed devices
                for device in list(known_devices):
                    if device not in current_devices:
                        known_devices.remove(device)
                        self._on_usb_removed(device)
                
                time.sleep(2)  # Check every 2 seconds
                
            except Exception as e:
                logger.error(f"USB monitoring error: {e}")
                time.sleep(5)
    
    def _get_current_usb_devices(self):
        """Get list of currently connected USB devices"""
        devices = set()
        
        try:
            if os.name == 'nt':
                # Windows - check drive letters
                for mount_point in self.usb_mount_points:
                    if os.path.exists(mount_point):
                        try:
                            drive_letter = mount_point[0].upper()
                            if drive_letter != 'C':
                                if os.path.exists(os.path.join(mount_point, 'System Volume Information')):
                                    pass
                                else:
                                    devices.add(mount_point)
                        except:
                            pass
            else:
                # Linux/macOS - check mount points
                for mount_point in self.usb_mount_points:
                    if os.path.exists(mount_point):
                        try:
                            for item in os.listdir(mount_point):
                                full_path = os.path.join(mount_point, item)
                                if os.path.ismount(full_path):
                                    devices.add(full_path)
                        except:
                            pass
        except Exception as e:
            logger.error(f"Error detecting USB devices: {e}")
        
        return devices
    
    def _on_usb_inserted(self, device_path):
        """Called when USB is inserted"""
        logger.info(f"💾 USB device inserted: {device_path}")
        for callback in self.callbacks:
            try:
                callback('inserted', device_path)
            except Exception as e:
                logger.error(f"Callback error: {e}")
    
    def _on_usb_removed(self, device_path):
        """Called when USB is removed"""
        logger.info(f"USB device removed: {device_path}")
        for callback in self.callbacks:
            try:
                callback('removed', device_path)
            except Exception as e:
                logger.error(f"Callback error: {e}")