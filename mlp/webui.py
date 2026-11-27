"""

Copyright::
    +===================================================+
    |                 © 2019 Privex Inc.                |
    |               https://www.privex.io               |
    +===================================================+
    |                                                   |
    |        Postfix Log Parser / Web UI                |
    |                                                   |
    |        Core Developer(s):                         |
    |                                                   |
    |          (+)  Chris (@someguy123) [Privex]        |
    |                                                   |
    +===================================================+

"""
import asyncio
import fcntl
import hmac
import json
import os.path
import platform
import socket
import sys
import urllib.request
from dataclasses import dataclass, field
from datetime import timedelta, timezone
from typing import List, Union, Mapping, Tuple

import rethinkdb.query
import logging

from rethinkdb.net import DefaultConnection

from werkzeug.security import check_password_hash, generate_password_hash

from mlp.main import VERSION
from mlp import settings, api

from mlp.exceptions import APIException
from mlp.core import get_rethink, __STORE
from quart import Quart, session, redirect, render_template, request, jsonify
from privex.helpers import random_str, empty, filter_form, DictDataClass, DictObject

import moment
import ldap
from ldap.filter import escape_filter_chars
import time

log = logging.getLogger(__name__)

app = Quart(__name__)

# add path prefix
PREFIX = settings.path_prefix
PARSER_LOCK = '/tmp/lck_mlp'
LICENSE_PRODUCT = 'MTA Log Parser'
LICENSE_USER_AGENT = f'{LICENSE_PRODUCT} {VERSION} ({socket.gethostname()}/{platform.machine()}/{platform.system()})'
_DONATE_LICENSE_CACHE = {'ts': 0.0, 'valid': False, 'token': ''}
new_static_path = PREFIX+"/static"
app.static_url_path = new_static_path

# version to static files (file mtime busts browser caches on every change)
@app.template_filter('version')
def version_filter(filename):
    try:
        version = int(os.path.getmtime(os.path.join(app.static_folder, filename)))
    except (OSError, TypeError):
        version = VERSION
    return f"{filename}?v={version}"

app.url_map._rules_by_endpoint['static'] = []

app.add_url_rule(f'{new_static_path}/<path:filename>',
                 endpoint='static',
                 view_func=app.send_static_file)

app.secret_key = settings.secret_key
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=365)

if settings.insecure_secret_key:
    _secret_msg = 'SECRET_KEY is unset or uses a default value. Set a strong random SECRET_KEY in your environment.'
    if settings.DEBUG:
        log.warning(_secret_msg)
    else:
        log.critical(_secret_msg)
        raise RuntimeError(_secret_msg)

Table = rethinkdb.query.ast.Table
RqlQuery = rethinkdb.query.ast.RqlQuery
QueryOrTable = Union[Table, RqlQuery]


@app.route(f'{PREFIX}/', methods=['GET'])
async def index():
    NOTIE_MESSAGE = await _process_notie()

    if 'admin' in session:
        return redirect(f'{PREFIX}/emails')

    # check if LDAP is configured
    if not settings.ldap_connect:
        # check if there users registered
        auth_status = await check_user_pass(None, None, 0)

        if auth_status == 1:
            return await render_template('login.html', settings=settings, NOTIE_MESSAGE=NOTIE_MESSAGE, VERSION=VERSION)
        elif auth_status == 0:
            session['NOTIE_MESSAGE'] = "no_users_found"
            return await render_template('register.html', settings=settings, NOTIE_MESSAGE=NOTIE_MESSAGE, VERSION=VERSION)
    else:
        return await render_template('login.html', settings=settings, NOTIE_MESSAGE=NOTIE_MESSAGE, VERSION=VERSION)
    

