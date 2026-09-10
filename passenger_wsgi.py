import os
import sys
import traceback

# 1. Ensure backend directory and root directory are in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, 'backend')

if backend_dir not in sys.path and os.path.exists(backend_dir):
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(1, root_dir)

# 2. Load .env file automatically
for possible_env in [os.path.join(backend_dir, '.env'), os.path.join(root_dir, '.env')]:
    if os.path.exists(possible_env):
        try:
            from dotenv import load_dotenv
            load_dotenv(possible_env)
            break
        except Exception:
            pass

# 3. Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# 4. Safe WSGI application initialization with error trapping
try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception as e:
    err_msg = traceback.format_exc()
    log_file = os.path.join(root_dir, 'passenger_wsgi_error.log')
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n--- WSGI Startup Error ---\n{err_msg}\n")
    except Exception:
        pass

    def application(environ, start_response):
        status = '500 Internal Server Error'
        output = f"""
        <html>
        <head><title>cPanel Django Startup Error</title></head>
        <body style="font-family: monospace; padding: 2rem; background: #0f172a; color: #f8fafc;">
            <h2 style="color: #ef4444;">⚠️ Django Backend Startup Exception</h2>
            <p>An error occurred while initializing Django under Phusion Passenger on cPanel.</p>
            <p>Check <code>passenger_wsgi_error.log</code> for details or review the traceback below:</p>
            <pre style="background: #1e293b; padding: 1.5rem; border-radius: 8px; border: 1px solid #334155; overflow: auto; color: #fca5a5;">{err_msg}</pre>
        </body>
        </html>
        """.encode('utf-8')
        response_headers = [
            ('Content-type', 'text/html; charset=utf-8'),
            ('Content-Length', str(len(output)))
        ]
        start_response(status, response_headers)
        return [output]
