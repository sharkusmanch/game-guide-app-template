#!/usr/bin/env python3
"""Validate literal settings before writing the ephemeral Nginx configuration."""
import os
import pathlib
import re
import sys


def safe_prefix(value):
    return bool(re.fullmatch(r'/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+', value)) and all(p not in ('.', '..') for p in value.split('/')[1:])


def safe_file(value):
    # Quoted Nginx literals need no escaping when quotes, variables and escapes
    # are excluded. Normal filename punctuation remains literal, including #.
    return value.startswith('/') and all(part not in ('', '.', '..') for part in value.split('/')[1:]) and all(c.isprintable() and c not in '\\"\'`$;{}' for c in value)


def configuration(env, static_root=pathlib.Path('/srv/www')):
    save = env.get('SAVE_FILE', '/saves/unconfigured.bin')
    prefix = env.get('PROGRESS_PREFIX', '/companion')
    upstream = env.get('PROGRESS_UPSTREAM', '')
    raw_ids = env.get('PROGRESS_IDS', '')
    if not safe_file(save):
        raise ValueError('SAVE_FILE must be an absolute literal file path without traversal, quotes, escapes or directive syntax')
    if not safe_prefix(prefix):
        raise ValueError('PROGRESS_PREFIX must be a safe absolute URL path without traversal')
    if upstream:
        match = re.fullmatch(r'([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?):([0-9]{1,5})', upstream)
        if not match or not 1 <= int(match[2]) <= 65535 or '..' in match[1]:
            raise ValueError('PROGRESS_UPSTREAM must be a DNS hostname or IPv4 address and port 1..65535')
    ids = raw_ids.split(',') if raw_ids else []
    if len(ids) > 32 or len(set(ids)) != len(ids) or any(not re.fullmatch(r'[1-9][0-9]{0,9}', i) or int(i) > 2147483647 for i in ids):
        raise ValueError('PROGRESS_IDS must contain at most 32 unique positive integer IDs')
    if ids and not upstream:
        raise ValueError('PROGRESS_UPSTREAM is required when PROGRESS_IDS is nonempty')
    # Reject route collisions before producing any config or making DNS requests.
    if prefix.startswith('/save') or prefix.split('/')[1] in ('healthz', 'assets', 'index.html') or (static_root / prefix.split('/')[1]).exists():
        raise ValueError('PROGRESS_PREFIX conflicts with a reserved route')
    routes = '\n'.join(f'''location = {prefix}/api/achievements/ra/{i} {{
      proxy_pass http://{upstream}{prefix}/api/achievements/ra/{i};
      proxy_pass_request_headers off;
      proxy_pass_request_body off;
      proxy_set_header Host {upstream};
      proxy_set_header Content-Length "";
      proxy_connect_timeout 3s;
      proxy_read_timeout 5s;
      add_header Cache-Control "no-store" always;
    }}''' for i in ids)
    return f'''pid /tmp/nginx.pid;
error_log /dev/stderr warn;
worker_processes auto;
events {{ worker_connections 128; }}
http {{
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /dev/stdout;
  client_body_temp_path /tmp/client;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  server {{
    listen 8080;
    server_tokens off;
    root /srv/www;
    if ($request_method !~ ^(GET|HEAD)$) {{ return 405; }}
    location = /healthz {{ default_type text/plain; return 200 "ok\\n"; }}
    location = /save {{
      alias "{save}";
      types {{ }}
      default_type application/octet-stream;
      disable_symlinks on;
      add_header Cache-Control "no-store" always;
      add_header X-Content-Type-Options nosniff always;
    }}
    location ^~ /save/ {{ return 404; }}
    location /save {{ return 404; }}
    {routes}
    location = {prefix} {{ return 404; }}
    location ^~ {prefix}/ {{ return 404; }}
    location ^~ /assets/ {{ try_files $uri =404; }}
    location / {{ try_files $uri $uri/ /index.html; }}
  }}
}}
'''


if __name__ == '__main__':
    try:
        config = configuration(os.environ)
    except ValueError as exc:
        sys.exit(f'Invalid runtime configuration: {exc}')
    pathlib.Path('/tmp/nginx.conf').write_text(config)
    os.execvp('nginx', ['nginx', '-c', '/tmp/nginx.conf', '-g', 'daemon off;'])