@app.route(f'{PREFIX}/register', methods=['POST'])
async def register():

    frm = await request.form
    login_name = (frm.get('login') or '').strip()
    password = frm.get('password') or ''
    password2 = frm.get('password2') or ''
    act_type = frm.get('act_type')
    is_admin = 'admin' in session

    # Local account management is disabled when LDAP is used for authentication
    if settings.ldap_connect:
        session['NOTIE_MESSAGE'] = "unauth_ldap" if is_admin else "unauth"
        return redirect(f'{PREFIX}/emails' if is_admin else f'{PREFIX}/')

    if is_admin:
        auth_response = await _require_auth()
        if auth_response:
            return auth_response
    # Anonymous visitors may only create the very first user
    elif act_type == 'delete' or await check_user_pass(None, None, 0) == 1:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    redirect_to = f'{PREFIX}/auth' if is_admin else f'{PREFIX}/'

    if not login_name or (act_type != 'delete' and not password):
        session['NOTIE_MESSAGE'] = "user_creation_error"
        return redirect(redirect_to)
    if act_type != 'delete' and password != password2:
        session['NOTIE_MESSAGE'] = "user_creation_error"
        return redirect(redirect_to)

    if act_type == "delete":
        status = await edit_user(login_name, password, 1)
    else:
        status = await edit_user(login_name, password, 0)

    if status.get('inserted'):
        session['NOTIE_MESSAGE'] = "user_created"
    elif status.get('unchanged') or status.get('replaced'):
        session['NOTIE_MESSAGE'] = "user_edited"
    elif status.get('deleted'):
        session['NOTIE_MESSAGE'] = "user_deleted"
        if await check_user_pass(None, None, 0) == 0:
            log.info("No users left, logging out")
            session['NOTIE_MESSAGE'] = "no_users_found"
            return redirect(f'{PREFIX}/logout')
    else:
        session['NOTIE_MESSAGE'] = "user_creation_error"

    if act_type is None:
        return redirect(f'{PREFIX}/')

    return redirect(f'{PREFIX}/auth')

@app.route(f'{PREFIX}/login', methods=['POST'])
async def login():

    frm = await request.form
    if not settings.ldap_connect:
        auth_status = await check_user_pass(frm.get('login'), frm.get('password'), 1)
    else:
        auth_status = await ldap_auth(frm.get('login'), frm.get('password'), 1)

    if auth_status == 1:
        session.clear()
        session.permanent = bool(frm.get('remember'))
        session['login'] = frm.get('login')
        session['admin'] = random_str()
        return redirect(f'{PREFIX}/emails')
    elif auth_status == 0:
        session['NOTIE_MESSAGE'] = "pass_error"
    elif auth_status == 2:
        session['NOTIE_MESSAGE'] = "bind_pass_error"
    elif auth_status == 3:
        session['NOTIE_MESSAGE'] = "no_ldap_users_found"
    elif auth_status == 4:
        session['NOTIE_MESSAGE'] = "other_ldap_error"

    return redirect(f'{PREFIX}/')


@app.route(f'{PREFIX}/emails', methods=['GET'])
@app.route(f'{PREFIX}/emails/', methods=['GET'])
async def emails_ui():

    # to save args from shared link
    ARGS = ''
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        session['args'] = request.url
        return redirect(f'{PREFIX}/')

    if 'args' in session:
        ARGS = session['args']
        del session['args']

    NOTIE_MESSAGE = await _process_notie()

    auth_response = await _require_auth()
    if auth_response:
        return auth_response

    return await render_template('emails.html', VUE_DEBUG=settings.vue_debug, NOTIE_MESSAGE=NOTIE_MESSAGE, ARGS=ARGS, settings=settings, VERSION=VERSION, LOGIN=session['login'])


def _parser_running():
    try:
        with open(PARSER_LOCK, 'a') as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                return True
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    except OSError:
        return False
    return False


@app.route(f'{PREFIX}/api/process_check', methods=['GET'])
@app.route(f'{PREFIX}/api/process_check/', methods=['GET'])
async def process_check():
    return {'processing': bool(_parser_running())}

