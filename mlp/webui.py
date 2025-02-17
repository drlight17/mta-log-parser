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
import json
import os.path
from dataclasses import dataclass, field
from typing import List, Union, Mapping, Tuple

import rethinkdb.query
import logging

from rethinkdb.net import DefaultConnection

from mlp.main import VERSION, lockfile
from mlp import settings, api

from mlp.exceptions import APIException
from mlp.core import get_rethink, __STORE
from quart import Quart, session, redirect, render_template, request, flash, jsonify
from privex.helpers import random_str, empty, filter_form, DictDataClass, DictObject
# for timestamp process
from datetime import datetime, timedelta, timezone

from dateutil import parser
# TODO dayjs? as moment is deprecated
import moment

# add ldap support 
import ldap

# temp for time measurements
import time

log = logging.getLogger(__name__)

app = Quart(__name__)

# add path prefix
PREFIX = settings.path_prefix
new_static_path = PREFIX+"/static"
app.static_url_path = new_static_path

'''for rule in app.url_map.iter_rules('static'):
    app.url_map._rules.remove(rule)  # There is probably only one.'''

# version to static files
@app.template_filter('version')
def version_filter(filename):
  newfilename = filename+"?v="+VERSION
  return newfilename

app.url_map._rules_by_endpoint['static'] = []

app.add_url_rule(f'{new_static_path}/<path:filename>',
                 endpoint='static',
                 view_func=app.send_static_file)

app.secret_key = settings.secret_key

Table = rethinkdb.query.ast.Table
RqlQuery = rethinkdb.query.ast.RqlQuery
QueryOrTable = Union[Table, RqlQuery]


@app.route(f'{PREFIX}/', methods=['GET'])
async def index():
    # print(settings.mail_domain)
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
    

'''@app.route(f'{PREFIX}/register_new', methods=['GET'])
async def register_new():
    if 'admin' in session:
        return await render_template('register.html', VUE_DEBUG=settings.vue_debug, settings=settings, VERSION=VERSION, LOGIN=session['login'])
    session['NOTIE_MESSAGE'] = "unauth"
    return redirect(f'{PREFIX}/')'''


@app.route(f'{PREFIX}/register', methods=['POST'])
async def register():

    frm = await request.form
    #print(frm)
    #if 'act_type' not in frm
    #if frm.get('password') == frm.get('password2'):
    if frm.get('act_type') == "delete":
        status = await edit_user(frm.get('login'),frm.get('password'),1)
    else:
        status = await edit_user(frm.get('login'),frm.get('password'),0)

    #print(status)
    #else:
    #    session['NOTIE_MESSAGE'] = "passwords_not_same"
    #    return redirect(f'{PREFIX}/')
    if status['inserted'] != 0:
        session['NOTIE_MESSAGE'] = "user_created"
        '''if frm.get('act_type') is None:
            return redirect(f'{PREFIX}/')'''
    elif status['unchanged'] != 0 or status['replaced'] != 0:
        session['NOTIE_MESSAGE'] = "user_edited"
    elif status['deleted'] != 0:
        session['NOTIE_MESSAGE'] = "user_deleted"
        # check if no user left
        auth_status = await check_user_pass(None, None, 0)
        if auth_status == 0:
            print("No users left. We must log out!")
            session['NOTIE_MESSAGE'] = "no_users_found"
            return redirect(f'{PREFIX}/logout')
    else:
        session['NOTIE_MESSAGE'] = "user_creation_error"

    if frm.get('act_type') is None:
            return redirect(f'{PREFIX}/')

    return redirect(f'{PREFIX}/auth')

@app.route(f'{PREFIX}/login', methods=['POST'])
async def login():

    
    frm = await request.form
    # check if LDAP is configured
    if not settings.ldap_connect:
        auth_status = await check_user_pass(frm.get('login'),frm.get('password'), 1)
    else:
        auth_status = await ldap_auth(frm.get('login'),frm.get('password'),1)
    

    #if frm.get('password') == settings.admin_pass and frm.get('login') == 'admin':
    if auth_status == 1:
        session['login'] = frm.get('login')
        #session['password'] = frm.get('password')
        session['admin'] = random_str()
        #print(session)
        
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

    # check if current user exists
    # check if LDAP is configured
    if not settings.ldap_connect:
        auth_status = await check_user_pass(session['login'], None, 2)
    else:
        auth_status = await ldap_auth(session['login'], None, 2)
    if auth_status == 0 or auth_status == 3 or auth_status == 2:
        #print("Current user wasnt found. Force log out!")
        return redirect(f'{PREFIX}/logout')

    return await render_template('emails.html', VUE_DEBUG=settings.vue_debug, NOTIE_MESSAGE=NOTIE_MESSAGE, ARGS=ARGS, settings=settings, VERSION=VERSION, LOGIN=session['login'])


@app.route(f'{PREFIX}/api/process_check', methods=['GET'])
@app.route(f'{PREFIX}/api/process_check/', methods=['GET'])
async def process_check():
    if settings.gui_refresh_block:
        if os.path.isfile(lockfile):
            return {'processing': True }
        else:
            return {'processing': False }
    else:
        return {'processing': False }

@app.route(f'{PREFIX}/auth', methods=['GET'])
@app.route(f'{PREFIX}/auth/', methods=['GET'])
async def auth_ui():

    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    NOTIE_MESSAGE = await _process_notie()

    if not settings.ldap_connect:
        auth_status = await check_user_pass(session['login'],None, 2)
    else:
        session['NOTIE_MESSAGE'] = "unauth_ldap"
        return redirect(f'{PREFIX}/emails')
        #auth_status = await ldap_auth(session['login'], None, 2)
    if auth_status == 0 or auth_status == 3 or auth_status == 2:
        #print("Current user wasnt found. Force log out!")
        return redirect(f'{PREFIX}/logout')

    #print(session['NOTIE_MESSAGE'])
    return await render_template('edit.html', VUE_DEBUG=settings.vue_debug, NOTIE_MESSAGE=NOTIE_MESSAGE, settings=settings, VERSION=VERSION, LOGIN=session['login'])


@app.route(f'{PREFIX}/logout', methods=['GET'])
async def logout():
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    del session['admin']
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
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    if not settings.ldap_connect:
        auth_status = await check_user_pass(session['login'],None, 2)
    else:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')
        #auth_status = await ldap_auth(session['login'], None, 2)
    if auth_status == 0 or auth_status == 3 or auth_status == 2:

        #print("Current user wasnt found. Force log out!")
        return redirect(f'{PREFIX}/logout')

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    _sm = r.table('auth')
    _sm = await _sm.run(conn, array_limit=settings.rethink_arr_limit)

    sm = []
    if type(_sm) is list:
        sm = list(_sm)
    else:
        async for s in _sm:
            sm.append(dict(s))

    #print(sm)

    return jsonify(sm)