@app.route(f'{PREFIX}/auth', methods=['GET'])
@app.route(f'{PREFIX}/auth/', methods=['GET'])
async def auth_ui():

    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    NOTIE_MESSAGE = await _process_notie()

    if settings.ldap_connect:
        session['NOTIE_MESSAGE'] = "unauth_ldap"
        return redirect(f'{PREFIX}/emails')

    auth_response = await _require_auth()
    if auth_response:
        return auth_response

    return await render_template('edit.html', VUE_DEBUG=settings.vue_debug, NOTIE_MESSAGE=NOTIE_MESSAGE, settings=settings, VERSION=VERSION, LOGIN=session['login'])


@app.route(f'{PREFIX}/logout', methods=['GET'])
async def logout():
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    session.pop('admin', None)
    session.pop('login', None)
    session.permanent = False
    if 'NOTIE_MESSAGE' not in session:
        session['NOTIE_MESSAGE'] = "logged_out"
        
    return redirect(f'{PREFIX}/')


@dataclass
class PageResult(DictDataClass):
    result: Union[list, dict, str, int, float] = field(default_factory=list)
    error: bool = False
    error_code: str = None
    count: int = 0
    remaining: int = 0
    page: int = 1
    total_pages: int = 1
    message: List[str] = field(default_factory=list)
    messages: List[str] = field(default_factory=list)
    
    raw_data: Union[dict, DictObject] = field(default_factory=DictObject, repr=False)
    # ^ The raw, unmodified data that was passed as kwargs, as a dictionary
    
    def to_json_dict(self) -> dict:
        d = dict(self)
        
        if not d['error']:
            if 'error_code' in d and empty(d['error_code'], True, True):
                del d['error_code']
            if 'messages' in d and empty(d['messages'], True, True):
                del d['messages']
            if 'message' in d and empty(d['message'], True, True):
                del d['message']
        
        return d
    
    def to_json(self, indent=4, **kwargs) -> str:
        return json.dumps(self.to_json_dict(), indent=indent, **kwargs)


@app.route(f'{PREFIX}/api/auth', methods=['GET'])
async def api_auth():
    if 'admin' not in session or settings.ldap_connect:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    auth_response = await _require_auth()
    if auth_response:
        return auth_response

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    # Password hashes must never leave the server
    query = r.table('auth').pluck('id')
    result = await query.run(conn, array_limit=settings.rethink_arr_limit)

    if isinstance(result, list):
        accounts = [dict(s) for s in result]
    else:
        accounts = [dict(s) async for s in result]

    return jsonify(accounts)


@app.route(f'{PREFIX}/api/parse', methods=['POST'])
async def api_parse():
    if 'admin' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    if await _require_auth():
        return jsonify({'error': 'unauthorized'}), 401

    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    try:
        proc = await asyncio.create_subprocess_exec(
            'flock', '-n', PARSER_LOCK, sys.executable, 'manage.py', 'parse',
            cwd=project_dir,
        )
    except Exception:
        log.exception('Failed to start parser process')
        return jsonify({'error': 'failed'}), 500

    try:
        await asyncio.wait_for(proc.wait(), timeout=50)
    except asyncio.TimeoutError:
        return jsonify({'status': 'started'})

    if proc.returncode == 1:
        return jsonify({'error': 'busy'}), 409
    if proc.returncode != 0:
        return jsonify({'error': 'failed'}), 500
    return jsonify({'status': 'finished'})


def _parse_done_marker():
    try:
        with open(settings.parse_done_file, 'r') as marker:
            return marker.read().strip()
    except OSError:
        return ''


def _next_parse_in():
    if settings.parse_interval <= 0:
        return None
    try:
        with open(settings.parse_next_file, 'r') as marker:
            next_ts = float(marker.read().strip())
    except (OSError, ValueError):
        return None
    return max(0, int(next_ts - time.time()))