# All GET params are used for api/stats?status=reject
@app.route(f'{PREFIX}/api/stats', methods=['GET'])
async def api_stats():
    
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    if not settings.ldap_connect:
        auth_status = await check_user_pass(session['login'],None, 2)
    else:
        auth_status = await ldap_auth(session['login'], None, 2)
    if auth_status == 0 or auth_status == 3 or auth_status == 2:
        #print("Current user wasnt found. Force log out!")
        return redirect(f'{PREFIX}/logout')

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query
    _sm = r.table('sent_mail')

    frm = dict(request.args)
    start_time = time.time()

    if 'statuses' in frm:
        
        response = str(frm.pop("statuses"))
        #del frm['statuses']

        #print(str(frm.pop('status')))
        # without index
        #_sm = await _sm.filter(lambda m: m["status"]["code"] == response).count().run(conn, array_limit=settings.rethink_arr_limit)
        # with index
        #_sm, res = await _paginate_query(_sm, frm, rt_conn=conn, rt_query=r_q, order_by=order_by, order_dir=order_dir)
        _sm = await _sm.get_all(response, index = 'status_code').count().run(conn, array_limit=settings.rethink_arr_limit)

        #print(_sm)
        end_time = time.time()
        elapsed_time = end_time - start_time
        print("\nStatus "+response+" query is completed in {:.2f} seconds".format(elapsed_time))
        return {response: _sm}
    if 'top_senders' in frm:
        del frm['top_senders']
        '''if 'log_lines' in frm:
            del frm['log_lines']'''
        if 'equal' in frm:
            equal = str(frm['equal'])
            #del frm['equal']

        if 'log_lines' in frm:
            mode = 1
            search_string = str(frm.pop('log_lines'))#.lower()

            if equal == 'true':
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
            else:
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
            
            ids = []
            async for f in found_strings:
                ids.append(f['queue_id'])
            #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
            # new much more effective query method
            _sm = _sm.get_all(r_q.args(ids), index='id').distinct()
        else:
            mode = 0


        exclude_list = []

        if 'filtered_top_senders_excluded' in frm:
            exclude_list = json.loads(frm['filtered_top_senders_excluded'])
            del frm['filtered_top_senders_excluded']



        _senders_array = await _process_filters(mode, r_q=r_q, query=_sm, frm=frm)
        _senders_array = _senders_array.pluck("mail_from").distinct()
        _senders_array = await _senders_array.run(conn, array_limit=settings.rethink_arr_limit)

        senders_array = []
        sender = {}

        # don't forget to flush previous query!
        _sm = r.table('sent_mail')
        
        if settings.exclude_from_top_senders != '':
            exclude_list = exclude_list + settings.exclude_from_top_senders.split(",")

        # for exim compatibility
        if '' in exclude_list:
            exclude_list.append('<>')

        for s in _senders_array:
            # hack to force between find one contain
            _senders_count = _sm.between(s['mail_from'], s['mail_from']+" ", index = 'mail_from')
            _senders_count = await _process_filters(1, r_q=r_q, query=_senders_count, frm=frm)
            _senders_count = await  _senders_count.count().run(conn, array_limit=settings.rethink_arr_limit)

            # exclude from array based on settings excludes
            if s['mail_from'] not in exclude_list:
                sender['mail_from'] = s['mail_from']
                sender['count'] = _senders_count
                senders_array.append(dict(sender))

        # sort array reverse and limit by 10    
        senders_array = sorted(senders_array, key=lambda d: d['count'], reverse=True)[:10]

        # old overall rank with index
        #_senders_array = await _process_filters(r_q=r_q, query=_sm, frm=frm)
        #_senders_array = await _sm.distinct(index = 'mail_from').map(lambda m: {'mail_from': m, 'count': _sm.get_all(m, index = 'mail_from').count()}).order_by(r_q.desc('count')).limit(10).run(conn, array_limit=settings.rethink_arr_limit)

        # temp time measurements
        end_time = time.time()
        elapsed_time = end_time - start_time
        print("\nTop_senders query is completed in {:.2f} seconds".format(elapsed_time))
        return jsonify(senders_array)

    '''if 'top_recipients' in frm:
        del frm['top_recipients']
        # with index
        _recipients_array = await _sm.distinct(index = 'mail_to').map(lambda m: {'mail_to': m, 'count': _sm.get_all(m, index = 'mail_to').count()}).order_by(r_q.desc('count')).limit(10).run(conn, array_limit=settings.rethink_arr_limit)
        end_time = time.time()
        elapsed_time = end_time - start_time
        print("\nTop_recipients query is completed in {:.2f} seconds".format(elapsed_time))
        return jsonify(_recipients_array)'''

    if 'top_recipients' in frm:
        del frm['top_recipients']
        '''if 'log_lines' in frm:
            del frm['log_lines']'''

        if 'equal' in frm:
            equal = str(frm['equal'])     

        if 'log_lines' in frm:
            mode = 1
            search_string = str(frm.pop('log_lines'))#.lower()

            if equal == 'true':
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
            else:
                found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
            
            ids = []
            async for f in found_strings:
                ids.append(f['queue_id'])
            #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
            # new much more effective query method
            _sm = _sm.get_all(r_q.args(ids), index='id').distinct()
        else:
            mode = 0


        exclude_list = []

        if 'filtered_top_recipients_excluded' in frm:
            exclude_list = json.loads(frm['filtered_top_recipients_excluded'])
            del frm['filtered_top_recipients_excluded'] 

        _recipients_dict = await _process_filters(mode, r_q=r_q, query=_sm, frm=frm)
        _recipients_dict = _recipients_dict.pluck("mail_to")#.distinct()
        _recipients_dict = await _recipients_dict.run(conn, array_limit=settings.rethink_arr_limit)

        recipients_array = []
        recipient = {}
        recipients_array_reformed = []
        to_add_from_multiples = []
        temp_arr = []

        # don't forget to flush previous query!
        _sm = r.table('sent_mail')

        if settings.exclude_from_top_recipients != '':
            exclude_list = exclude_list + settings.exclude_from_top_recipients.split(",")

        # for exim compatibility
        if '' in exclude_list:
            exclude_list.append('<>')

        def proc_recipients_dict(s):
            # check if multiple recipients
            try:
                s['mail_to'] = json.loads(s['mail_to'])

            except ValueError as e:
                # convert string to list
                s['mail_to'] = s['mail_to'].lstrip('[').rstrip(']').split(',')
     
            # old check
            #if type(s['mail_to']) is list:

            for m in s['mail_to']:

                if type(m) is dict:
                    #print(m['mail_to'])
                    #print(m['mail_to_alias'])
                    j = m['mail_to']
                    k = m['mail_to_alias']
                    if j not in recipients_array_reformed:
                        recipients_array_reformed.append(j)
                    #if len(s['mail_to']) > 1:
                    to_add_from_multiples.append(j)

                    if k not in recipients_array_reformed:
                        recipients_array_reformed.append(k)
                    #if len(s['mail_to']) > 1:
                    to_add_from_multiples.append(k)
                else:
                    m = m.lstrip(' ').strip("\"")
                    if m not in recipients_array_reformed:
                        recipients_array_reformed.append(m)
                    if len(s['mail_to']) > 1:
                        to_add_from_multiples.append(m)

        if mode == 1:
            for s in _recipients_dict:
                proc_recipients_dict(s)
        else:
            async for s in _recipients_dict:
                proc_recipients_dict(s)
        
        # create dict with recipients from messages with multiple recipients and counted number of deliveries with every recipient
        to_add_from_multiples_dict = {i:to_add_from_multiples.count(i) for i in to_add_from_multiples}
        #print(recipients_array_reformed)
        #print(to_add_from_multiples)
        #print(to_add_from_multiples_dict)
        

        for s in recipients_array_reformed:
            # hack to force between find one contain
            _recipients_count = _sm.between(s, s+" ", index = 'mail_to')
            _recipients_count = await _process_filters(1, r_q=r_q, query=_recipients_count, frm=frm)
            _recipients_count = await  _recipients_count.count().run(conn, array_limit=settings.rethink_arr_limit)
            # exclude from array based on settings excludes
            if s not in exclude_list:
                # increment count for every recipient from to_add_from_multiples_dict
                for i, v in to_add_from_multiples_dict.items():
                    if s == i:
                        _recipients_count += v
                recipient['mail_to'] = s
                recipient['count'] = _recipients_count
                recipients_array.append(dict(recipient))


        # sort array reverse and limit by 10    
        recipients_array = sorted(recipients_array, key=lambda d: d['count'], reverse=True)[:10]

        # old overall rank with index
        #_senders_array = await _process_filters(r_q=r_q, query=_sm, frm=frm)
        #_senders_array = await _sm.distinct(index = 'mail_from').map(lambda m: {'mail_from': m, 'count': _sm.get_all(m, index = 'mail_from').count()}).order_by(r_q.desc('count')).limit(10).run(conn, array_limit=settings.rethink_arr_limit)

        # temp time measurements
        end_time = time.time()
        elapsed_time = end_time - start_time
        print("\nTop_recipients query is completed in {:.2f} seconds".format(elapsed_time))
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
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    if not settings.ldap_connect:
        auth_status = await check_user_pass(session['login'],None, 2)
    else:
        auth_status = await ldap_auth(session['login'], None, 2)
    if auth_status == 0 or auth_status == 3 or auth_status == 2:
        #print("Current user wasnt found. Force log out!")
        return redirect(f'{PREFIX}/logout')

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    frm = dict(request.args)
    order_by = str(frm.pop('order', 'last_attempt')).lower()
    order_dir = str(frm.pop('order_dir', 'desc')).lower()

    if 'equal' in frm:
        equal = str(frm['equal'])

    _sm = r.table('sent_mail')
    
    # check mail_to in log lines
    '''if 'mail_to' in frm:
        search_string = str(frm.pop('mail_to'))#.lower()
        recipient_match = ''
        if settings.mta == 'exim':
            recipient_match = "\*\* |-> |=> |== |>> "
        if settings.mta == 'sendmail' or settings.mta == 'postfix':
            recipient_match = "^to="

        if equal == 'true':
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).filter(lambda m: m['message'].match(recipient_match)).run(conn, array_limit=settings.rethink_arr_limit)
        else:
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).filter(lambda m: m['message'].match(recipient_match)).run(conn, array_limit=settings.rethink_arr_limit)
        ids = []
        async for f in found_strings:
            ids.append(f['queue_id'])
        #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
        # new much more effective query method
        _sm = _sm.get_all(r_q.args(ids), index='id').distinct()'''

    # check log lines
    if 'log_lines' in frm:
        
        search_string = str(frm.pop('log_lines'))#.lower()

        if equal == 'true':
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
        else:
            found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: ~(m['message'].match(search_string))).run(conn, array_limit=settings.rethink_arr_limit)
        ids = []
        async for f in found_strings:
            ids.append(f['queue_id'])
        #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
        # new much more effective query method
        _sm = _sm.get_all(r_q.args(ids), index='id').distinct()
    

    # Handle appending .filter() to `_sm` for each filter key in `frm`
    _sm = await _process_filters(1, r_q=r_q, query=_sm, frm=frm)
    try:
        _sm, res = await _paginate_query(_sm, frm, rt_conn=conn, rt_query=r_q, order_by=order_by, order_dir=order_dir)
        #print(settings.max_limit)
        #print(_sm)
        _sm = await _sm.limit(settings.max_limit).run(conn, array_limit=settings.rethink_arr_limit)

        #print(list(_sm))

        sm = []
        if type(_sm) is list:
            sm = list(_sm)
        else:
            async for s in _sm:
                sm.append(dict(s))

        res.result = sm

        return jsonify(res.to_json_dict())

    except Exception as e:

        #This is acceptable at the moment since that's the normal behavior for every management script
        if 'Array over size limit' in str(e):
            print("Check RETHINK_ARR_LIMIT as api reply is overlimit this value!")
            __STORE.clear()
            session['NOTIE_MESSAGE'] = "api_error_overlimit"
        else:
            print("Cannot connect to rethinkdb, trying to reconnect!")
            __STORE.clear()
            r, conn, r_q = await get_rethink()
            session['NOTIE_MESSAGE'] = "api_error"

        return redirect(f'{PREFIX}/')
        #conn.reconnect(noreply_wait=True)
        #sys.exit(1)


async def _paginate_query(query: QueryOrTable, frm: Mapping, rt_conn: DefaultConnection, rt_query: rethinkdb.query,
                          order_by=None, order_dir='desc') -> Tuple[QueryOrTable, PageResult]:
    _lo = filter_form(frm, 'limit', 'offset', 'page', cast=int)
    limit, offset, page = _lo.get('limit', settings.default_limit), _lo.get('offset', 0), _lo.get('page')

    if not empty(page, True, True):
        offset = limit * (page - 1)
    offset = 0 if offset < 0 else offset
    res = PageResult(error=False, count=0, remaining=0, page=1 if not page else page, total_pages=1)
    # Get the total number of rows which match the requested filters
    count = await query.count().run(rt_conn, array_limit=settings.rethink_arr_limit)
    #print ("Total number of rows found: ",count)

    # rt_query: RqlTopLevelQuery
    r_order = order_by if order_dir == 'asc' else rt_query.desc(order_by)
    limit = settings.default_limit if limit <= 0 else (settings.max_limit if limit > settings.max_limit else limit)

    offset = (count - limit if (count - limit) > 0 else 0) if offset >= count else offset
    page = int(offset / limit) + 1
    # fix of pagination wrong total_pages calc
    if (count % limit) == 0:
        total_pages = int(count / limit)
    else:
        total_pages = int(count / limit) + 1
    total_pages = 1 if total_pages < 1 else total_pages
    page = 1 if page < 1 else page
    res.count, res.remaining, res.page, res.total_pages = count, count - offset, page, total_pages

    query = query.order_by(r_order).skip(offset).limit(limit)
    return query, res