@app.route(f'{PREFIX}/api/parse_status', methods=['GET'])
async def api_parse_status():
    if 'admin' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    running = bool(_parser_running())
    response = jsonify({
        'running': running,
        'marker': _parse_done_marker(),
        'interval': settings.parse_interval,
        'next_parse_in': None if running else _next_parse_in(),
    })
    response.headers['Cache-Control'] = 'no-store'
    return response


async def _donate_license_valid():
    token = settings.donate_token
    if not token:
        return False

    now = time.time()
    cache = _DONATE_LICENSE_CACHE
    if cache['token'] == token and now - cache['ts'] < 3600:
        return cache['valid']

    def check_license():
        url = settings.license_server_url.rstrip('/') + '/api'
        payload = json.dumps({'key': token, 'action': 'validate'}).encode('utf-8')
        request_obj = urllib.request.Request(
            url, data=payload, method='POST',
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': LICENSE_USER_AGENT,
            },
        )
        with urllib.request.urlopen(request_obj, timeout=5) as response_obj:
            data = json.loads(response_obj.read().decode('utf-8'))
        return bool(data.get('valid')) and data.get('product') == LICENSE_PRODUCT

    try:
        valid = await asyncio.to_thread(check_license)
    except Exception:
        # Fail closed: a licensed user should not see the donation prompt when the server is unavailable
        log.warning('Could not validate DONATE_TOKEN with the license server, suppressing the donate dialog')
        valid = True

    cache.update(ts=now, valid=valid, token=token)
    return valid


@app.route(f'{PREFIX}/api/donate_status', methods=['GET'])
async def api_donate_status():
    if 'admin' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    licensed = await _donate_license_valid() if settings.donate_token else False
    response = jsonify({'show': not licensed, 'licensed': licensed})
    response.headers['Cache-Control'] = 'no-store'
    return response