async def _process_filters(mode, r_q, query: QueryOrTable, frm: Mapping, skip_keys: List[str] = None) -> QueryOrTable:
    if empty(frm, itr=True):
        return query
    
    skip_keys = ['limit', 'offset', 'page'] if not skip_keys else skip_keys
    fval_gt = ''
    fval_lt = ''
    #print(frm.items())
    if mode == 0:
        for fkey, fval in frm.items():
            if fkey in skip_keys:
                continue
            # check timestamps and prepend them to query
            if '__gt' in fkey:
                fkey_ts = fkey.replace('__gt', '')
                fval_gt = moment.date(fval,settings.datetime_format).date
                fval_gt = fval_gt.replace(tzinfo=timezone.utc)
                if fval_lt == '':
                    fval_lt = r_q.maxval
                continue

            if '__lt' in fkey:
                fkey_ts = fkey.replace('__lt', '')
                fval_lt = moment.date(fval,settings.datetime_format).date
                fval_lt = fval_lt.replace(tzinfo=timezone.utc)
                if fval_gt == '':
                    fval_gt = r_q.minval
                continue

        if fval_gt and fval_lt:
            query = query.between(fval_gt, fval_lt, right_bound='closed', index=fkey_ts)
    elif mode == 1:
        for fkey, fval in frm.items():
            if fkey in skip_keys:
                continue
            if '__lt' in fkey:
                fkey = fkey.replace('__lt', '')
                fval = moment.date(fval,settings.datetime_format).date
                fval = fval.replace(tzinfo=timezone.utc)
                query = query.filter(lambda m: m[fkey] <= fval)
            if '__gt' in fkey:
                fkey = fkey.replace('__gt', '')
                fval = moment.date(fval,settings.datetime_format).date
                fval = fval.replace(tzinfo=timezone.utc)
                query = query.filter(lambda m: m[fkey] >= fval)
    
    equal = 'true'

    # check for other filters and append them to query
    for fkey, fval in frm.items():
        if fkey in skip_keys:
            continue

        if fkey == 'equal':
            if fval == 'false':
                equal = fval
                continue
            else:
                continue

        if '__gt' not in fkey and '__lt' not in fkey:
            query = await _filter_form_key(equal=equal, fkey=fkey, fval=fval, query=query)
        
    #print("query: ",query)
    return query