# All GET params are used for api/stats?status=reject
@app.route(f'{PREFIX}/api/stats', methods=['GET'])
async def api_stats():

    auth_response = await _require_auth()
    if auth_response:
        return auth_response

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    _sm = r.table('sent_mail')

    frm = dict(request.args)
    start_time = time.time()

    equal = str(frm.get('equal', 'true'))

    if 'statuses' in frm:
        status = str(frm.pop('statuses'))
        count = await _sm.get_all(status, index='status_code').count().run(conn, array_limit=settings.rethink_arr_limit)
        log.debug('Status %s count query took %.2fs', status, time.time() - start_time)
        return {status: count}

    if 'top_senders' in frm:
        del frm['top_senders']
        mode = 1 if 'log_lines' in frm else 0

        if mode == 1:
            search_string = str(frm.pop('log_lines'))
            if equal == 'true':
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
            else:
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
            ids = [f['queue_id'] async for f in found_strings]
            _sm = _sm.get_all(r_q.args(ids), index='id').distinct()

        exclude_list = []
        if 'filtered_top_senders_excluded' in frm:
            try:
                exclude_list = json.loads(frm['filtered_top_senders_excluded'])
            except (ValueError, TypeError):
                exclude_list = []
            del frm['filtered_top_senders_excluded']
        if not isinstance(exclude_list, list):
            exclude_list = []

        senders_query = await _process_filters(mode, r_q=r_q, query=_sm, frm=frm)
        senders_result = await senders_query.pluck('mail_from').distinct().run(conn, array_limit=settings.rethink_arr_limit)
        senders = senders_result if isinstance(senders_result, list) else [s async for s in senders_result]

        _sm = r.table('sent_mail')
        if settings.exclude_from_top_senders != '':
            exclude_list = exclude_list + settings.exclude_from_top_senders.split(',')
        if '' in exclude_list:
            exclude_list.append('<>')

        senders_array = []
        for s in senders:
            senders_count = _sm.between(s['mail_from'], s['mail_from'] + ' ', index='mail_from')
            senders_count = await _process_filters(1, r_q=r_q, query=senders_count, frm=frm)
            senders_count = await senders_count.count().run(conn, array_limit=settings.rethink_arr_limit)
            if s['mail_from'] not in exclude_list:
                senders_array.append({'mail_from': s['mail_from'], 'count': senders_count})

        senders_array = sorted(senders_array, key=lambda d: d['count'], reverse=True)[:10]
        log.debug('Top senders query took %.2fs', time.time() - start_time)
        return jsonify(senders_array)

    if 'top_recipients' in frm:
        del frm['top_recipients']
        mode = 1 if 'log_lines' in frm else 0

        if mode == 1:
            search_string = str(frm.pop('log_lines'))
            if equal == 'true':
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
            else:
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
            ids = [f['queue_id'] async for f in found_strings]
            _sm = _sm.get_all(r_q.args(ids), index='id').distinct()

        exclude_list = []
        if 'filtered_top_recipients_excluded' in frm:
            try:
                exclude_list = json.loads(frm['filtered_top_recipients_excluded'])
            except (ValueError, TypeError):
                exclude_list = []
            del frm['filtered_top_recipients_excluded']
        if not isinstance(exclude_list, list):
            exclude_list = []

        recipients_query = await _process_filters(mode, r_q=r_q, query=_sm, frm=frm)
        recipients_result = await recipients_query.pluck('mail_to').run(conn, array_limit=settings.rethink_arr_limit)
        recipients = recipients_result if isinstance(recipients_result, list) else [r async for r in recipients_result]

        recipients_array_reformed = []
        to_add_from_multiples = []

        _sm = r.table('sent_mail')
        if settings.exclude_from_top_recipients != '':
            exclude_list = exclude_list + settings.exclude_from_top_recipients.split(',')
        if '' in exclude_list:
            exclude_list.append('<>')

        def proc_recipients_dict(s):
            if not s.get('mail_to'):
                return
            try:
                s['mail_to'] = json.loads(s['mail_to'])
            except (ValueError, TypeError):
                s['mail_to'] = s['mail_to'].lstrip('[').rstrip(']').split(',')

            for m in s['mail_to']:
                if isinstance(m, dict):
                    for value in (m.get('mail_to'), m.get('mail_to_alias')):
                        if not value:
                            continue
                        if value not in recipients_array_reformed:
                            recipients_array_reformed.append(value)
                        to_add_from_multiples.append(value)
                else:
                    m = m.lstrip(' ').strip('"')
                    if m not in recipients_array_reformed:
                        recipients_array_reformed.append(m)
                    if len(s['mail_to']) > 1:
                        to_add_from_multiples.append(m)

        for s in recipients:
            proc_recipients_dict(s)

        to_add_from_multiples_dict = {i: to_add_from_multiples.count(i) for i in to_add_from_multiples}

        recipients_array = []
        for s in recipients_array_reformed:
            recipients_count = _sm.between(s, s + ' ', index='mail_to')
            recipients_count = await _process_filters(1, r_q=r_q, query=recipients_count, frm=frm)
            recipients_count = await recipients_count.count().run(conn, array_limit=settings.rethink_arr_limit)
            if s not in exclude_list:
                recipients_count += to_add_from_multiples_dict.get(s, 0)
                recipients_array.append({'mail_to': s, 'count': recipients_count})

        recipients_array = sorted(recipients_array, key=lambda d: d['count'], reverse=True)[:10]
        log.debug('Top recipients query took %.2fs', time.time() - start_time)
        return jsonify(recipients_array)