async def _filter_form_key(equal: bool, fkey: str, fval: str, query: QueryOrTable) -> QueryOrTable:
    if '.' in fkey:
        k1, k2 = fkey.split('.')
        return query.filter(lambda m: m[k1][k2] == fval)
    '''if '__lt' in fkey:
        fkey = fkey.replace('__lt', '')
        fval = moment.date(fval,settings.datetime_format).date
        fval = fval.replace(tzinfo=timezone.utc)
        return query.filter(lambda m: m[fkey] <= fval)
    if '__gt' in fkey:
        fkey = fkey.replace('__gt', '')
        fval = moment.date(fval,settings.datetime_format).date
        fval = fval.replace(tzinfo=timezone.utc)
        return query.filter(lambda m: m[fkey] >= fval)'''
    
    # full wildcard to key value (i.e. *find string*)
    rval = fval.replace('*', '')  # fval but without asterisks

    if equal == 'false':
        # try to find something in mail_to_alias too
        if 'mail_to' in fkey:
            query = query.filter(lambda m: (~m[fkey].coerce_to("string").match(rval) & ~m['mail_to_alias'].coerce_to("string").match(rval)))
        else:
            query = query.filter(lambda m: (~m[fkey].coerce_to("string").match(rval)))
    else:
        # try to find something in mail_to_alias too
        if 'mail_to' in fkey:
            query = query.filter(lambda m: m[fkey].coerce_to("string").match(rval) | m['mail_to_alias'].coerce_to("string").match(rval))
        else:
            query = query.filter(lambda m: m[fkey].coerce_to("string").match(rval))


    return query

    #return query.filter(lambda m: m[fkey] == fval)

async def _process_notie():
    NOTIE_MESSAGE = ""
    if 'NOTIE_MESSAGE' in session:
        NOTIE_MESSAGE = session['NOTIE_MESSAGE']
        if NOTIE_MESSAGE != 'api_error_overlimit':
            del session['NOTIE_MESSAGE']
    return NOTIE_MESSAGE

# check ldap user and password
async def ldap_auth(u,p,mode):
    l = ldap.initialize(settings.ldap_connect)
    #l.protocol_version = ldap.VERSION3
    l.protocol_version = settings.ldap_version

    try:
        l.simple_bind_s(settings.ldap_bind_dn, settings.ldap_bind_dn_pwd)
        base = settings.ldap_searchbase
        attributes = [settings.ldap_username_attr]
        criteria = settings.ldap_searchfilter %(settings.ldap_username_attr,u)
        result = l.search_s(base, ldap.SCOPE_SUBTREE, criteria, attributes)
        l.unbind_s()
        _result = []
        if type(result) is list:
            _result = list(result)
        else:
            async for s in result:
                _result.append(dict(s))


    except ldap.INVALID_CREDENTIALS:
      print("Your LDAP BIND_DN creds are incorrect!")
      return 2
      #sys.exit(0)

    except ldap.LDAPError as e:
        if hasattr(e, 'message'):
        #if type(e.message) == dict and e.message.has_key('desc'):
            if type(e.message) == dict:
                print(e.message['desc'])
        else:
            print(e)
        return 4

        #sys.exit(0)

    if _result:
        if mode == 1 and u is not None and p is not None:
            l = ldap.initialize(settings.ldap_connect)
            l.protocol_version = ldap.VERSION3
            try:
                l.simple_bind_s(u+'@'+settings.ldap_username_domain_part, p)
                return 1
            except ldap.INVALID_CREDENTIALS:
                    print("Your password is incorrect.")
                    return 0
            except ldap.LDAPError as e:
                #if type(e.message) == dict and e.message.has_key('desc'):
                if hasattr(e, 'message'):
                    if type(e.message) == dict:
                        print(e.message['desc'])
                else:
                    print(e)
                return 4
        elif mode == 2:
            return 1

    else:
        print("User not found in LDAP! Check filters and other LDAP quering settings!")
        return 3

# check user and password
async def check_user_pass(u,p,mode):
    #print("Checking user "+u+" with password "+p)
    

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    _sm = r.table('auth')
    #print(conn);


    # authentication
    try:
        if mode == 1 and u is not None and p is not None:
            _sm = await _sm.filter({"id": u,"password": p}).run(conn, array_limit=settings.rethink_arr_limit)
        # check for any user existence
        elif mode == 0:
            _sm = await _sm.run(conn, array_limit=settings.rethink_arr_limit)
        # check for logged in user
        elif mode == 2:
            _sm = await _sm.filter({"id": u}).run(conn, array_limit=settings.rethink_arr_limit)

        sm = []
        if type(_sm) is list:
            sm = list(_sm)
        else:
            async for s in _sm:
                sm.append(dict(s))
        #print(sm)

        if sm:
            #print("Found user and password.")
            return 1

        #print("User and/or password is not found.")
        return 0

    except:
        #This is acceptable at the moment since that's the normal behavior for every management script
        print("Cannot connect to rethinkdb, trying to reconnect!")
        __STORE.clear()
        r, conn, r_q = await get_rethink()
        session['NOTIE_MESSAGE'] = "api_error"
        return redirect(f'{PREFIX}/')
        #conn.reconnect(noreply_wait=True)
        #sys.exit(1) 

# create/edit new user
async def edit_user(u,p,mode):

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    _sm = r.table('auth')
    if mode == 0:
        print("Creating/editing user "+u+" with password "+p)
        _sm = await _sm.insert({"id": u,"password": p}, conflict="replace").run(conn, array_limit=settings.rethink_arr_limit)
    else:
        print("Deleting user "+u+" with password "+p)
        _sm = await _sm.filter({"id": u}).delete().run(conn, array_limit=settings.rethink_arr_limit)
    

    '''sm = []
    if type(_sm) is list:
        sm = list(_sm)
    else:
        async for s in _sm:
            sm.append(dict(s))'''
    #print(sm)

    '''result['deleted'] = _sm['deleted']

    if result['deleted'] != 0:
        result['status'] = 'true'
    else:
        result['status'] = 'false'''

    return _sm


@app.errorhandler(404)
async def handle_404(exc=None):
    return await api.handle_error('NOT_FOUND', VERSION=VERSION, exc=exc)


@app.errorhandler(APIException)
async def api_exception_handler(exc: APIException, *args, **kwargs):
    #print(exc.template)
    return await api.handle_error(err_code=exc.error_code, VERSION=VERSION, err_msg=exc.message, code=exc.status, exc=exc, template=exc.template)


@app.errorhandler(Exception)
async def app_error_handler(exc=None, *args, **kwargs):
    log.warning("app_error_handler exception type / msg: %s / %s", type(exc), str(exc))
    log.warning("app_error_handler *args: %s", args)
    log.warning("app_error_handler **kwargs: %s", kwargs)
    return await api.handle_error('UNKNOWN_ERROR', VERSION=VERSION, exc=exc)