@app.route(f'{PREFIX}/api/emails', methods=['GET'])
async def api_emails():
    """

    All GET params are used for filtering. Use ``x.y`` to access sub-dict key's (only works for 1 layer deep),
    and append ``__lt`` / ``__gt`` to the end of a key for ``<=`` and ``>=`` respectively.


    Example queries:

        Get emails where ``mail['status']['code'] == 'bounced'``

        /api/emails?status.code=bounced


        Get emails older than or equal to ``2019-09-17 00:00:00`` but newer than 2019-09-10 00:00:00

        /api/emails?timestamp__lt=2019-09-17 00:00:00&timestamp__gt=2019-09-10 00:00:00


        Find a specific email by ID

        /api/emails?id=E553EBD87B


    :return:
    """
    auth_response = await _require_auth()
    if auth_response:
        return auth_response

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    frm = dict(request.args)
    order_by = str(frm.pop('order', 'last_attempt')).lower()
    order_dir = str(frm.pop('order_dir', 'desc')).lower()
    equal = str(frm.get('equal', 'true'))

    _sm = r.table('sent_mail')

    if 'log_lines' in frm:
        search_string = str(frm.pop('log_lines'))

        if equal == 'true':
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
        else:
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
        ids = [f['queue_id'] async for f in found_strings]
        _sm = _sm.get_all(r_q.args(ids), index='id').distinct()

    _sm = await _process_filters(1, r_q=r_q, query=_sm, frm=frm)
    try:
        _sm, res = await _paginate_query(_sm, frm, rt_conn=conn, rt_query=r_q, order_by=order_by, order_dir=order_dir)
        _sm = await _sm.limit(settings.max_limit).run(conn, array_limit=settings.rethink_arr_limit)

        if isinstance(_sm, list):
            sm = [dict(s) for s in _sm]
        else:
            sm = [dict(s) async for s in _sm]

        res.result = sm

        return jsonify(res.to_json_dict())

    except Exception as e:
        if 'Array over size limit' in str(e):
            log.error('RETHINK_ARR_LIMIT is too low for this API response')
            __STORE.clear()
            session['NOTIE_MESSAGE'] = "api_error_overlimit"
        else:
            log.exception('Cannot connect to RethinkDB, trying to reconnect')
            __STORE.clear()
            r, conn, r_q = await get_rethink()
            session['NOTIE_MESSAGE'] = "api_error"

        return redirect(f'{PREFIX}/')


async def _paginate_query(query: QueryOrTable, frm: Mapping, rt_conn: DefaultConnection, rt_query: rethinkdb.query,
                          order_by=None, order_dir='desc') -> Tuple[QueryOrTable, PageResult]:
    _lo = filter_form(frm, 'limit', 'offset', 'page', cast=int)
    limit, offset, page = _lo.get('limit', settings.default_limit), _lo.get('offset', 0), _lo.get('page')

    if page:
        offset = limit * (page - 1)
    offset = max(offset, 0)

    count = await query.count().run(rt_conn, array_limit=settings.rethink_arr_limit)

    if order_by in ('client', 'relay'):
        sort_key = lambda m: (
            m[order_by].default({})['host'].default('') + ' ' +
            m[order_by].default({})['ip'].default('')
        )
    else:
        sort_key = order_by
    r_order = sort_key if order_dir == 'asc' else rt_query.desc(sort_key)
    limit = settings.default_limit if limit <= 0 else min(limit, settings.max_limit)
    if offset >= count:
        offset = max(count - limit, 0)

    current_page = offset // limit + 1
    total_pages = max((count + limit - 1) // limit, 1)
    res = PageResult(error=False, count=count, remaining=count - offset, page=current_page, total_pages=total_pages)

    query = query.order_by(r_order).skip(offset).limit(limit)
    return query, res

async def _process_filters(mode, r_q, query: QueryOrTable, frm: Mapping, skip_keys: List[str] = None) -> QueryOrTable:
    if empty(frm, itr=True):
        return query

    skip_keys = ['limit', 'offset', 'page', '_'] if not skip_keys else skip_keys
    timestamp_key = 'timestamp'
    fval_gt = ''
    fval_lt = ''

    if mode == 0:
        for fkey, fval in frm.items():
            if fkey in skip_keys:
                continue
            if '__gt' in fkey:
                timestamp_key = fkey.replace('__gt', '')
                fval_gt = moment.date(fval, settings.datetime_format).date.replace(tzinfo=timezone.utc)
                if fval_lt == '':
                    fval_lt = r_q.maxval
            elif '__lt' in fkey:
                timestamp_key = fkey.replace('__lt', '')
                fval_lt = moment.date(fval, settings.datetime_format).date.replace(tzinfo=timezone.utc)
                if fval_gt == '':
                    fval_gt = r_q.minval

        if fval_gt and fval_lt:
            query = query.between(fval_gt, fval_lt, right_bound='closed', index=timestamp_key)
    elif mode == 1:
        for fkey, fval in frm.items():
            if fkey in skip_keys:
                continue
            if '__lt' in fkey:
                fkey = fkey.replace('__lt', '')
                fval = moment.date(fval, settings.datetime_format).date.replace(tzinfo=timezone.utc)
                query = query.filter(lambda m: m[fkey] <= fval)
            elif '__gt' in fkey:
                fkey = fkey.replace('__gt', '')
                fval = moment.date(fval, settings.datetime_format).date.replace(tzinfo=timezone.utc)
                query = query.filter(lambda m: m[fkey] >= fval)

    equal = 'true'
    for fkey, fval in frm.items():
        if fkey in skip_keys:
            continue
        if fkey == 'equal':
            if fval == 'false':
                equal = fval
            continue
        if '__gt' not in fkey and '__lt' not in fkey:
            query = await _filter_form_key(equal=equal, fkey=fkey, fval=fval, query=query)

    return query

async def _filter_form_key(equal: str, fkey: str, fval: str, query: QueryOrTable) -> QueryOrTable:
    if '.' in fkey:
        k1, k2 = fkey.split('.')
        return query.filter(lambda m: m[k1][k2] == fval)

    # Asterisks act as wildcards and are stripped before matching
    rval = fval.replace('*', '')

    if fkey in ('client', 'relay'):
        if equal == 'false':
            query = query.filter(lambda m: (
                ~m[fkey].default({})['host'].default('').match(rval) &
                ~m[fkey].default({})['ip'].default('').match(rval)
            ))
        else:
            query = query.filter(lambda m: (
                m[fkey].default({})['host'].default('').match(rval) |
                m[fkey].default({})['ip'].default('').match(rval)
            ))
        return query

    if equal == 'false':
        if fkey.startswith('mail_to'):
            query = query.filter(lambda m: (~m[fkey].coerce_to("string").match(rval) & ~m['mail_to_alias'].coerce_to("string").match(rval)))
        else:
            query = query.filter(lambda m: (~m[fkey].coerce_to("string").match(rval)))
    else:
        if fkey.startswith('mail_to'):
            query = query.filter(lambda m: m[fkey].coerce_to("string").match(rval) | m['mail_to_alias'].coerce_to("string").match(rval))
        else:
            query = query.filter(lambda m: m[fkey].coerce_to("string").match(rval))

    return query

async def _process_notie():
    NOTIE_MESSAGE = ""
    if 'NOTIE_MESSAGE' in session:
        NOTIE_MESSAGE = session['NOTIE_MESSAGE']
        if NOTIE_MESSAGE != 'api_error_overlimit':
            del session['NOTIE_MESSAGE']
    return NOTIE_MESSAGE


def _is_password_hash(value) -> bool:
    if not isinstance(value, str):
        return False
    return value.split(':', 1)[0] in ('pbkdf2', 'scrypt')


def _verify_password(stored, provided) -> bool:
    if not isinstance(stored, str) or not isinstance(provided, str):
        return False
    if _is_password_hash(stored):
        return check_password_hash(stored, provided)
    # Support legacy plain-text passwords so they can be upgraded on login
    return hmac.compare_digest(stored, provided)


async def _require_auth():
    """Return a redirect response when the session is not authenticated, otherwise None."""
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    if not settings.ldap_connect:
        auth_status = await check_user_pass(session.get('login'), None, 2)
    else:
        auth_status = await ldap_auth(session.get('login'), None, 2)
    if auth_status != 1:
        return redirect(f'{PREFIX}/logout')
    return None


async def ldap_auth(u, p, mode):
    try:
        conn = ldap.initialize(settings.ldap_connect)
        conn.protocol_version = settings.ldap_version
        conn.simple_bind_s(settings.ldap_bind_dn, settings.ldap_bind_dn_pwd)
        criteria = settings.ldap_searchfilter % (settings.ldap_username_attr, escape_filter_chars(u or ''))
        result = conn.search_s(settings.ldap_searchbase, ldap.SCOPE_SUBTREE, criteria, [settings.ldap_username_attr])
        conn.unbind_s()
    except ldap.INVALID_CREDENTIALS:
        log.error('Your LDAP BIND_DN credentials are incorrect')
        return 2
    except ldap.LDAPError:
        log.exception('LDAP error during bind/search')
        return 4

    if not result:
        log.info('User not found in LDAP, check search filter and base settings')
        return 3

    if mode == 2:
        return 1
    if mode != 1 or u is None or p is None:
        return 0

    try:
        user_conn = ldap.initialize(settings.ldap_connect)
        user_conn.protocol_version = settings.ldap_version
        user_conn.simple_bind_s(f'{u}@{settings.ldap_username_domain_part}', p)
        user_conn.unbind_s()
        return 1
    except ldap.INVALID_CREDENTIALS:
        return 0
    except ldap.LDAPError:
        log.exception('LDAP error during user bind')
        return 4


async def check_user_pass(u, p, mode):
    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    auth_table = r.table('auth')

    try:
        if mode == 1:
            if u is None or p is None:
                return 0
            user = await auth_table.get(u).run(conn, array_limit=settings.rethink_arr_limit)
            if not user:
                return 0
            stored = user.get('password', '')
            if not _verify_password(stored, p):
                return 0
            if not _is_password_hash(stored):
                hashed = generate_password_hash(p)
                await auth_table.get(u).update({'password': hashed}).run(conn, array_limit=settings.rethink_arr_limit)
            return 1
        if mode == 0:
            count = await auth_table.count().run(conn, array_limit=settings.rethink_arr_limit)
            return 1 if count else 0
        if mode == 2:
            if u is None:
                return 0
            count = await auth_table.filter({'id': u}).count().run(conn, array_limit=settings.rethink_arr_limit)
            return 1 if count else 0
        return 0
    except Exception:
        log.exception('Cannot connect to RethinkDB, trying to reconnect')
        __STORE.clear()
        session['NOTIE_MESSAGE'] = "api_error"
        if mode == 0:
            # Distinguish a DB failure from "no users exist"; callers must not
            # treat an error as permission to register the first account.
            raise
        return 0


async def edit_user(u, p, mode):
    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    auth_table = r.table('auth')

    if mode == 0:
        log.info('Creating/updating user %s', u)
        hashed = generate_password_hash(p)
        return await auth_table.insert({'id': u, 'password': hashed}, conflict='replace').run(conn, array_limit=settings.rethink_arr_limit)

    log.info('Deleting user %s', u)
    return await auth_table.filter({'id': u}).delete().run(conn, array_limit=settings.rethink_arr_limit)


@app.errorhandler(404)
async def handle_404(exc=None):
    return await api.handle_error('NOT_FOUND', VERSION=VERSION, exc=exc)


@app.errorhandler(APIException)
async def api_exception_handler(exc: APIException, *args, **kwargs):
    return await api.handle_error(err_code=exc.error_code, VERSION=VERSION, err_msg=exc.message, code=exc.status, exc=exc, template=exc.template)


@app.errorhandler(Exception)
async def app_error_handler(exc=None, *args, **kwargs):
    log.warning("app_error_handler exception type / msg: %s / %s", type(exc), str(exc))
    log.warning("app_error_handler *args: %s", args)
    log.warning("app_error_handler **kwargs: %s", kwargs)
    return await api.handle_error('UNKNOWN_ERROR', VERSION=VERSION, exc=exc)
